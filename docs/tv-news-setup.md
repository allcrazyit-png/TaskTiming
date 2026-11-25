# 電視新聞列（本機完成，尚未部署）

新聞僅由 `/tv` 的 TvNews 元件讀取，不經原本報工 GAS，也不讀寫試算表。
每 1 小時取得一次，最多六則，每 20 秒換一則。標題與快取超過 24 小時即隱藏。
未設定服務 URL 時，正式版不顯示新聞，也不發出新聞請求。

## 本機預覽

`npm run dev`，開啟 `/TaskTiming/#/tv?preview=none`（無公告）或 `preview=long`（長公告）。
預覽新聞均明確標示非真實新聞。加 `&news=off` 比較原版比例。

## 獨立服務設定（待正式發布時操作）

1. 新增獨立 Google Apps Script 專案，貼入 `google-apps-script/tv_news_service.gs`。不可貼進報工專案。
2. 先確認新聞提供者允許工廠看板展示；設定 Script Properties 的 `NEWS_FEEDS`：
   `[{"url":"https://供應者的RSS網址","source":"來源全名"}]`。支援 RSS 2.0，最多三個來源。
   中央社免費 RSS 限個人／非營利非商業使用，未取得適用授權前不要接入：
   https://www.cna.com.tw/about/rss.aspx
   公視展示條件仍待確認，不預設已獲授權。
3. 部署為 Web App，以擁有者執行並供看板匿名讀取（僅公開新聞資料）。
4. `.env.local` 設定 `VITE_TV_NEWS_URL=https://script.google.com/macros/s/新聞服務部署ID/exec`，重啟 Vite／重新建置。
5. 實際檢查 GAS 重導向後的跨來源讀取、來源抓取、快取與電視顯示，再發布。

服務以 ScriptCache 快取 1 小時，Script Properties 保留最後成功結果，Lock 避免同時重抓。
同一 Google 帳號下的 GAS 專案仍可能共用帳號配額；此架構隔離程式與資料，非帳號配額完全隔離。
沒有定時觸發器，只有看板開啟時按需更新。每螢幕約每日 24 次新聞請求。
GAS 不提供可設定的 UrlFetch timeout；前端 8 秒後放棄等待，後端執行仍受 GAS 自身限制。
