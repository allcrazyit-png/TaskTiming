# TaskTiming 員工資料 Supabase 同步設計

## 目標

將首頁的員工名單與登入驗證從 Google Apps Script 改為 Supabase，降低首頁受 GAS 延遲影響的風險。Google Sheet 的 `員工資料` 保持唯一可編輯來源。

## 資料流

1. 管理者在 Google Sheet 的 `員工資料` 修改員工編號、姓名或密碼。
2. 新增或修改員工時，管理者從試算表選單執行「同步員工資料到 Supabase」；刪除員工整列時，由安裝型刪除列觸發器自動同步。
3. Apps Script 讀取 `員工資料`，將可顯示資料寫入 `public.task_timing_employees`，並以 Supabase Auth Admin API 建立、更新或刪除對應登入帳號及密碼。
4. 網站由 Supabase 讀取員工編號與姓名；作業員輸入密碼時，網站使用 Supabase Auth 驗證。

## 資料模型與安全性

`public.task_timing_employees` 僅保存：

- `employee_id`（主鍵）
- `employee_name`
- `auth_user_id`
- `source_updated_at`
- `synced_at`

該表允許匿名唯讀，供首頁顯示名單。密碼不寫入此表，也不由前端下載。

每位員工在 Supabase Auth 有一個帳號；以衍生的內部識別字串（員工編號）作為登入對應。Apps Script 以保存在 Script Properties 的 Supabase secret key 呼叫 Admin API 建立或更新帳號密碼。secret key 不放入前端、Git 或 Sheet 儲存格。

## 同步規則

- 以員工編號作為穩定識別值。
- Sheet 中有員工編號與姓名的列才會同步。
- Sheet 密碼欄有值時，更新 Supabase Auth 密碼；空白時不覆寫既有密碼。
- 同步採批次處理，單筆錯誤需回報員工編號並避免靜默略過。
- 同步完成後顯示建立、更新、刪除、失敗的筆數。
- Sheet 是員工名單的唯一來源；Supabase 中已不在 Sheet 的員工會從公開名單與 Auth 帳號刪除。
- 在 `員工資料` 刪除整列時，安裝型 `onChange` 觸發器會自動執行完整比對與刪除，不顯示確認對話框。
- 手動同步仍保留精確刪除數量與確認對話框，供維護與補救使用。
- 若誤刪，可在 Sheet 加回同一員工編號、姓名及密碼後重新同步，系統會重建 Auth 帳號與公開名單。
- 任一新增或更新失敗時，本次不執行刪除，避免部分同步後誤刪。

## 網站行為

- 首頁啟動時由 Supabase 載入員工名單，並維持 localStorage 快取作為離線或暫時失敗時的顯示備援。
- 選定員工後，輸入的密碼只送往 Supabase Auth 驗證。
- 登入成功後仍使用既有 `savedOperatorId` 與頁面流程，不改動作業紀錄上傳至 GAS 的功能。
- 員工清單或登入驗證失敗時，顯示明確可重試訊息，不能誤判為登入成功。

## 驗證

- 單元測試：員工資料列映射、空白密碼不覆寫、登入帳號識別轉換。
- Apps Script 測試：同步程式包含正確工作表、欄位正規化與 Auth Admin API 呼叫契約。
- 建置驗證：`npm test`、`npm run build`、`git diff --check`。
- 實際驗證：在 Sheet 修改一名測試員工姓名與密碼後同步，確認 Supabase 名單更新、舊密碼失效、新密碼可登入；不將真實密碼顯示在測試紀錄中。

## 範圍外

- 不遷移既有組裝紀錄讀寫；它仍由 GAS 與 Google Sheet 處理。
- 不提供網站內的管理者改密碼頁面；密碼僅在 Sheet 修改後同步。
- 不因一般儲存格編輯自動刪除帳號；只有「刪除整列」事件會啟動自動刪除。
