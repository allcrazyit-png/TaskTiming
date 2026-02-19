function doPost(e) {
    try {
        // 1. 取得並解析傳入的 JSON 資料
        var data = JSON.parse(e.postData.contents);

        // 2. 定義欄位順序 (必須與前端傳送的 key 一致，或在此重組)
        // 前端預計傳送: 
        // operator, carModel, partNumber, carName, productName, 
        // startTime, endTime, totalTime, 
        // goodCount, missing, damage, appearance, others, 
        // totalScrap, remarks

        var rowData = [
            data.operator || "",          // 作業者
            data.carModel || "",          // 車型
            data.partNumber || "",        // 品番
            data.carName || "",           // 中文名稱 (目前與車型相同或自訂)
            data.productName || "",       // 產品中文名稱
            data.startTime || "",         // 開始時間
            data.endTime || "",           // 結束時間
            data.totalTime || "",         // 總時間
            data.goodCount || 0,          // 良品數量
            data.missing || 0,            // 缺料
            data.damage || 0,             // 撞(刮)傷
            data.appearance || 0,         // 外觀不良
            data.others || 0,             // 其他
            data.totalScrap || 0,         // 報廢數量
            data.remarks || ""            // 備註
        ];

        // 3. 寫入 Google Sheet
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        sheet.appendRow(rowData);

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
    }
}
