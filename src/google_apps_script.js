const PRODUCTS_SS_ID = '1YSOI1VPh4GBYkr7QVx60YOxtrfpC4JofuXOy_dyPHaQ'; // 產品資料表 (讀)
const RECORDS_SS_ID = '1xo4YhDuxh-wpstg7tmAqW4orB9aBheF1CUFzM1TDWKw';  // 組裝紀錄表 (寫)

function doGet(e) {
    // action=records → 讀紀錄表；其他 → 讀產品資料表
    var ssId = (e.parameter.action === 'records') ? RECORDS_SS_ID : PRODUCTS_SS_ID;

    var sheetName = e.parameter.sheet;
    var sheetIndex = e.parameter.index;
    var includeCol = e.parameter.includeCol;
    var filterVal = e.parameter.filterVal;
    var excludeVal = e.parameter.excludeVal;
    var prune = e.parameter.prune;

    var ss = SpreadsheetApp.openById(ssId);

    var sheet;
    if (sheetName) {
        sheet = ss.getSheetByName(sheetName);
    } else if (sheetIndex !== undefined) {
        sheet = ss.getSheets()[parseInt(sheetIndex)];
    } else {
        sheet = ss.getSheets()[0];
    }

    if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "找不到工作表" })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var jsonArray = [];

    // 1. 找出篩選欄位的索引 (不分括號)
    var filterIdx = -1;
    if (includeCol) {
        for (var h = 0; h < headers.length; h++) {
            var cleanH = headers[h].replace(/\[.*?\]/g, "").trim();
            if (cleanH.indexOf(includeCol) !== -1 || headers[h].indexOf(includeCol) !== -1) {
                filterIdx = h;
                break;
            }
        }
    }

    for (var i = 1; i < data.length; i++) {
        // 2. 篩選
        if (filterIdx !== -1) {
            var cellValue = String(data[i][filterIdx]);
            // 包含邏輯
            if (filterVal && cellValue.indexOf(filterVal) === -1) continue;
            // 排除邏輯
            if (excludeVal && cellValue.indexOf(excludeVal) !== -1) continue;
            // 如果欄位完全是空的 (非作業性內容)，也排除 (可選)
            if (!cellValue.trim()) continue;
        }

        var obj = {};
        var hasKeyData = false;
        for (var j = 0; j < headers.length; j++) {
            var originalHeader = headers[j];

            // 3. 欄位裁剪 (Pruning)
            var isMatch = false;
            if (prune) {
                var patterns = prune.split('|');
                for (var p = 0; p < patterns.length; p++) {
                    if (originalHeader.indexOf(patterns[p]) !== -1) {
                        isMatch = true;
                        break;
                    }
                }
            } else {
                isMatch = true;
            }

            if (!isMatch) continue;

            // 4. 清理標題 (自動移除 [] 中括號內容) ── 這是修復關鍵：確保 key 是 "品番" 而不是 "[] 品番"
            var cleanHeader = originalHeader.replace(/\[.*?\]/g, "").trim();
            obj[cleanHeader] = data[i][j];
            hasKeyData = true;
        }

        // 5. 檢查關鍵欄位是否存在
        if (hasKeyData && obj['品番'] && obj['車型']) {
            jsonArray.push(obj);
        } else if (hasKeyData && !prune) {
            jsonArray.push(obj);
        }
    }

    // 調試模式：如果沒找到任何產品，回傳前 15 個欄位名稱供研究
    if (jsonArray.length === 0 && prune) {
        return ContentService.createTextOutput(JSON.stringify({
            "result": "debug",
            "message": "找不到符合條件的產品",
            "detected_headers": headers.slice(0, 15),
            "clean_headers": headers.slice(0, 15).map(function (h) { return h.replace(/\[.*?\]/g, "").trim(); })
        })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify(jsonArray))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000);
        var data = JSON.parse(e.postData.contents);
        var rowData = [
            data.operator || "", 
            data.carModel || "", 
            data.category || "",      // 新增類別欄位
            data.partNumber || "", 
            data.productName || "",
            data.date || "", 
            data.startTime || "", 
            data.endTime || "", 
            data.totalTime || "",
            data.avgTime || "", 
            data.standardTime || 0, 
            data.goodCount || 0, 
            data.missing || 0,
            data.deform || 0,
            data.appearance || 0, 
            data.others || 0, 
            data.totalScrap || 0,
            data.remarks || "", 
            data.scrapRate || "", 
            data.yieldRate || "", 
            data.efficiency || "",
            data.satisfaction || 0    // 滿意度
        ];
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName("紀錄") || ss.getSheets()[0];
        sheet.appendRow(rowData);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "row": sheet.getLastRow() })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "找不到工作表" })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

