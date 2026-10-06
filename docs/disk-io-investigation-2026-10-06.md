# Supabase IO 通知追查（2026-10-06）

## 已確認

- 免費方案 Nano；Database Health 顯示資料庫約 0.04 GB，部分 IO 圖表無法載入，因此未確認 IO Budget 剩餘值或告警主因。
- 近期約一小時內 35 次 `23505`：Apps Script POST `task_timing_records?on_conflict=record_id` 回傳 409。
- Sheet「工作表1」7460、7461 列的固定 ID，在 Supabase 中仍標示為 7462、7463。相同 ID 的產品、日期、數量一致，但位置相差兩列。
- Sheet 7462、7463 是另兩笔新紀錄，標示「待重試」；在 Supabase 以這兩個新 ID 查詢未找到資料。這證明是列號位置衝突，並非同一筆紀錄重複上傳。移動位置的實際操作／時間尚未確認。
- 補同步只要 remaining > 0 就建立一分鐘 continuation；即使 409 失敗也會重排，形成無效重試。
- 日誌有約每分鐘一次 Auth refresh 400；提醒 hook 的刷新失敗不更新 TTL，會繼續重試。未確認所有 Auth 400 都來自這個 hook。
- Query Performance 使用 pg_stat_statements 累計統計；不得把顯示次數解讀為過去 24 小時次數。

## 本地修正

1. 保留固定 record_id 主鍵；移除可變動來源列號的 UNIQUE 限制。以 migration 修復既有專案，不刪除或覆蓋紀錄，也不變更 RLS。
2. 補同步開始時清除舊 continuation；第一批寫入失敗後停止當次批次。只有全部已處理批次成功時才快速繼續，失敗資料交給原有十分鐘排程重試。
3. 提醒 hook 確認登入失效後停止當次掛載的輪詢請求，保留原有提醒快取與閱讀狀態。重新登入／重新掛載後可以重試。

## 上線與驗收順序（尚未執行）

1. 在 Supabase 執行 `supabase/migrations/20261006_record_identity.sql`，核對 record_id 主鍵仍存在且列號 UNIQUE 已移除。
2. 發布 Apps Script 修正，並確認定期同步觸發器存在。GitHub Pages 的前端修正依 repo 規則取得 push 授權後發布。
3. 等候或手動執行一次非刪除型同步 `syncTaskTimingRecordsToSupabase`。不要為了補兩筆資料執行帶刪除功能的完整 reconciliation。
4. 核對 Sheet 7462、7463 變成「已同步」，Supabase 存在相同 ID、產品、日期與數量。
5. 確認沒有持續 409 或登入失效輪詢。已開啟的舊前端需要更新／重新登入。
6. 再查看 IO 曲線；只有負載仍高且有監控證據時才評估主機升級。

## 限制

列號位置仍可能在 Sheet 移動後落後；本次修正處理寫入阻塞，沒有做全部歷史重寫。Supabase 中只剩 Sheet 已刪除紀錄的情況仍由現有 reconciliation 處理，必須另外核對，不能因 IO 告警直接刪除。
