# UI 重設計實作計畫（40+ 中年女性作業員）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改善 Home 頁面與 Input 頁面的 UI，讓 40 歲以上中年女性工廠作業員能更快速、直覺地完成每日作業回報。

**Architecture:** 無架構變動，純 UI 層修改。Home.jsx 加入全版登入畫面（未登入時）與大型常用產品卡片（已登入時），篩選器改為收起/展開模式。Input.jsx 放大所有互動元素尺寸。

**Tech Stack:** React 18, Tailwind CSS, react-i18next（現有技術棧不變）

---

## 修改檔案總覽

| 檔案 | 改動 |
|------|------|
| `src/index.css` | `.huge-btn` 高度 56px → 64px；`.time-input` 加 `min-height: 56px` |
| `src/pages/Home.jsx` | 預設字型改為 large；新增 `selectEmployee` helper；未登入全版畫面；`showFilter` 狀態；常用產品大橫列卡片；篩選器預設收起 |
| `src/pages/Input.jsx` | 日期輸入框放大；計數 +/- 按鈕 50px → 64px；送出按鈕 h-14 → h-[68px] |

---

## Task 1：index.css 全域尺寸調整

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1：修改 `.huge-btn` 與 `.time-input`**

找到 `src/index.css` 中現有的 `.huge-btn` 和 `.time-input`，替換如下：

```css
.huge-btn {
  min-height: 64px;   /* 原本 56px */
  font-size: 18px;
  font-weight: 700;
}

.time-input {
  @apply bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-1 py-2 text-xl font-black text-center w-full focus:ring-4 focus:ring-primary/20 transition-all outline-none;
  box-sizing: border-box;
  max-width: 100%;
  min-height: 56px;   /* 新增這行 */
}
```

- [ ] **Step 2：啟動開發伺服器確認無編譯錯誤**

```bash
cd "/Users/takuyatop/Downloads/vibe coding/組裝報表上傳"
npm run dev
```

預期輸出：`Local: http://localhost:5173/TaskTiming/`（無紅色錯誤）

- [ ] **Step 3：Commit**

```bash
cd "/Users/takuyatop/Downloads/vibe coding/組裝報表上傳"
git add src/index.css
git commit -m "style: increase huge-btn height to 64px and time-input min-height to 56px"
```

---

## Task 2：Home.jsx — 預設字型改為 large

**Files:**
- Modify: `src/pages/Home.jsx`（line 43）

- [ ] **Step 1：修改 fontSize 初始值**

找到 `src/pages/Home.jsx` 第 43 行：
```jsx
const [fontSize, setFontSize] = useState(() => localStorage.getItem('appFontSize') || 'normal'); // 'normal', 'large'
```
改為：
```jsx
const [fontSize, setFontSize] = useState(() => localStorage.getItem('appFontSize') || 'large'); // 'normal', 'large'
```

- [ ] **Step 2：瀏覽器確認**

在 `http://localhost:5173/TaskTiming/` 清除 localStorage 後重整，確認文字預設為大字（整體文字比原本稍大）。

瀏覽器 Console 執行清除：
```js
localStorage.removeItem('appFontSize'); location.reload();
```

- [ ] **Step 3：Commit**

```bash
cd "/Users/takuyatop/Downloads/vibe coding/組裝報表上傳"
git add src/pages/Home.jsx
git commit -m "feat: default font size to large for 40+ users"
```

---

## Task 3：Home.jsx — 新增 selectEmployee helper

**Files:**
- Modify: `src/pages/Home.jsx`

這一步把登入邏輯抽出為獨立函式，供後續全版登入畫面（Task 4）呼叫。

- [ ] **Step 1：加入 `selectEmployee` 函式**

在 `src/pages/Home.jsx` 找到 `handleOperatorChange` 函式（約第 259 行），在其**正上方**插入：

```jsx
const selectEmployee = (emp) => {
    setTempOperator(emp);
    setPasswordInput('');
    setPasswordError(false);
    setShowPasswordModal(true);
};
```

- [ ] **Step 2：讓 `handleOperatorChange` 使用 `selectEmployee`**

找到 `handleOperatorChange` 內的這段：
```jsx
if (emp) {
    setTempOperator(emp);
    setPasswordInput('');
    setPasswordError(false);
    setShowPasswordModal(true);
}
```
替換為：
```jsx
if (emp) {
    selectEmployee(emp);
}
```

- [ ] **Step 3：確認現有登入流程不受影響**

在瀏覽器登出（設定 → 清除帳號），然後用右上角下拉選單登入，確認密碼 Modal 正常彈出。

- [ ] **Step 4：Commit**

```bash
cd "/Users/takuyatop/Downloads/vibe coding/組裝報表上傳"
git add src/pages/Home.jsx
git commit -m "refactor: extract selectEmployee helper in Home.jsx"
```