// 固定 CSV 欄位名稱，對應 doPost 寫入順序，不隨資料內容變動
const CSV_HEADERS = [
  '作業員', '車型', '類別', '品番', '品名',
  '日期', '開始時間', '結束時間', '總時間', '平均時間',
  '標準工時', '良品數', '缺料數', '變形數', '外觀異常數',
  '其他報廢數', '總報廢數', '備註', '報廢率', '良率', '效率', '滿意度'
];

function sendAdvancedSummaryEmail() {
  const recordSS = SpreadsheetApp.openById(RECORDS_SS_ID);
  const recordSheet = recordSS.getSheets()[0];
  const recordData = recordSheet.getDataRange().getValues();

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 1);
  const targetDateSlash = Utilities.formatDate(targetDate, "GMT+8", "yyyy/MM/dd");
  const targetDateDash  = Utilities.formatDate(targetDate, "GMT+8", "yyyy-MM-dd");

  const formatCsvValue = (v) => {
    if (v instanceof Date) {
      const hasTime = v.getHours() !== 0 || v.getMinutes() !== 0 || v.getSeconds() !== 0;
      v = hasTime
        ? Utilities.formatDate(v, 'GMT+8', 'HH:mm:ss')
        : Utilities.formatDate(v, 'GMT+8', 'yyyy/MM/dd');
    }
    const s = v == null ? '' : String(v);
    return /["\r\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const yesterdayRecords = recordData.slice(1).filter(row => {
    const rowDate = row[5] instanceof Date
      ? Utilities.formatDate(row[5], "GMT+8", "yyyy/MM/dd")
      : row[5];
    return rowDate === targetDateSlash;
  });

  const csvLines = [CSV_HEADERS.map(formatCsvValue).join(',')];
  yesterdayRecords.forEach(row => {
    csvLines.push(row.slice(0, CSV_HEADERS.length).map(formatCsvValue).join(','));
  });
  // 加上 UTF-8 BOM，避免用 Excel 開啟時中文亂碼
  const csvContent = '﻿' + csvLines.join('\r\n');

  const fileName = `assembly_report_${targetDateDash}.csv`;
  const csvBlob = Utilities.newBlob(csvContent, 'text/csv;charset=UTF-8', fileName);

  const body = [
    `REPORT_DATE=${targetDateSlash}`,
    `ROW_COUNT=${yesterdayRecords.length}`,
    `CSV_ATTACHED=YES`
  ].join('\n');

  GmailApp.sendEmail(
    "allcrazy.it@gmail.com",
    `【組裝日報CSV】${targetDateSlash}`,
    body,
    { attachments: [csvBlob] }
  );
}

// 輔助函式 (修正 Google Sheet 時間格式解析，解決 NaN 問題)
function formatSeconds(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  return h > 0 ? `${h}小時 ${m}分` : `${m}分鐘`;
}
function getTimeGapInMinutes(e, s) {
  if(!e || !s) return 0; 
  if(e instanceof Date && s instanceof Date) return (s.getTime() - e.getTime()) / 60000;
  const p = (t) => { 
    if(t instanceof Date) return t.getHours()*60 + t.getMinutes();
    if(typeof t === 'number') return Math.round(t * 24 * 60);
    const x = String(t).split(':').map(Number); 
    return x[0]*60 + x[1]; 
  }; 
  return p(s)-p(e); 
}



