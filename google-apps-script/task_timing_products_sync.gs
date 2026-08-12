/**
 * Manual full sync for the product-master spreadsheet.
 *
 * Bind this script to the product master Sheet. The Supabase URL and service
 * role/secret key are read from Script Properties; no credentials are stored
 * in this file.
 */
var TASK_TIMING_SYNC_BATCH_SIZE = 200;

function productRowToTaskTimingProduct_(headers, row) {
  var source = {};
  headers.forEach(function (header, index) {
    source[String(header).trim()] = row[index];
  });

  var partNumber = String(source['品番'] || '').trim();
  if (!partNumber) return null;

  var ctValue = source['CT時間(秒)'];
  var ctTimeSeconds = ctValue === '' || ctValue === null || ctValue === undefined
    ? null
    : Number(ctValue);
  if (isNaN(ctTimeSeconds)) ctTimeSeconds = null;

  return {
    part_number: partNumber,
    product_name: String(source['品名'] || ''),
    car_model: String(source['車型'] || ''),
    category: String(source['類別'] || ''),
    ct_time_seconds: ctTimeSeconds,
    product_image: String(source['產品圖片'] || ''),
    source_updated_at: new Date().toISOString(),
  };
}

function dedupeTaskTimingProducts_(products) {
  var seenPartNumbers = {};
  var uniqueProducts = [];
  for (var index = products.length - 1; index >= 0; index--) {
    var product = products[index];
    if (seenPartNumbers[product.part_number]) continue;
    seenPartNumbers[product.part_number] = true;
    uniqueProducts.push(product);
  }
  return uniqueProducts.reverse();
}

function syncTaskTimingProductsToSupabase() {
  try {
    var properties = PropertiesService.getScriptProperties();
    var url = String(properties.getProperty('TASK_TIMING_SUPABASE_URL') || '').trim();
    var secret = String(properties.getProperty('TASK_TIMING_SUPABASE_SECRET_KEY') || '').trim();
    if (!url) throw new Error('缺少 Script Property：TASK_TIMING_SUPABASE_URL');
    if (!secret) throw new Error('缺少 Script Property：TASK_TIMING_SUPABASE_SECRET_KEY');

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('找不到目前綁定的產品主檔試算表');
    var sheet = spreadsheet.getSheetByName('產品總表');
    if (!sheet) throw new Error('找不到產品主檔工作表：產品總表');

    var data = sheet.getDataRange().getValues();
    if (!data || data.length === 0) throw new Error('產品主檔工作表沒有資料');
    if (data.length < 2) throw new Error('產品主檔工作表只有標題列，沒有產品資料');

    // 產品主檔的欄名可能帶有 [註記]；同步時使用與既有 GAS 讀取一致的乾淨欄名。
    var headers = data[0].map(function (header) {
      return String(header).replace(/\[.*?\]/g, '').trim();
    });
    if (headers.indexOf('品番') === -1) throw new Error('產品主檔缺少必要欄位：品番');

    var products = data.slice(1).map(function (row) {
      return productRowToTaskTimingProduct_(headers, row);
    }).filter(function (product) {
      return product !== null;
    });
    products = dedupeTaskTimingProducts_(products);
    if (products.length === 0) throw new Error('產品主檔沒有任何非空白品番資料');

    var endpoint = url.replace(/\/$/, '') +
      '/rest/v1/task_timing_products?on_conflict=part_number';
    for (var start = 0; start < products.length; start += TASK_TIMING_SYNC_BATCH_SIZE) {
      var batch = products.slice(start, start + TASK_TIMING_SYNC_BATCH_SIZE);
      var response = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          apikey: secret,
          Authorization: 'Bearer ' + secret,
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        payload: JSON.stringify(batch),
        muteHttpExceptions: true,
      });
      var status = response.getResponseCode();
      if (status < 200 || status >= 300) {
        throw new Error('Supabase ' + status + ': ' + response.getContentText());
      }
    }

    SpreadsheetApp.getUi().alert('同步完成：已同步 ' + products.length + ' 筆產品。');
    return products.length;
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    SpreadsheetApp.getUi().alert('同步失敗：' + message);
    throw error;
  }
}
