function doGet(e) {
    var ssId = '1YSOI1VPh4GBYkr7QVx60YOxtrfpC4JofuXOy_dyPHaQ';
    var sheetName = e.parameter.sheet;
    var sheetIndex = e.parameter.index;
    var useActive = e.parameter.useActive === 'true';

    // === 新增優化參數 ===
    var includeCol = e.parameter.includeCol; // 必須包含的關鍵字 (用於行篩選，例如 "類別")
    var filterVal = e.parameter.filterVal;   // 篩選的值 (例如 "組裝")
    var prune = e.parameter.prune;           // 只保留標題包含此字串的欄位 (例如 "[組裝記錄表]")
    var strip = e.parameter.strip;           // 標題中要刪除的字串 (例如 "[組裝記錄表]")
    // ================

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

    // 找出篩選欄位的索引
    var filterIdx = -1;
    if (includeCol) {
        for (var h = 0; h < headers.length; h++) {
            if (headers[h].indexOf(includeCol) !== -1) {
                filterIdx = h;
                break;
            }
        }
    }

    for (var i = 1; i < data.length; i++) {
        // 1. 行篩選 logic (伺服器端過濾掉不相關的資料)
        if (filterIdx !== -1 && filterVal) {
            if (String(data[i][filterIdx]).indexOf(filterVal) === -1) continue;
        }

        var obj = {};
        var hasContent = false;
        for (var j = 0; j < headers.length; j++) {
            var originalHeader = headers[j];

            // 2. 欄位裁剪 (Pruning) - 改為支援多種模式或模糊比對
            var isMatch = false;
            var finalHeader = originalHeader;

            if (prune) {
                // 支援用 | 分隔多個模式，例如 "記錄|紀錄"
                var patterns = prune.split('|');
                for (var p = 0; p < patterns.length; p++) {
                    if (originalHeader.indexOf(patterns[p]) !== -1) {
                        isMatch = true;
                        // 如果有 strip，則一併清除所有匹配的模式
                        if (strip) {
                            var stripPatterns = strip.split('|');
                            for (var s = 0; s < stripPatterns.length; s++) {
                                finalHeader = finalHeader.replace(stripPatterns[s], "");
                            }
                            finalHeader = finalHeader.trim();
                        }
                        break;
                    }
                }
            } else {
                isMatch = true; // 沒有指定 prune 則全拿
            }

            if (!isMatch) continue;

            obj[finalHeader] = data[i][j];
            hasContent = true;
        }

        // 額外的安全性檢查 (針對此 App)：必須有品番和車型才回傳
        if (hasContent && obj['品番'] && obj['車型']) {
            jsonArray.push(obj);
        } else if (hasContent && !prune) {
            // 如果沒有開啟 pruning，則照舊回傳
            jsonArray.push(obj);
        }
    }

    return ContentService.createTextOutput(JSON.stringify(jsonArray))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    // 啟用鎖定機制，防止多人同時上傳時發生寫入衝突
    var lock = LockService.getScriptLock();

    try {
        // 最多等待 10 秒鐘取得鎖定
        lock.waitLock(10000);
    } catch (e) {
        // 如果 10 秒內等不到，回傳系統忙碌錯誤
        return ContentService.createTextOutput(JSON.stringify({
            "result": "error",
            "message": "系統目前有較多人在上傳資料，請稍後再試一次。"
        })).setMimeType(ContentService.MimeType.JSON);
    }

    try {
        // 1. 取得並解析傳入的 JSON 資料
        var data = JSON.parse(e.postData.contents);

        // 2. 定義欄位順序 (必須與前端傳送的 key 一致，或在此重組)
        var rowData = [
            data.operator || "",          // 1. 作業者
            data.carModel || "",          // 2. 車型
            data.partNumber || "",        // 3. 品番
            data.productName || "",       // 4. 產品中文名稱
            data.date || "",              // 5. 日期 (NEW)
            data.startTime || "",         // 6. 開始時間
            data.endTime || "",           // 7. 結束時間
            data.totalTime || "",         // 8. 總時間
            data.avgTime || "",           // 9. 平均組裝時間
            data.standardTime || 0,       // 10. 標準組裝秒數
            data.goodCount || 0,          // 11. 良品數量
            data.missing || 0,            // 12. 缺料
            data.damage || 0,             // 13. 撞(刮)傷
            data.appearance || 0,         // 14. 外觀不良
            data.others || 0,             // 15. 其他
            data.totalScrap || 0,         // 16. 報廢數量
            data.remarks || "",           // 17. 備註
            data.scrapRate || "",         // 18. 不良率
            data.yieldRate || "",         // 19. 良品率
            data.efficiency || ""         // 20. 效率值
        ];

        // 3. 寫入 Google Sheet (維持原本設定)
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName("紀錄") || ss.getSheets()[0];
        sheet.appendRow(rowData);

        // 強制立即將資料更新到試算表上
        SpreadsheetApp.flush();

        // 4. 回傳成功訊息
        return ContentService.createTextOutput(JSON.stringify({
            "result": "success",
            "row": sheet.getLastRow()
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        // 5. 回傳錯誤訊息
        return ContentService.createTextOutput(JSON.stringify({
            "result": "error",
            "message": error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        // 6. 無論成功或失敗，最後一定要釋放鎖定，讓下一個人寫入
        lock.releaseLock();
    }
}

