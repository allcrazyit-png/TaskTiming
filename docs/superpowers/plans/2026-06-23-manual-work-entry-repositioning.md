# 手動輸入工作重新定位 實現計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將手動輸入工作功能從篩選器區域移至首頁「我的最愛」下方右側，提高易達性，同時簡化表單（只需輸入工作內容名稱）。

**Architecture:** 在 Home.jsx 中移除篩選器內的自定義產品展開式區域，簡化狀態管理（刪除 customPartNumber），在最愛卡片列表下方右側添加手動輸入按鈕，當有最愛時顯示該按鈕。Modal 保持簡潔，只收集工作內容名稱。

**Tech Stack:** React, React Router v7, Tailwind CSS, react-i18next, localStorage

---

## File Structure

### 修改文件
- **[src/pages/Home.jsx](src/pages/Home.jsx:1-1310)** — 移除篩選器中的手動輸入區域；簡化狀態管理；添加首頁手動輸入按鈕；簡化 modal 設計
- **[src/i18n.js](src/i18n.js)** — 確認或補充翻譯鍵值（custom_input_title、custom_product_name_label 等）

### 受影響但無需修改的文件
- `src/pages/Input.jsx` — 無變更（已支援 category=null 的場景）
- `src/pages/Confirm.jsx` — 無變更（已正常處理手動輸入的記錄）

---

## Tasks

### Task 1: 移除篩選器中的 isCustomProduct 展開式區域

**Files:**
- Modify: `src/pages/Home.jsx:992-1003` (篩選器標籤行)
- Modify: `src/pages/Home.jsx:1045-1083` (isCustomProduct 展開式區域)

**Step 1: 找到篩選器中的手動輸入區域**

在 Home.jsx 中，找到以下代碼（約在第 992-1003 行）：

```jsx
<div className="flex items-center justify-between mb-2">
    <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
        {t('filter_car_model')}
    </label>
    <button
        onClick={toggleCustomProduct}
        className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${isCustomProduct
            ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800'
            : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50'
            }`}
    >
        <span className="material-symbols-outlined text-[16px]">
            {isCustomProduct ? 'close' : 'add'}
        </span>
        {isCustomProduct ? t('custom_btn_cancel') : t('custom_btn_add')}
    </button>
</div>
```

- [ ] **Step 2: 移除篩選器標籤行中的 toggleCustomProduct 按鈕**

將上述代碼替換為簡潔的標籤，移除按鈕：

```jsx
<div className="mb-2">
    <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
        {t('filter_car_model')}
    </label>
</div>
```

- [ ] **Step 3: 移除 isCustomProduct 展開式區域**

找到並刪除以下代碼塊（約在第 1045-1083 行）：

```jsx
{isCustomProduct && (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl space-y-4 animate-fade-in">
        <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <span className="material-symbols-outlined">edit_square</span>
            {t('custom_input_title')}
        </h3>
        {/* 整個區域 */}
    </div>
)}
```

- [ ] **Step 4: 從狀態中移除 toggleCustomProduct**

在 Home.jsx 開頭的狀態聲明中，找到以下代碼並刪除：

```javascript
const toggleCustomProduct = () => {
    setIsCustomProduct(prev => !prev);
};
```

- [ ] **Step 5: Commit**

```bash
cd /Users/takuyatop/Downloads/vibe\ coding/組裝報表上傳
git add src/pages/Home.jsx
git commit -m "refactor: remove custom product toggle from filter section

Remove the 'Add Custom Product' button and its expanded form from the filter section. This functionality will be repositioned to the home page beside favorites.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 2: 簡化狀態管理 — 移除 customPartNumber

**Files:**
- Modify: `src/pages/Home.jsx:26-29` (狀態聲明)

**Step 1: 定位狀態聲明**

在 Home.jsx 中，找到以下狀態聲明（約在第 26-29 行）：

```javascript
// Custom Product Entry State
const [isCustomProduct, setIsCustomProduct] = useState(false);
const [customProductName, setCustomProductName] = useState('');
const [customPartNumber, setCustomPartNumber] = useState('');
```

- [ ] **Step 2: 移除 isCustomProduct 狀態**

因為已經在篩選器移除了 toggleCustomProduct，isCustomProduct 狀態可以刪除：

```javascript
// 刪除以下行：
// const [isCustomProduct, setIsCustomProduct] = useState(false);
```

