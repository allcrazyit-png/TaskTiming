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

        // 3. 寫入 Google Sheet
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
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
