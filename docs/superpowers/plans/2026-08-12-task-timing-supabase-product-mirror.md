# Task Timing Supabase Product Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the assembly-report website load its product master from a complete Supabase mirror while Google Sheet remains the editing source.

**Architecture:** A manually run Apps Script copies every product-master row into a new `task_timing_products` table using `part_number` as the upsert key. A small browser-side API module requests only non-injection rows and maps the database fields to the current Chinese-key product contract, so `Home.jsx` keeps its existing UI and navigation behavior.

**Tech Stack:** Google Apps Script, Supabase PostgREST with RLS, React 19, Vite, Node built-in test runner.

---

## File structure

- Create: `supabase/task_timing_products.sql` — table, read-only RLS policy, and index.
- Create: `google-apps-script/task_timing_products_sync.gs` — pasteable product-master Sheet sync script.
- Create: `src/services/taskTimingProducts.js` — fetch and mapping boundary for the React UI.
- Create: `test/taskTimingProducts.test.js` — Node tests for mapping and non-injection filtering.
- Modify: `src/pages/Home.jsx` — call the new service in place of the product-master GAS request.
- Modify: `package.json` — add the Node test command.

### Task 1: Add the Supabase schema

**Files:**
- Create: `supabase/task_timing_products.sql`

- [ ] **Step 1: Create the table and read-only access policy**

```sql
create table if not exists public.task_timing_products (
  part_number text primary key,
  product_name text not null default '',
  car_model text not null default '',
  category text not null default '',
  ct_time_seconds numeric,
  product_image text,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.task_timing_products enable row level security;
grant select on public.task_timing_products to anon;

create policy "Anonymous users can read task timing products"
on public.task_timing_products
for select to anon
using (true);

create index if not exists task_timing_products_category_idx
on public.task_timing_products (category);
```

- [ ] **Step 2: Run the SQL in the Supabase SQL Editor**

Run: paste `supabase/task_timing_products.sql` into the project SQL Editor and click Run.

Expected: the `task_timing_products` table appears in Table Editor; no rows exist yet.

### Task 2: Write the product mapping test

**Files:**
- Create: `test/taskTimingProducts.test.js`
- Modify: `package.json`

- [ ] **Step 1: Add the test command**

```json
"test": "node --test"
```

Add it directly after the existing `lint` script.

- [ ] **Step 2: Write the failing mapping tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapTaskTimingProduct, selectAssemblyProducts } from '../src/services/taskTimingProducts.js';

test('maps a Supabase product row to the existing Chinese product contract', () => {
  assert.deepEqual(mapTaskTimingProduct({
    part_number: '55514-02340', product_name: '側裙', car_model: '753D',
    category: '組裝', ct_time_seconds: 45, product_image: '55514-02340_main.jpg',
  }), {
    '品番': '55514-02340', '品名': '側裙', '車型': '753D', '類別': '組裝',
    'CT時間(秒)': 45, '產品圖片': '55514-02340_main.jpg',
  });
});