- [ ] **Step 3: 移除 customPartNumber 狀態**

刪除以下行：

```javascript
// 刪除以下行：
// const [customPartNumber, setCustomPartNumber] = useState('');
```

修改後應該是：

```javascript
// Custom Product Entry State
const [customProductName, setCustomProductName] = useState('');

// Password Modal State
const [showPasswordModal, setShowPasswordModal] = useState(false);
```

- [ ] **Step 4: 更新 showCustomModal 狀態**

找到以下狀態聲明（如果尚未存在，就新增）：

```javascript
// Custom Work Modal State
const [showCustomModal, setShowCustomModal] = useState(false);
```

如果還沒有這個狀態，新增它。如果已存在，檢查是否正確命名（應該用 showCustomModal，不是 showCustomProduct）。

- [ ] **Step 5: 移除所有 customPartNumber 的引用**

在 Home.jsx 中搜尋 `customPartNumber`，並刪除所有相關行。這包括：
  - 任何設置 customPartNumber 的 `setCustomPartNumber()` 調用
  - 任何使用 customPartNumber 的輸入框或邏輯

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "refactor: simplify custom work state - remove customPartNumber

Remove unused customPartNumber and isCustomProduct state, keep only customProductName and showCustomModal. Custom work entry now only requires work content name.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 3: 簡化 handleStartCustomWork 邏輯

**Files:**
- Modify: `src/pages/Home.jsx:377-401` (handleStartCustomWork 函數)

**Step 1: 定位函數**

找到 Home.jsx 中的 `handleStartCustomWork` 函數（約在第 377-401 行）：

```javascript
const handleStartCustomWork = () => {
    if (!selectedOperator) {
        alert(t('login_required_work') + " (Please select an operator first)");
        return;
    }

    if (!customProductName.trim()) {
        alert(t('login_required_custom') + " (Custom product name is required)");
        return;
    }

    // Scroll to top before navigating
    window.scrollTo(0, 0);

    navigate('/input', {
        state: {
            productName: customProductName.trim(),
            partNumber: customPartNumber.trim(),
            carModel: filters.carModel || '未指定',
            standardTime: 0,
            operator: selectedOperator,
            productImage: null
        }
    });
};
```

- [ ] **Step 2: 移除 partNumber 引用**

更新函數，移除 customPartNumber.trim()，並移除 carModel 使用 filters.carModel 的邏輯：

