function doGet(e) {
    var ssId = '1YSOI1VPh4GBYkr7QVx60YOxtrfpC4JofuXOy_dyPHaQ';
    var sheetName = e.parameter.sheet;
    var sheetIndex = e.parameter.index;
    var useActive = e.parameter.useActive === 'true';

    var includeCol = e.parameter.includeCol; // e.g., "類別"
    var filterVal = e.parameter.filterVal;   // e.g., "組裝"
    var prune = e.parameter.prune;           // e.g., "組裝記錄表|組裝紀錄表"

    var ss;
    if (useActive) {
        ss = SpreadsheetApp.getActiveSpreadsheet();
    } else {
        ss = SpreadsheetApp.openById(ssId);
    }

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
        if (filterIdx !== -1 && filterVal) {
            if (String(data[i][filterIdx]).indexOf(filterVal) === -1) continue;
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
            data.operator || "", data.carModel || "", data.partNumber || "", data.productName || "",
            data.date || "", data.startTime || "", data.endTime || "", data.totalTime || "",
            data.avgTime || "", data.standardTime || 0, data.goodCount || 0, data.missing || 0,
            data.damage || 0, data.appearance || 0, data.others || 0, data.totalScrap || 0,
            data.remarks || "", data.scrapRate || "", data.yieldRate || "", data.efficiency || ""
        ];
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName("紀錄") || ss.getSheets()[0];
        sheet.appendRow(rowData);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "row": sheet.getLastRow() })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": error.toString() })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}