test('excludes injection products from the assembly product list', () => {
  assert.deepEqual(selectAssemblyProducts([
    { part_number: 'A', product_name: '組裝品', car_model: 'A', category: '組裝' },
    { part_number: 'B', product_name: '射出品', car_model: 'B', category: '射出' },
  ]).map(product => product['品番']), ['A']);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- test/taskTimingProducts.test.js`

Expected: FAIL because `src/services/taskTimingProducts.js` does not exist.

### Task 3: Implement the browser-side product service

**Files:**
- Create: `src/services/taskTimingProducts.js`

- [ ] **Step 1: Implement only the tested mapping and filter**

```js
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function mapTaskTimingProduct(row) {
  return {
    '品番': row.part_number,
    '品名': row.product_name,
    '車型': row.car_model,
    '類別': row.category,
    'CT時間(秒)': row.ct_time_seconds ?? 0,
    '產品圖片': row.product_image ?? '',
  };
}

export function selectAssemblyProducts(rows) {
  return rows
    .filter(row => row.category !== '射出')
    .map(mapTaskTimingProduct)
    .filter(product => product['車型'] && product['品番']);
}
```

- [ ] **Step 2: Run the mapping test to verify it passes**

Run: `npm test -- test/taskTimingProducts.test.js`

Expected: PASS with 2 tests.

- [ ] **Step 3: Add the read request**

```js
export async function fetchTaskTimingProducts({ signal } = {}) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/task_timing_products?select=part_number,product_name,car_model,category,ct_time_seconds,product_image&category=neq.%E5%B0%84%E5%87%BA&order=part_number.asc`,
    { headers: { apikey: SUPABASE_PUBLISHABLE_KEY }, signal },
  );
  if (!response.ok) throw new Error(`Supabase products request failed: ${response.status}`);
  return selectAssemblyProducts(await response.json());
}
```

### Task 4: Switch the homepage product source

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Import the new product service**

```js
import { fetchTaskTimingProducts } from '../services/taskTimingProducts';
```

- [ ] **Step 2: Replace only the product-master GAS fetch in the homepage effect**

Replace the `prunePattern`, `productUrl`, and `fetchWithRetry(productUrl, ...)` block with:

```js
const controller = new AbortController();
fetchTaskTimingProducts({ signal: controller.signal })
  .then(productData => {
    setProducts(productData);
    writeCache(CACHE_KEY_PRODUCTS, productData);
    console.log('Products loaded from Supabase:', productData.length);
  })
  .catch(error => console.warn('Supabase product load failed; retaining local cache.', error))
  .finally(() => setLoading(false));

return () => controller.abort();
```

Keep the employee, missing-work-day, weather, product-card, favorites, Confirm, and BattleReport logic unchanged.

- [ ] **Step 3: Run the mapping test and lint**

Run: `npm test -- test/taskTimingProducts.test.js && npm run lint`

Expected: mapping tests PASS and ESLint exits 0.

### Task 5: Add the Apps Script manual full sync

**Files:**
- Create: `google-apps-script/task_timing_products_sync.gs`

- [ ] **Step 1: Add the manual sync menu and row mapper**

The script must read `TASK_TIMING_SUPABASE_URL` and `TASK_TIMING_SUPABASE_SECRET_KEY` from Script Properties; map the six fields defined in the design; include every nonblank `品番`; and never filter out `射出` rows.

```js
function onOpen() {
  SpreadsheetApp.getUi().createMenu('組裝報表工具')
    .addItem('同步產品主檔到 Supabase', 'syncTaskTimingProductsToSupabase')
    .addToUi();
}

function productRowToTaskTimingProduct_(headers, row) {
  const source = Object.fromEntries(headers.map((header, index) => [String(header).trim(), row[index]]));
  const partNumber = String(source['品番'] || '').trim();
  if (!partNumber) return null;
  return {
    part_number: partNumber,
    product_name: String(source['品名'] || ''),
    car_model: String(source['車型'] || ''),
    category: String(source['類別'] || ''),
    ct_time_seconds: source['CT時間(秒)'] === '' ? null : Number(source['CT時間(秒)']) || null,
    product_image: String(source['產品圖片'] || ''),
    source_updated_at: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Add batched upsert and explicit error reporting**

```js
const response = UrlFetchApp.fetch(`${url}/rest/v1/task_timing_products?on_conflict=part_number`, {
  method: 'post', contentType: 'application/json',
  headers: { apikey: secret, Authorization: `Bearer ${secret}`, Prefer: 'resolution=merge-duplicates,return=minimal' },
  payload: JSON.stringify(batch), muteHttpExceptions: true,
});
if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
  throw new Error(`Supabase ${response.getResponseCode()}: ${response.getContentText()}`);
}
```

Use batches of 200 rows, display the total count on success, and display the thrown error on failure. Do not delete rows from Supabase in this first release.

- [ ] **Step 3: Manually test the sync in the master Sheet**

Run: use `組裝報表工具 → 同步產品主檔到 Supabase` in the product-master Sheet.

Expected: a success message with the product count; Table Editor contains both an injection row and a non-injection row, each with `ct_time_seconds` populated where Sheet has CT.

### Task 6: Configure and validate the local browser build

**Files:**
- Create locally only: `.env.local`

- [ ] **Step 1: Add only public browser configuration**

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<public-key>
```

Never add the secret/service role key to `.env.local`, source files, or Git.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: Vite completes and writes `dist/`.

- [ ] **Step 3: Verify phone-facing behavior locally**

Run: `npm run dev -- --host 0.0.0.0`.

Expected: the homepage has product cards without waiting for a GAS product-master request; opening a product still passes the correct CT and image to Input.

### Task 7: Review and commit

**Files:**
- Review: all files above

- [ ] **Step 1: Inspect scope and verification output**

Run: `git diff --check && git status --short && npm test -- test/taskTimingProducts.test.js && npm run lint && npm run build`

Expected: no whitespace errors; only the intended Supabase schema, sync script, service, homepage, test, and package changes are listed; all commands exit 0.

- [ ] **Step 2: Commit only the feature files**

```bash
git add supabase/task_timing_products.sql google-apps-script/task_timing_products_sync.gs src/services/taskTimingProducts.js src/pages/Home.jsx test/taskTimingProducts.test.js package.json
git commit -m "feat: load task timing products from supabase"
```

Do not push or deploy. Apps Script and Supabase changes are separate manual release steps and must be reported separately.
