# 組裝報表產品主檔 Supabase 鏡像設計

## 目標

讓組裝報表首頁與產品選擇改由 Supabase 快速讀取產品主檔，保留 Google Sheet 作為唯一維護來源，且不改變既有作業紀錄寫入 Google Sheet 的流程。

## 範圍

- 新增 `task_timing_products`，存放產品主檔的完整鏡像。
- 產品主檔 Google Sheet 以手動選單執行全量同步。
- 網站的產品清單僅查詢 `task_timing_products`，在前端排除 `類別 = 射出` 的產品。
- 保留既有 `products` 表與其射出用途，不讀取、不寫入、不變更它。
- 保留員工登入、作業紀錄上傳、戰報讀取的既有 GAS/Sheet 流程。

## 資料契約

每一筆鏡像以 `part_number`（產品主檔的 `品番`）唯一識別，並至少包含：

| Sheet 欄位 | Supabase 欄位 |
| --- | --- |
| 品番 | `part_number` |
| 品名 | `product_name` |
| 車型 | `car_model` |
| 類別 | `category` |
| CT時間(秒) | `ct_time_seconds` |
| 產品圖片 | `product_image` |

同步程式必須保留所有產品（包含射出）並以品番 upsert。前端只有在讀取後才排除射出產品，因此未來可重用同一份鏡像資料。

## 同步與錯誤處理

Apps Script 的自訂選單提供手動全量同步。同步完成時顯示成功筆數；失敗時顯示錯誤，並且不清除 Supabase 既有資料。後端密鑰只從 Apps Script Script Properties 讀取，不放進前端或版本控制檔案。

## 網站行為

`Home.jsx` 用 Supabase 的公開讀取金鑰請求 `task_timing_products`。回傳資料會轉換成目前元件使用的中文欄位名稱，以維持篩選、最愛、圖片與 CT 作業時間計算的既有行為。若 Supabase 暫時失敗，沿用現有 localStorage 快取；不再回退成重新讀取產品主檔 Sheet。

## 驗收條件

1. 手動同步後，`task_timing_products` 的完整產品資料與 Sheet 對應欄位一致。
2. 組裝首頁可使用 Supabase 資料顯示非射出產品，且品番、品名、車型、CT、圖片與現有流程相同。
3. `products`、作業紀錄 Sheet、戰報與員工讀取流程均未被變更。
4. Supabase 讀取失敗時，已存在的產品快取仍可讓首頁使用。