---

## Task 4：Home.jsx — 未登入時顯示全版員工名字清單

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1：在 `return` 前插入未登入分支**

找到 `src/pages/Home.jsx` 的 `return (` 這一行（約第 578 行），在其**正上方**插入以下早期返回：

```jsx
// 未登入：顯示全版員工選擇畫面
if (!selectedOperator) {
    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
            {/* Password Modal（保留，供名字按鈕觸發） */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100 animate-bounceScale">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="material-symbols-outlined text-3xl text-primary">lock</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('enter_password_title')}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {t('operator_label')} <span className="font-bold text-primary">{tempOperator?.['姓名']}</span>
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className={`w-full h-14 text-center text-2xl font-bold tracking-widest rounded-xl border-2 bg-slate-50 dark:bg-slate-900 focus:outline-none transition-colors ${passwordError ? 'border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700 focus:border-primary'}`}
                                    placeholder={t('password_placeholder')}
                                    value={passwordInput}
                                    onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                                    onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                                    autoFocus
                                />
                                {passwordError && (
                                    <p className="text-red-500 text-sm font-bold text-center mt-2 animate-shake">
                                        {t('password_error')}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={verifyPassword}
                                className="w-full h-14 bg-primary text-white rounded-xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
                            >
                                {t('confirm_login')}
                            </button>
                            <button
                                onClick={() => { setShowPasswordModal(false); setTempOperator(null); setPasswordInput(''); }}
                                className="w-full h-12 text-slate-400 font-bold text-base hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Company Banner */}
            <div className="bg-slate-50 dark:bg-black text-slate-500 dark:text-slate-400 py-2 px-4 text-center font-bold text-[11px] border-b border-slate-200 dark:border-slate-800 tracking-[0.3em] uppercase">
                瑞全企業股份有限公司
            </div>

            {/* Full-screen login body */}
            <div className="flex-1 flex flex-col px-6 pt-10 pb-8">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-4xl text-primary">groups</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">請選擇您的名字</h1>
                    <p className="text-sm text-slate-500 mt-1">Select your name</p>
                </div>

                {employees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                        <span className="material-symbols-outlined text-5xl animate-spin mb-3">progress_activity</span>
                        <p className="font-bold">{t('loading_data')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {employees.map((emp, idx) => (
                            <button
                                key={idx}
                                onClick={() => selectEmployee(emp)}
                                className="w-full h-16 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-black text-slate-800 dark:text-slate-100 text-left px-6 flex items-center gap-4 shadow-sm active:scale-[0.98] active:bg-slate-50 dark:active:bg-slate-700 transition-all"
                            >
                                <span className="material-symbols-outlined text-2xl text-primary shrink-0">person</span>
                                <span>{emp['姓名']}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2：瀏覽器確認未登入畫面**

在瀏覽器清除 localStorage 後重整：
```js
localStorage.removeItem('savedOperatorId'); location.reload();
```
確認：顯示全版員工名字列表，每個名字是一個高 64px 的大按鈕，點擊後彈出密碼 Modal。

- [ ] **Step 3：Commit**

```bash
cd "/Users/takuyatop/Downloads/vibe coding/組裝報表上傳"
git add src/pages/Home.jsx
git commit -m "feat: replace operator dropdown with full-screen login for unauthenticated state"
```

---

## Task 5：Home.jsx — 常用產品大橫列卡片 + 篩選器預設收起

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1：新增 `showFilter` state**

在 `src/pages/Home.jsx` 找到 `const [showAllImages, setShowAllImages] = useState(false);`（約第 46 行），在其**下方**插入：

```jsx
// 篩選區展開/收起（預設收起）
const [showFilter, setShowFilter] = useState(false);
```

- [ ] **Step 2：新增 `renderFavoriteCard` 函式**

在 `src/pages/Home.jsx` 找到 `const renderProductCard = (product, index, isFavoriteList = false, showImage = true) => {` 這一行，在其**正上方**插入：

```jsx
// 常用產品大橫列卡片（專為 40+ 用戶設計的大觸控目標）
const renderFavoriteCard = (product, index) => {
    const favKey = `${product['品番']}|${product['類別'] || ''}`;

    return (
        <div
            key={`fav-${product['品番']}-${index}`}
            className="flex items-center gap-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-md active:scale-[0.98] transition-transform"
            onClick={() => handleStartWork(product)}
        >
            {/* 產品圖片 */}
            <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {product['產品圖片'] ? (
                    <img
                        alt={product['品名']}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        src={getImageUrl(product['產品圖片'])}
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/80x80?text=?'; }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-3xl">image_not_supported</span>
                    </div>
                )}
            </div>

            {/* 品名與車型 */}
            <div className="flex-1 min-w-0">
                {product['類別'] && (
                    <span className={`${getCategoryStyles(product['類別'])} text-white text-xs font-black px-2 py-0.5 rounded-full mb-1 inline-block`}>
                        {t(`cat_${product['類別']}`, product['類別'])}
                    </span>
                )}
                <p className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight line-clamp-2">{product['品名']}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{product['車型']}</p>
            </div>

            {/* 開始按鈕 */}
            <button
                onClick={(e) => { e.stopPropagation(); handleStartWork(product); }}
                className={`shrink-0 w-16 h-16 flex flex-col items-center justify-center rounded-2xl text-white shadow-md active:scale-90 transition-transform ${getCategoryBtnStyles(product['類別'])}`}
            >
                <span className="material-symbols-outlined text-3xl">play_circle</span>
                <span className="text-xs font-black mt-0.5">開始</span>
            </button>
        </div>
    );
};
```

- [ ] **Step 3：替換主頁 `main` 區塊內容**

找到 `{/* Main Content Area */}` 這個區塊（約第 812 行），將整個 `<main>...</main>` 替換為：

```jsx
{/* Main Content Area */}
<main className="flex-1 p-4 pb-24 space-y-6">

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
        <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50 block">favorite_border</span>
            <p className="font-bold text-base">{t('no_favorites_hint') || '尚未有常用產品'}</p>
            <p className="text-sm mt-1">{t('no_favorites_sub') || '點擊產品的 ♡ 可加入常用'}</p>
        </div>
    )}

    {/* 找其他產品（展開/收起篩選器） */}
    <button
        onClick={() => setShowFilter(prev => !prev)}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold text-base active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
    >
        <span className="material-symbols-outlined text-xl">{showFilter ? 'expand_less' : 'search'}</span>
        {showFilter ? t('hide_filter') || '收起搜尋' : t('find_other') || '找其他產品'}
    </button>

    {/* 篩選器（展開時才顯示） */}
    {showFilter && (
        <section className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
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
                <div className="relative">
                    <select
                        value={filters.carModel}
                        onChange={(e) => handleFilterChange('carModel', e.target.value)}
                        className="block w-full h-12 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base font-medium focus:border-primary focus:ring-primary appearance-none disabled:opacity-50"
                        disabled={loading}
                    >
                        <option value="">{loading ? t('select_car_model_loading') : t('select_car_model_placeholder')}</option>
                        {uniqueCarModels.map(model => (
                            <option key={model} value={model}>{model}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <span className="material-symbols-outlined text-2xl">expand_more</span>
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-sm font-bold mb-2 text-slate-800 dark:text-slate-200">
                    {t('filter_part_number')}
                </label>
                <div className="relative">
                    <select
                        value={filters.partNumber}
                        onChange={(e) => handleFilterChange('partNumber', e.target.value)}
                        className="block w-full h-12 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base font-medium focus:border-primary focus:ring-primary appearance-none disabled:opacity-50"
                        disabled={loading || !filters.carModel}
                    >
                        <option value="">{t('select_part_number_placeholder')}</option>
                        {uniquePartNumbers.map(({ partNumber, productName }) => (
                            <option key={partNumber} value={partNumber}>
                                {partNumber}{productName ? ` - ${productName}` : ''}
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <span className="material-symbols-outlined text-2xl">expand_more</span>
                    </div>
                </div>
            </div>

            {/* Custom Product Entry */}
            {isCustomProduct && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl space-y-4 animate-fade-in">
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        <span className="material-symbols-outlined">edit_square</span>
                        {t('custom_input_title')}
                    </h3>
                    <div>
                        <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">
                            {t('custom_part_number_label')}
                        </label>
                        <input
                            type="text"
                            placeholder={t('custom_part_number_placeholder')}
                            value={customPartNumber}
                            onChange={(e) => setCustomPartNumber(e.target.value)}
                            className="w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">
                            {t('custom_product_name_label')} <span className="text-red-500">{t('custom_product_name_req')}</span>
                        </label>
                        <input
                            type="text"
                            placeholder={t('custom_product_name_placeholder')}
                            value={customProductName}
                            onChange={(e) => setCustomProductName(e.target.value)}
                            className="w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <button
                        onClick={handleStartCustomWork}
                        className="w-full mt-2 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 font-black text-lg active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined">play_circle</span>
                        {t('start_custom_work')}
                    </button>
                </div>
            )}

            {/* 篩選後的產品列表（緊湊模式） */}
            <div className="space-y-3">
                <h2 className="text-base font-bold border-l-4 border-primary pl-3 text-slate-800 dark:text-slate-100">{t('all_products')}</h2>
                {loading ? (
                    <div className="text-center py-8 text-slate-500">
                        <span className="material-symbols-outlined text-4xl animate-spin mb-2">progress_activity</span>
                        <p>{t('loading_data')}</p>
                    </div>
                ) : !filters.carModel ? (
                    <div className="text-center py-8 text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <span className="material-symbols-outlined text-5xl mb-3 opacity-30">directions_car</span>
                        <p className="font-bold">{t('select_car_model_placeholder')}</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <span className="material-symbols-outlined text-4xl mb-2 flex justify-center opacity-50">search_off</span>
                        <p className="font-bold">{t('no_products_found')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredProducts.map((product, index) => renderProductCard(product, index, false, false))}
                    </div>
                )}
            </div>
        </section>
    )}
</main>
```

- [ ] **Step 4：瀏覽器確認**

登入後確認：
1. 有常用產品時，首頁顯示大橫列卡片（80×80px 圖片 + 品名 + 開始按鈕）
2. 沒有常用產品時，顯示「尚未有常用產品」提示
3. 「找其他產品」按鈕點擊後展開篩選器，再次點擊收起
4. 篩選器展開後可正常篩選並顯示緊湊列表

- [ ] **Step 5：Commit**

```bash
cd "/Users/takuyatop/Downloads/vibe coding/組裝報表上傳"
git add src/pages/Home.jsx
git commit -m "feat: large favorite cards and collapsible filter for senior users"
```

---

## Task 6：Input.jsx — 放大日期輸入、計數按鈕、送出按鈕

**Files:**
- Modify: `src/pages/Input.jsx`

- [ ] **Step 1：放大日期輸入框**

找到 Input.jsx 中的日期 `<input>` 元素（約第 324 行）：
```jsx
<input
    type="date"
    value={workDate}
    onChange={(e) => setWorkDate(e.target.value)}
    className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-primary focus:border-primary outline-none cursor-pointer"
/>
```
替換 className 為：
```jsx
<input
    type="date"
    value={workDate}
    onChange={(e) => setWorkDate(e.target.value)}
    className="text-base font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-primary focus:border-primary outline-none cursor-pointer min-h-[48px]"
/>
```

- [ ] **Step 2：放大單側計數 +/- 按鈕（非 isDual 模式）**

找到非 dual 模式的 `-` 按鈕（約第 365 行）：
```jsx
className="w-[50px] h-[50px] rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90 transition-transform border-2 border-slate-300 dark:border-slate-700"
```
改為：
```jsx
className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90 transition-transform border-2 border-slate-300 dark:border-slate-700"
```

找到非 dual 模式的 `+` 按鈕（約第 382 行）：
```jsx
className="w-[50px] h-[50px] rounded-xl bg-success text-white flex items-center justify-center active:scale-90 transition-transform border-2 border-emerald-600 shadow-md"
```
改為：
```jsx
className="w-16 h-16 rounded-xl bg-success text-white flex items-center justify-center active:scale-90 transition-transform border-2 border-emerald-600 shadow-md"
```

- [ ] **Step 3：放大送出按鈕**

找到 footer 中的主送出按鈕（約第 685 行），找到這個 className 片段：
```jsx
className={`w-full h-14 rounded-xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-transform border-b-4 ${...}`}
```
將 `h-14` 改為 `h-[68px]`：
```jsx
className={`w-full h-[68px] rounded-xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-transform border-b-4 ${...}`}
```

找到送出按鈕內的文字：
```jsx
<span className="text-xl font-black">{t('finish_next')}</span>
```
改為：
```jsx
<span className="text-2xl font-black">{t('finish_next')}</span>
```

找到「今天做完了」按鈕（約第 693 行）：
```jsx
className="w-full h-12 bg-slate-200 dark:bg-slate-800 ..."
```
將 `h-12` 改為 `h-14`：
```jsx
className="w-full h-14 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform border-2 border-slate-300 dark:border-slate-600"
```

- [ ] **Step 4：瀏覽器確認**

從首頁點任一常用產品進入 Input 頁，確認：
1. 日期選擇器明顯更大（高度約 48px）
2. +/- 按鈕為 64×64px 正方形
3. 送出按鈕明顯更高（68px）、文字更大
4. 送出流程正常進入 Confirm 頁

- [ ] **Step 5：Commit**

```bash
cd "/Users/takuyatop/Downloads/vibe coding/組裝報表上傳"
git add src/pages/Input.jsx
git commit -m "feat: enlarge date picker, count buttons, and submit button in Input page"
```

---

## 完成後驗收清單

- [ ] 清除 localStorage 後重整，出現全版員工名字清單（大按鈕）
- [ ] 點名字 → 密碼 Modal → 登入成功後顯示常用產品大卡片
- [ ] 無常用產品時顯示引導訊息
- [ ] 「找其他產品」展開/收起篩選器正常運作
- [ ] 預設字型為大字（文字比舊版稍大）
- [ ] Input 頁所有按鈕/輸入框都更大
- [ ] 整個提交流程（Home → Input → Confirm）端到端正常
