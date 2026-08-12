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

// Supabase 以「品番＋類別」辨識一筆產品，所以比對與去重都用這組配對。
function taskTimingProductKey_(product) {
  return product.part_number + '\u0000' + product.category;
}

function dedupeTaskTimingProducts_(products) {
  var seenKeys = {};
  var uniqueProducts = [];
  for (var index = products.length - 1; index >= 0; index--) {
    var product = products[index];
    var key = taskTimingProductKey_(product);
    if (seenKeys[key]) continue;
    seenKeys[key] = true;
    uniqueProducts.push(product);
  }
  return uniqueProducts.reverse();
}

function taskTimingPrepareAssemblyProducts_(rows) {
  var nonEmpty = rows.filter(function (product) { return product !== null; });
  var injectionCount = nonEmpty.filter(function (product) {
    return product.category === '射出';
  }).length;
  var assemblyRows = nonEmpty.filter(function (product) {
    return product.category !== '射出';
  });
  return {
    products: dedupeTaskTimingProducts_(assemblyRows),
    injectionCount: injectionCount,
    sourceCount: nonEmpty.length,
  };
}

function taskTimingObsoleteProducts_(existingRows, currentProducts) {
  var currentKeys = {};
  currentProducts.forEach(function (product) {
    currentKeys[taskTimingProductKey_(product)] = true;
  });
  return existingRows.map(function (row) {
    return {
      part_number: String(row.part_number || '').trim(),
      category: String(row.category || ''),
    };
  }).filter(function (product) {
    return product.part_number && !currentKeys[taskTimingProductKey_(product)];
  });
}

function taskTimingReadSupabaseProductPartNumbers_(baseUrl, secret) {
  var response = UrlFetchApp.fetch(baseUrl + '/rest/v1/task_timing_products?select=part_number,category', {
    method: 'get',
    headers: {
      apikey: secret,
      Authorization: 'Bearer ' + secret,
    },
    muteHttpExceptions: true,
  });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('讀取 Supabase 產品失敗 ' + status + ': ' + response.getContentText());
  }
  var rows = JSON.parse(response.getContentText());
  if (!Array.isArray(rows)) throw new Error('讀取 Supabase 產品失敗：回應不是陣列');
  return rows;
}

function taskTimingDeleteSupabaseProduct_(baseUrl, secret, product) {
  var response = UrlFetchApp.fetch(
    baseUrl + '/rest/v1/task_timing_products?part_number=eq.' + encodeURIComponent(product.part_number)
      + '&category=eq.' + encodeURIComponent(product.category),
    {
      method: 'delete',
      headers: {
        apikey: secret,
        Authorization: 'Bearer ' + secret,
      },
      muteHttpExceptions: true,
    },
  );
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('刪除 Supabase 舊產品失敗 ' + product.part_number + '／' + product.category
      + ' ' + status + ': ' + response.getContentText());
  }
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

    var prepared = taskTimingPrepareAssemblyProducts_(data.slice(1).map(function (row) {
      return productRowToTaskTimingProduct_(headers, row);
    }));
    var products = prepared.products;
    var skippedDuplicates = prepared.sourceCount - prepared.injectionCount - products.length;
    if (products.length === 0) throw new Error('產品主檔沒有任何非射出的品番資料');

    var baseUrl = url.replace(/\/$/, '');
    var endpoint = baseUrl +
      '/rest/v1/task_timing_products?on_conflict=part_number,category';
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

    var existingRows = taskTimingReadSupabaseProductPartNumbers_(baseUrl, secret);
    var obsoleteProducts = taskTimingObsoleteProducts_(existingRows, products);
    obsoleteProducts.forEach(function (product) {
      taskTimingDeleteSupabaseProduct_(baseUrl, secret, product);
    });

    var result = {
      synced: products.length,
      skippedInjection: prepared.injectionCount,
      skippedDuplicates: skippedDuplicates,
      deleted: obsoleteProducts.length,
    };
    SpreadsheetApp.getUi().alert(
      '同步完成：已同步 ' + result.synced + ' 筆產品，略過 ' + result.skippedInjection
        + ' 筆射出、' + result.skippedDuplicates + ' 筆重複，刪除 ' + result.deleted + ' 筆舊產品。',
    );
    return result;
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    SpreadsheetApp.getUi().alert('同步失敗：' + message);
    throw error;
  }
}
