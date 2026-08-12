# TaskTiming 員工資料 Supabase 同步設計

## 目標

將首頁的員工名單與登入驗證從 Google Apps Script 改為 Supabase，降低首頁受 GAS 延遲影響的風險。Google Sheet 的 `員工資料` 保持唯一可編輯來源。

## 資料流

1. 管理者在 Google Sheet 的 `員工資料` 修改員工編號、姓名或密碼。
2. 管理者從試算表選單執行「同步員工資料到 Supabase」。
3. Apps Script 讀取 `員工資料`，將可顯示資料寫入 `public.task_timing_employees`，並以 Supabase Auth Admin API 建立或更新對應登入帳號及密碼。
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
- 同步完成後顯示建立、更新、失敗的筆數。
- 此階段不會自動刪除 Supabase 中已不在 Sheet 的帳號，避免誤刪造成員工無法登入；離職停用另行處理。

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
- 不自動刪除或停用離職員工帳號。
