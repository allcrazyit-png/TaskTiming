# TaskTiming 維護手冊

最後更新：2026-08-12

## 資料分工

| 資料 | 維護來源 | 網站使用來源 |
| --- | --- | --- |
| 產品主檔 | Google Sheet「產品總表」 | Supabase `task_timing_products` |
| 員工姓名與編號 | Google Sheet「員工資料」 | Supabase `task_timing_employees` |
| 員工密碼 | Google Sheet「員工資料」的「密碼」欄 | Supabase Auth |
| 組裝作業紀錄 | 網站上傳至 Google Apps Script | Google Sheet「組裝紀錄」 |

Sheet 是產品與員工資料的人工維護主檔；Supabase 是網站快速讀取的鏡像與登入服務。

## 日常操作

### 修改或新增員工

1. 在 Google Sheet「員工資料」修改員工編號、姓名或密碼。
2. 新增員工與要變更密碼的員工，密碼必須至少 6 碼。
3. 從試算表選單執行「同步員工資料到 Supabase」。
4. 確認同步結果沒有失敗員工編號。
5. 用一位安全的測試員工在網站確認新密碼可登入，舊密碼不可登入。

### 修改產品

1. 在 Google Sheet「產品總表」修改產品資料。
2. 從試算表選單執行產品同步。
3. 確認同步完成後重新整理網站，產品清單會由 Supabase 讀取。

## 網站何時使用 Google Sheet

| 功能 | 是否讀寫 Sheet | 說明 |
| --- | --- | --- |
| 首頁 | 否 | 產品、員工讀 Supabase；最近上傳時間讀本機瀏覽器資料。 |
| 員工登入 | 否 | 由 Supabase Auth 驗證密碼。 |
| 上傳作業 | 寫入 | 經 Google Apps Script 寫入組裝紀錄。 |
| 戰報 | 讀取 | 讀取組裝紀錄最近 3,000 筆。 |
| 員工同步 | 讀取 | 手動執行時讀「員工資料」並寫入 Supabase。 |
| 產品同步 | 讀取 | 手動執行時讀「產品總表」並寫入 Supabase。 |

### 首頁最近上傳提示

首頁的「最近上傳」只使用該手機瀏覽器保存的最近 30 筆上傳紀錄。

- 顯示「最近上傳：今天 HH:mm」或日期與時間。
- 換手機、清除瀏覽器資料，或從另一台裝置上傳時，這個提示不會反映舊紀錄。
- 這是刻意的效能設計：首頁不會為此讀取組裝紀錄 Sheet。

## 安全規則

- 員工密碼不得放入 Supabase 公開資料表、前端程式或 localStorage。
- 網站只把登入時輸入的密碼交給 Supabase Auth 驗證。
- `task_timing_employees` 只提供員工編號與姓名給網站讀取。
- 不要在 Git、Sheet 註解、螢幕截圖或聊天訊息記錄 Supabase service role key。

## 發布與部署

| 類型 | 必要動作 |
| --- | --- |
| React 網站程式修改 | 執行 `npm run deploy`，發布至 GitHub Pages。 |
| Apps Script 同步程式修改 | 手動貼入 Google Apps Script、儲存，並依 Web App 設定重新部署。 |
| Sheet 資料修改 | 執行對應的員工或產品同步選單。 |

GitHub Pages 部署不會更新 Apps Script；Apps Script 儲存或部署也不會更新網站。這兩件事必須分開完成。

## 版本紀錄

| 版本 | 重點 |
| --- | --- |
| 1.14.0 | 產品與員工名單改由 Supabase 讀取；員工密碼改由 Supabase Auth 驗證。 |
| 1.14.1 | 首頁停止讀取組裝紀錄 Sheet，改顯示手機本機的最近上傳時間。 |

## 異常排查

| 現象 | 優先檢查 |
| --- | --- |
| Sheet 改了員工／產品，網站沒變 | 是否已執行對應 Supabase 同步。 |
| 員工無法登入 | 密碼是否至少 6 碼、同步是否成功、是否輸入正確員工編號的密碼。 |
| 首頁沒有最近上傳 | 該手機可能沒有此員工的本機上傳紀錄；不代表 Sheet 沒有紀錄。 |
| 戰報載入慢 | 戰報會讀取 Sheet 最近 3,000 筆紀錄，先檢查 GAS 與 Sheet 回應。 |
| 網站沒出現程式更新 | 確認已執行 GitHub Pages deploy，並重新整理或清除瀏覽器快取。 |