```javascript
const handleStartCustomWork = () => {
    if (!selectedOperator) {
        alert(t('login_required_work') + " (Please select an operator first)");
        return;
    }

    if (!customProductName.trim()) {
        alert(t('login_required_custom') + " (Custom product name is required)");
        return;
    }

    // Scroll to top before navigating
    window.scrollTo(0, 0);

    navigate('/input', {
        state: {
            productName: customProductName.trim(),
            partNumber: "",
            carModel: "未指定",
            standardTime: 0,
            operator: selectedOperator,
            productImage: null,
            category: null
        }
    });
};
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "refactor: simplify handleStartCustomWork logic

Remove partNumber handling, use fixed carModel value '未指定' and add category: null. Aligns with simplified form that only collects work content name.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 4: 添加首頁手動輸入按鈕（在最愛卡片下方右側）

**Files:**
- Modify: `src/pages/Home.jsx:951-972` (最愛區域)

**Step 1: 定位最愛區域**

找到 Home.jsx 中的最愛區域（約在第 951-972 行）：

```jsx
{/* 常用產品（主要入口） */}
{favoriteProducts.length > 0 ? (
    <section className="space-y-4">
        <h2 className="text-lg font-bold border-l-4 border-red-500 pl-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <span className="material-symbols-outlined text-red-500">favorite</span>
            {t('favorites')}
        </h2>
        <div className="flex flex-col gap-4">
            {products
                .filter(p => favoriteProducts.includes(`${p['品番']}|${p['類別'] || ''}`))
                .map((product, index) => renderFavoriteCard(product, index))}
        </div>
    </section>
) : (
    ...
)}
```

- [ ] **Step 2: 在卡片列表後添加手動輸入按鈕**

修改該區域，在 `</div>` 結束後（卡片列表下方）添加按鈕：

```jsx
{/* 常用產品（主要入口） */}
{favoriteProducts.length > 0 ? (
    <section className="space-y-4">
        <h2 className="text-lg font-bold border-l-4 border-red-500 pl-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <span className="material-symbols-outlined text-red-500">favorite</span>
            {t('favorites')}
        </h2>
        <div className="flex flex-col gap-4">
            {products
                .filter(p => favoriteProducts.includes(`${p['品番']}|${p['類別'] || ''}`))
                .map((product, index) => renderFavoriteCard(product, index))}
        </div>
        {/* 手動輸入按鈕 - 下方右側 */}
        <div className="flex justify-end pt-2">
            <button
                onClick={() => {
                    if (!selectedOperator) {
                        alert(t('login_required_work') + " (Please select an operator first)");
                        return;
                    }
                    setShowCustomModal(true);
                }}
                className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95"
            >
                <span className="material-symbols-outlined text-xl">edit</span>
                <span className="text-sm">{t('custom_btn_add') || '+ 手動輸入工作'}</span>
            </button>
        </div>
    </section>
) : (
    ...
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat: add manual work entry button below favorites

Add '+ 手動輸入工作' button below favorites list on right side. Button opens modal to input work content. Only visible when user has favorites to reduce visual clutter.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 5: 簡化自定義工作 Modal

**Files:**
- Modify: `src/pages/Home.jsx` (找到並替換舊的自定義產品 modal)

**Step 1: 定位舊 Modal**

搜尋 Home.jsx 中 `isCustomProduct &&` 的舊 modal 區域（應該已在篩選器中被移除）。如果還有其他自定義工作 modal（例如在頁面頂部），需要找到它。

如果沒有找到，這表示需要新建一個 modal。在 `showPasswordModal` 或 `showHistoryPopup` 之後添加新的自定義工作 modal：

- [ ] **Step 2: 新增自定義工作 Modal（如果不存在）**

在 Home.jsx 中的 modal 區域（例如密碼 modal 之後），添加以下代碼：

```jsx
{/* Custom Work Modal */}
{showCustomModal && selectedOperator && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100 animate-bounceScale">
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-3xl text-blue-600 dark:text-blue-400">edit</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('custom_input_title') || '手動輸入工作'}</h3>
                <p className="text-sm text-slate-500 mt-1">{t('custom_input_desc') || '記錄清單外的臨時工作'}</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">
                        {t('custom_product_name_label') || '工作內容'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        placeholder={t('custom_product_name_placeholder') || '例如：掃廁所、整理材料、清潔設備'}
                        value={customProductName}
                        onChange={(e) => setCustomProductName(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        autoFocus
                    />
                </div>

                <button
                    onClick={handleStartCustomWork}
                    className="w-full mt-2 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 font-bold transition-colors"
                >
                    <span className="material-symbols-outlined">play_circle</span>
                    {t('start_custom_work') || '開始工作'}
                </button>
                <button
                    onClick={() => {
                        setShowCustomModal(false);
                        setCustomProductName('');
                    }}
                    className="w-full h-10 text-slate-400 font-bold text-sm hover:text-slate-600 dark:hover:text-slate-200"
                >
                    {t('cancel') || '取消'}
                </button>
            </div>
        </div>
    </div>
)}
```

- [ ] **Step 3: 確保 showCustomModal 狀態已聲明**

檢查 Home.jsx 開頭是否有 `showCustomModal` 狀態聲明。如果沒有，新增：

```javascript
const [showCustomModal, setShowCustomModal] = useState(false);
```

- [ ] **Step 4: 測試 Modal 交互**

在本地開發環境中：
1. 登入為某個員工
2. 確保有至少一個最愛產品（如果沒有，先加一個）
3. 點擊「+ 手動輸入工作」按鈕
4. 確認 Modal 正確彈出
5. 輸入工作內容，點擊「開始工作」
6. 確認導航至 `/input` 頁面，productName 正確傳遞

- [ ] **Step 5: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat: add simplified custom work modal

Add modal for manual work entry that only collects work content name. Modal triggers when clicking '+ 手動輸入工作' button. Supports text input, validation, and navigation to input page.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 6: 驗證 i18n 翻譯鍵值

**Files:**
- Read/Modify: `src/i18n.js`

**Step 1: 檢查需要的翻譯鍵值**

打開 `src/i18n.js`，檢查以下鍵值是否存在並有正確的翻譯：

需要確認的鍵值：
- `custom_input_title` — 標題「手動輸入工作」
- `custom_input_desc` — 描述「記錄清單外的臨時工作」
- `custom_product_name_label` — 「工作內容」
- `custom_product_name_placeholder` — 「例如：掃廁所、整理材料、清潔設備」
- `custom_product_name_req` — 「*」（必填標誌）
- `custom_btn_add` — 「+ 手動輸入工作」
- `custom_btn_cancel` — 「取消」（如果未在其他地方定義）
- `start_custom_work` — 「開始工作」
- `login_required_custom` — 登入提示文案

- [ ] **Step 2: 補充缺失的翻譯（如果有）**

如果上述任何鍵值不存在或翻譯不完整，在 `src/i18n.js` 中新增或修正。例如：

```javascript
const translations = {
    zh: {
        // ... 現有翻譯 ...
        custom_input_title: '手動輸入工作',
        custom_input_desc: '記錄清單外的臨時工作',
        custom_product_name_label: '工作內容',
        custom_product_name_placeholder: '例如：掃廁所、整理材料、清潔設備',
        custom_btn_add: '+ 手動輸入工作',
        start_custom_work: '開始工作',
    },
    vi: {
        custom_input_title: 'Nhập công việc thủ công',
        custom_input_desc: 'Ghi lại công việc tạm thời ngoài danh sách',
        custom_product_name_label: 'Nội dung công việc',
        custom_product_name_placeholder: 'Ví dụ: Dọn nhà vệ sinh, sắp xếp vật liệu, làm sạch thiết bị',
        custom_btn_add: '+ Nhập công việc',
        start_custom_work: 'Bắt đầu làm việc',
    },
    id: {
        custom_input_title: 'Masukan Pekerjaan Manual',
        custom_input_desc: 'Catat pekerjaan sementara di luar daftar',
        custom_product_name_label: 'Konten Pekerjaan',
        custom_product_name_placeholder: 'Misalnya: Bersihkan toilet, atur bahan, bersihkan peralatan',
        custom_btn_add: '+ Masukan Pekerjaan',
        start_custom_work: 'Mulai Bekerja',
    }
};
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n.js
git commit -m "i18n: add translations for manual work entry modal

Add Chinese, Vietnamese, and Indonesian translations for custom work entry modal, including title, description, placeholder text, and button labels.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 7: 完整測試流程

**Files:**
- Test: `src/pages/Home.jsx` (UI 測試)
- Test: `src/pages/Input.jsx` (接收狀態)

**Step 1: 啟動開發伺服器**

```bash
cd /Users/takuyatop/Downloads/vibe\ coding/組裝報表上傳
npm run dev
```

預期：開發伺服器啟動，無編譯錯誤

- [ ] **Step 2: 測試場景 A：沒有最愛時隱藏手動輸入按鈕**

1. 打開應用，登入為某個員工（但不創建最愛）
2. 確認首頁顯示「尚未有常用產品」提示
3. 確認**沒有**「+ 手動輸入工作」按鈕

- [ ] **Step 3: 測試場景 B：添加最愛後顯示按鈕**

1. 在「找其他產品」中選擇一個產品並點擊愛心標誌，將其加入最愛
2. 確認首頁現在顯示最愛卡片
3. 確認「+ 手動輸入工作」按鈕出現在卡片列表下方右側
4. 確認按鈕的視覺樣式（淡灰背景、虛線邊框、edit 圖示）

- [ ] **Step 4: 測試場景 C：點擊按鈕打開 Modal**

1. 點擊「+ 手動輸入工作」按鈕
2. 確認 Modal 正確彈出，標題為「手動輸入工作」
3. 確認輸入框有 placeholder 文案「例如：掃廁所、整理材料、清潔設備」
4. 確認焦點自動進入輸入框

- [ ] **Step 5: 測試場景 D：表單驗證**

1. 在 Modal 中點擊「開始工作」按鈕（不輸入任何內容）
2. 確認顯示錯誤提示「Custom product name is required」（或對應的國際化文案）
3. 輸入純空白「   」，點擊「開始工作」
4. 確認同樣顯示錯誤

- [ ] **Step 6: 測試場景 E：成功流程**

1. 清空輸入框，輸入「掃廁所」
2. 點擊「開始工作」
3. 確認導航至 `/input` 頁面
4. 檢查頁面上方的產品資訊顯示：
   - 產品名稱應為「掃廁所」
   - 品番應為空或不顯示
   - 車型應為「未指定」
   - 無類別標籤（或灰色「其他」標籤）
5. 完成時間、良品數、報廢數的輸入
6. 點擊「確認上傳」
7. 確認記錄成功上傳至 Google Sheets

- [ ] **Step 7: 測試場景 F：多個最愛時的布局**

1. 添加 3 個不同的最愛產品
2. 回到首頁
3. 確認三張卡片垂直堆疊
4. 確認「+ 手動輸入工作」按鈕在最後一張卡片下方、靠右對齊（不會被卡片擠壓）

- [ ] **Step 8: 測試場景 G：黑暗模式**

1. 在設置中切換至暗色模式
2. 確認按鈕和 Modal 在暗色模式下顯示正確（顏色對比度良好）

- [ ] **Step 9: 檢查篩選器中不再有舊的手動輸入區域**

1. 點擊「找其他產品」展開篩選器
2. 確認**沒有**看到舊的「添加自定義產品」按鈕和展開式區域
3. 篩選器應該只顯示：車型 → 品番 → 產品列表

- [ ] **Step 10: Commit 測試完成**

```bash
git add -A  # 如有任何測試產生的修改（通常沒有）
git commit -m "test: verify manual work entry repositioning

- Confirm manual input button only appears when favorites exist
- Test modal opens/closes correctly
- Test form validation (empty input not allowed)
- Test successful navigation to Input page with correct state
- Verify old custom product toggle removed from filter
- Test dark mode compatibility

All scenarios pass.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 8: 清理與最終驗證

**Files:**
- Review: `src/pages/Home.jsx`

**Step 1: 代碼清理**

檢查 Home.jsx 是否還有以下未清理的代碼：

- [ ] 搜尋 `customPartNumber` — 應該完全不存在
- [ ] 搜尋 `toggleCustomProduct` — 應該完全不存在
- [ ] 搜尋 `isCustomProduct` — 應該完全不存在
- [ ] 確認所有引用都已移除

- [ ] **Step 2: 驗證導入和函數簽名**

確認以下函數簽名無誤：

```javascript
const handleStartCustomWork = () => {
    // 應該只接收 customProductName，不接收 customPartNumber
    navigate('/input', {
        state: {
            productName: customProductName.trim(),
            partNumber: "",
            carModel: "未指定",
            standardTime: 0,
            operator: selectedOperator,
            productImage: null,
            category: null
        }
    });
};
```

- [ ] **Step 3: 檢查無用的狀態**

確認以下狀態已完全移除：
- `isCustomProduct`
- `customPartNumber`
- 任何與舊按鈕相關的狀態

- [ ] **Step 4: 最後一次視覺檢查**

在本地運行應用，快速檢查：
1. 首頁佈局整潔，無遺留代碼痕跡
2. 最愛卡片正常顯示
3. 手動輸入按鈕位置和樣式正確
4. Modal 外觀和交互正確
5. 暗色模式下視覺協調

- [ ] **Step 5: 最終 Commit**

```bash
git add src/pages/Home.jsx
git commit -m "refactor: clean up unused custom product state and functions

Remove all references to customPartNumber, toggleCustomProduct, and isCustomProduct. Verify handleStartCustomWork only uses customProductName. Final cleanup after repositioning manual work entry.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Summary

這個計畫的目標是：

1. ✅ 從篩選器移除手動輸入區域（Task 1）
2. ✅ 簡化狀態管理，移除 customPartNumber（Task 2）
3. ✅ 更新 handleStartCustomWork 邏輯（Task 3）
4. ✅ 在首頁最愛下方添加手動輸入按鈕（Task 4）
5. ✅ 新增簡化的 Modal（Task 5）
6. ✅ 確保國際化翻譯完整（Task 6）
7. ✅ 完整測試所有流程（Task 7）
8. ✅ 代碼清理和驗證（Task 8）

**預期結果**：
- 手動輸入工作功能易達性提高（從篩選器深層移至首頁）
- 表單簡化，只需輸入工作內容名稱
- 視覺層級清晰，手動輸入按鈕次於常用產品卡片
- 當無最愛時，自動隱藏手動輸入按鈕，保持首頁簡潔
- 所有現有功能（Input 頁面、Google Sheets 記錄等）正常運作
