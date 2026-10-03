# 今日提醒：本機實作與上線步驟

2026-10-03 已建立線上「今日提醒」分頁（gid=10032026）、Supabase task_timing_notice_snapshot 資料表，以及 Apps Script「今日提醒同步.gs」。setupTaskTimingNoticeSync 已執行完成，編輯與每 10 分鐘觸發器已確認存在，首次快照同步成功（0 則）。前端仍未發布。不良統計 RPC 已於本次發布前在線上更新。刪除列的完整線上測試尚未執行。

1. 在 Supabase SQL 編輯器執行 `supabase/task_timing_notices.sql`。不良統計另需更新 `supabase/task_timing_records.sql` 中的 RPC。
2. 將更新後的 `src/google_apps_script.js` 放入原 Apps Script 專案並儲存，沿用既有 Supabase Script Properties。
3. 執行 `setupTaskTimingNoticeSync`，在原組裝紀錄試算表建立「今日提醒」分頁、編輯觸發器及每 10 分鐘重試觸發器。
4. 開始日期必填，結束日期選填（留空代表持續顯示）；日期使用日期儲存格。提醒內容可換行，每則提醒各填一列；啟用欄勾選。另有「越南文」「印尼文」欄，可填人工確認的翻譯；空白時回退中文。保留欄位標題，程式依標題讀取，支援舊版四欄分頁，設定時在末端追加翻譯欄。
5. 修改提醒分頁會同步完整有效資料快照；取消勾選或刪除列會於下一次同步移除提醒。無效的已啟用列會阻止整批同步，保留上次成功快照，可在 Apps Script 執行紀錄查看錯誤並修正。
6. App 讀取 Supabase 的上次成功快照，只顯示當日有效的提醒（開始日含當日，結束日含當日，未填結束日則不限）；App 不顯示日期期間，依所選語言顯示提醒文字；沒有提醒便隱藏區塊。Supabase 讀取失敗會顯示無法讀取狀態，不宣稱沒有提醒。
7. 前端正式發布後，用實際帳號驗證新增、修改、停用、到期及同步失敗重試。此任務未執行 push 或發布。

本機範例：`http://127.0.0.1:5179/TaskTiming/?preview=defects#/battle`。範例資料僅開發模式可用，不寫入任何 Sheet 或 Supabase。
