# Product Full Mirror Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the manual product sync keep Supabase part numbers exactly equal to the non-empty product part numbers in Sheet「產品總表」.

**Architecture:** Keep the existing batched upsert. Only after every upsert succeeds, fetch existing Supabase part numbers, calculate `existing - sheet`, and delete each result. The existing catch stops the deletion phase after any preceding error.

**Tech Stack:** Google Apps Script, Supabase PostgREST, Node built-in test runner and VM.

---

### Task 1: Test stale-row deletion

**Files:**

- Modify: `test/taskTimingProductsSync.test.js`

- [ ] **Step 1: Write a failing full-sync test**

Create a fake Apps Script context with Sheet rows `[['品番', '品名'], ['A', 'A 品'], ['B', 'B 品']]`, existing Supabase rows `A`, `B`, `OLD`, and a fake `UrlFetchApp.fetch` that records every `{ url, options }`. Make GET return JSON `[{part_number:'A'}, {part_number:'B'}, {part_number:'OLD'}]`, DELETE return 200, and POST return 201.

Add assertions that `syncTaskTimingProductsToSupabase()` returns `{ synced: 2, deleted: 1 }`, exactly one recorded DELETE has `part_number=eq.OLD`, and the alert contains `已同步 2 筆產品，刪除 1 筆舊產品`.

- [ ] **Step 2: Verify RED**

Run: `node --test test/taskTimingProductsSync.test.js`

Expected: FAIL because current code does not send GET/DELETE and returns only a numeric count.

### Task 2: Reconcile the Supabase mirror

**Files:**

- Modify: `google-apps-script/task_timing_products_sync.gs`

- [ ] **Step 1: Add the pure difference helper**

```js
function taskTimingObsoleteProductPartNumbers_(existingRows, currentProducts) {
  var current = {};
  currentProducts.forEach(function (product) { current[product.part_number] = true; });
  return existingRows.map(function (row) { return String(row.part_number || '').trim(); })
    .filter(function (partNumber) { return partNumber && !current[partNumber]; });
}
```

- [ ] **Step 2: Add authenticated read/delete helpers**

The read helper requests `GET <baseUrl>/rest/v1/task_timing_products?select=part_number` with `apikey` and `Authorization: Bearer <secret>`, verifies 2xx, parses an array, and throws otherwise.

The delete helper requests `DELETE <baseUrl>/rest/v1/task_timing_products?part_number=eq.<encodeURIComponent(partNumber)>` with the same headers, verifies 2xx, and throws otherwise.

- [ ] **Step 3: Call reconciliation after all upserts**

Use `baseUrl = url.replace(/\/$/, '')`. Keep the current upsert loop. Immediately after its successful completion, execute:

```js
var existingRows = taskTimingReadSupabaseProductPartNumbers_(baseUrl, secret);
var obsoletePartNumbers = taskTimingObsoleteProductPartNumbers_(existingRows, products);
obsoletePartNumbers.forEach(function (partNumber) {
  taskTimingDeleteSupabaseProduct_(baseUrl, secret, partNumber);
});
var result = { synced: products.length, deleted: obsoletePartNumbers.length };
SpreadsheetApp.getUi().alert('同步完成：已同步 ' + result.synced + ' 筆產品，刪除 ' + result.deleted + ' 筆舊產品。');
return result;
```

Replace the current single-count alert and numeric return. Since this block follows the upsert loop, an upsert failure cannot start deletion.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/taskTimingProductsSync.test.js`

Expected: stale-row test passes and exactly one DELETE is sent for `OLD`.

### Task 3: Lock down failure behavior and verify

**Files:**

- Modify: `test/taskTimingProductsSync.test.js`

- [ ] **Step 1: Add a failed-upsert test**

Use the same fake context but return HTTP 500 from POST. Assert `syncTaskTimingProductsToSupabase()` throws `/Supabase 500/` and no recorded request has method `get` or `delete`.

- [ ] **Step 2: Verify tests**

Run: `node --test test/taskTimingProductsSync.test.js`

Expected: all tests pass.

- [ ] **Step 3: Run complete verification**

Run: `npm test && node --check google-apps-script/task_timing_products_sync.gs && git diff --check`

Expected: all tests pass, syntax check exits 0, and no whitespace errors print.

- [ ] **Step 4: Commit**

Run: `git add google-apps-script/task_timing_products_sync.gs test/taskTimingProductsSync.test.js`

Run: `git commit -m "feat: mirror product deletions to Supabase"`
