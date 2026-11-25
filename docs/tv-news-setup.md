# 電視新聞列

新聞僅由 `/tv` 的 TvNews 元件讀取，不經原本報工 GAS，也不讀寫試算表。
每 1 小時取得一次，最多六則，每 20 秒換一則。標題與快取超過 24 小時即隱藏。
未設定服務 URL 時，正式版不顯示新聞，也不發出新聞請求。

## 本機預覽

`npm run dev`，開啟 `/TaskTiming/#/tv?preview=none`（無公告）或 `preview=long`（長公告）。
預覽新聞均明確標示非真實新聞。加 `&news=off` 比較原版比例。

## 獨立服務設定（待正式發布時操作）

1. 新增獨立 Google Apps Script 專案，貼入 `google-apps-script/tv_news_service.gs`。不可貼進報工專案。
2. 程式中的 `FEEDS` 已設定中央社生活、地方、科技 RSS。更換來源時編輯 FEEDS 並重新部署。
3. 部署為 Web App，以擁有者執行並供看板匿名讀取（僅公開新聞資料）。
4. `.env.local` 設定 `VITE_TV_NEWS_URL=https://script.google.com/macros/s/新聞服務部署ID/exec`，重啟 Vite／重新建置。
5. 實際檢查 GAS 重導向後的跨來源讀取、來源抓取、快取與電視顯示，再發布。

服務以 ScriptCache 快取 1 小時，Script Properties 保留最後成功結果，Lock 避免同時重抓。
同一 Google 帳號下的 GAS 專案仍可能共用帳號配額；此架構隔離程式與資料，非帳號配額完全隔離。
沒有定時觸發器，只有看板開啟時按需更新。每螢幕約每日 24 次新聞請求。
GAS 不提供可設定的 UrlFetch timeout；前端 8 秒後放棄等待，後端執行仍受 GAS 自身限制。

## 預設來源

依使用者選擇，程式 FEEDS 採中央通訊社三個 RSS 分類：

- 生活：https://feeds.feedburner.com/rsscna/lifehealth
- 地方：https://feeds.feedburner.com/rsscna/local
- 科技：https://feeds.feedburner.com/rsscna/technology

保留來源原始標題及發布時間，標示「中央通訊社」及分類，不引用全文或圖片。
這是來源設定，並非已取得授權或已確認廠內使用符合條件；使用規範仍以中央社公告為準：
https://www.cna.com.tw/about/rss.aspx

獨立服務已部署並確認回傳六則新聞；正式版服務網址設定於 `.env.production`。
GAS 專案：`1gMlbwG3xtbZVOGkxPCPfNYZrpFTsW5x2ImAoUI7h3_mXmei_GgUgh8U6`。
