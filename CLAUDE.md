# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git 工作流程

所有變更預設只在本地進行。**除非使用者明確說「push」，否則不得執行 `git push` 或 `npm run deploy`。**

## 常用指令

```bash
npm run dev        # 啟動開發伺服器（Vite HMR）
npm run build      # 正式建置 → 輸出至 dist/
npm run lint       # 執行 ESLint
npm run preview    # 本機預覽正式建置結果
npm run deploy     # 建置並發布至 GitHub Pages（gh-pages -d dist）
```

應用程式部署於 GitHub Pages：`https://allcrazyit-png.github.io/TaskTiming/`。`vite.config.js` 中的 `base` 設為 `/TaskTiming/`，必須與 repo 名稱一致。

`app.py` 是一個 Streamlit 包裝器，透過 iframe 嵌入 GitHub Pages 網址，與 React 建置流程無關。

## 架構

這是一個行動裝置優先的 React SPA（無 TypeScript），使用 React Router v7 的 `HashRouter`。頁面間的所有資料均透過 `react-router-dom` 的 `location.state` 傳遞，沒有全域狀態管理。

### 頁面流程

```
Home (/) → Input (/input) → Confirm (/confirm) → 回到 Home
               ↓
        BattleReport (/battle)  ← 可從底部導覽列進入
```

### 資料來源 — Google Apps Script (GAS)

所有後端讀寫均透過一個 GAS Web App URL，分別硬編碼於 `Home.jsx`、`Confirm.jsx`、`BattleReport.jsx`：

```
https://script.google.com/macros/s/AKfycbwHcmD5y.../exec
```

GAS 原始碼存於 `src/google_apps_script.js`（僅供參考，實際部署需在 Google Apps Script 編輯器中操作）。它代理兩個 Google Sheets：

- **產品資料表**（`PRODUCTS_SS_ID`）：透過 `?index=0&includeCol=類別&excludeVal=射出` 查詢，回傳產品目錄（車型、品番、品名、CT時間、產品圖片、類別）
- **組裝紀錄表**（`RECORDS_SS_ID`）：透過 `?action=records&sheet=紀錄` 查詢，儲存提交的作業紀錄；BattleReport 也從此表讀取當日資料
- **員工資料表**：透過 `?sheet=員工資料` 查詢，回傳員工清單（員工編號、姓名、密碼）

### 產品圖片

產品圖片存放於 `public/`，路徑為 `BASE_URL + 檔名`（例如 `/TaskTiming/55514-02340_main.jpg`）。試算表的 `產品圖片` 欄位只儲存純檔名；`dist/` 在建置時會複製相同的圖片。

### 雙穴零件

品番中包含 `_N` 格式（例如 `53827_8-02280`）的為雙穴零件，代表同一模具同時生產左右兩件。`Input.jsx` 會偵測此格式並顯示三種作業模式：

- **單做 R 邊**：作業員本次只生產 R 邊零件。良品數、報廢數各自獨立記錄，品番自動改為 R 邊品番（例如 `53827-02280`）。
- **單做 L 邊**：作業員本次只生產 L 邊零件。品番自動改為 L 邊品番（例如 `53828-02280`）。
- **左右同時做**：雙穴模式，R 邊與 L 邊的良品數及各類報廢數分開輸入。送出時**拆成兩筆**分別寫入 Google Sheets（R 邊一筆、L 邊一筆），品番各自替換為 R/L 邊品番，名稱加上「(R邊)」/「(L邊)」後綴。作業時間按 R/L 良品數的比例分攤。

品番解析規則：取 `_` 前的尾端數字作為 R 邊序號，+1 為 L 邊序號（例如 `53827_8-02280` → R: `53827-02280`、L: `53828-02280`）。

### localStorage 鍵值

- `savedOperatorId` — 跨頁面保留登入狀態
- `uploadHistory_<operatorId>` — 最近 30 筆已上傳紀錄的陣列（於 Confirm 頁寫入）
- `favoriteProducts_<operatorId>` — `"品番|類別"` 字串陣列
- `appTheme` — `'system'` | `'light'` | `'dark'`
- `appFontSize` — `'normal'` | `'large'`
- `appLanguage` — `'zh'` | `'vi'` | `'id'`

### 多語系（i18n）

所有 UI 字串均透過 `react-i18next` 處理。繁體中文（`zh`）、越南語（`vi`）、印尼語（`id`）的翻譯全部內嵌於 `src/i18n.js`，無外部翻譯檔案。

### 樣式

使用 Tailwind CSS，`darkMode: 'class'` 模式，透過在 `<html>` 上加減 `dark` class 切換深色模式。自訂設計 token（定義於 `tailwind.config.js`）：`primary`（#137fec）、`success`（#2e7d32）、`danger`（#d32f2f）、`background-light` / `background-dark`。字型 Lexend 與 Material Symbols 圖示均透過 CDN 載入（定義於 `index.html`）。
