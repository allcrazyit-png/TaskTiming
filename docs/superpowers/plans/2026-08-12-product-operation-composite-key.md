# Product Operation Composite Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror every non-injection Sheet operation independently by using `part_number + category` as the Supabase identity.

**Architecture:** Migrate `task_timing_products` from a single `part_number` primary key to the composite primary key `(part_number, category)`. The Apps Script filters `射出`, deduplicates only an identical part/category pair, upserts against the new composite conflict target, and deletes rows whose pair is absent from the current Sheet set. The React mapping keeps its existing Chinese product fields and favourites already use the same pair.

**Tech Stack:** Supabase SQL, Google Apps Script, React 19, Node built-in test runner.

---

## File structure

- Modify `supabase/task_timing_products.sql`: migrate the primary key safely and preserve anonymous read-only policy.
- Modify `google-apps-script/task_timing_products_sync.gs`: filter injection rows, use pair keys for deduplication/reconciliation, and report detailed counts.
- Modify `test/taskTimingProductsSync.test.js`: verify operation preservation, injection removal, and pair-based obsolete deletion.
- Modify `test/taskTimingProducts.test.js`: verify the browser receives two same-part, different-category rows.
- Create `test/taskTimingProductsSchema.test.js`: static migration contract test.

### Task 1: Lock down composite-key data behavior

**Files:**

- Modify: `test/taskTimingProductsSync.test.js`
- Modify: `test/taskTimingProducts.test.js`

- [ ] **Step 1: Write the failing Apps Script pair tests**

Replace the duplicate fixture so it contains `A/組裝`, `A/包裝`, and a later duplicate `A/組裝`. Assert the result keeps `A/包裝` and the later `A/組裝`.

Add a sync fixture with rows `A/組裝`, `A/包裝`, `A/檢查`, `A/射出`; existing rows `A/組裝`, `A/射出`, `OLD/組裝`. Assert the POST payload contains exactly the three non-injection pairs, DELETE requests target `A/射出` and `OLD/組裝`, and the result is `{ synced: 3, skippedInjection: 1, skippedDuplicates: 0, deleted: 2 }`.

- [ ] **Step 2: Write the failing browser mapping test**

Append this test to `test/taskTimingProducts.test.js`:

```js
test('keeps same part numbers when their operations differ', () => {
  assert.deepEqual(selectAssemblyProducts([
    { part_number: 'A', product_name: '組裝', car_model: 'M', category: '組裝' },
    { part_number: 'A', product_name: '包裝', car_model: 'M', category: '包裝' },
  ]).map(product => [product['品番'], product['類別']]), [
    ['A', '組裝'], ['A', '包裝'],
  ]);
});
```

- [ ] **Step 3: Verify RED**

Run: `node --test test/taskTimingProductsSync.test.js test/taskTimingProducts.test.js`

Expected: pair tests fail because the current code identifies rows only by `part_number` and does not filter injection rows in Apps Script.

### Task 2: Migrate the Supabase identity

**Files:**

- Modify: `supabase/task_timing_products.sql`
- Create: `test/taskTimingProductsSchema.test.js`

- [ ] **Step 1: Write the failing schema test**

Create a test that reads the SQL file and asserts it contains all of:

```js
assert.match(sql, /drop constraint if exists task_timing_products_pkey/i);
assert.match(sql, /add primary key \(part_number, category\)/i);
assert.match(sql, /grant select on public\.task_timing_products to anon/i);
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/taskTimingProductsSchema.test.js`

Expected: FAIL because the table currently has `part_number text primary key` and no migration.

- [ ] **Step 3: Add idempotent SQL migration**

Keep `create table if not exists` for new projects but define `part_number text not null` and `category text not null default ''` without a single-column primary key. Immediately after it add:

```sql
alter table public.task_timing_products
drop constraint if exists task_timing_products_pkey;

alter table public.task_timing_products
add primary key (part_number, category);
```

Keep the existing RLS, anon select grant, policy recreation, and category index. This migration is run once in the Supabase SQL Editor before running the new sync.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/taskTimingProductsSchema.test.js`

Expected: schema test passes.

### Task 3: Implement pair-keyed non-injection mirror sync

**Files:**

- Modify: `google-apps-script/task_timing_products_sync.gs`

- [ ] **Step 1: Add a stable pair key and classify source rows**

Add:

```js
function taskTimingProductKey_(product) {
  return product.part_number + '\u0000' + product.category;
}

function taskTimingPrepareAssemblyProducts_(rows) {
  var nonEmpty = rows.filter(function (product) { return product !== null; });
  var injectionCount = nonEmpty.filter(function (product) { return product.category === '射出'; }).length;
  var assemblyRows = nonEmpty.filter(function (product) { return product.category !== '射出'; });
  return { products: dedupeTaskTimingProducts_(assemblyRows), injectionCount: injectionCount, sourceCount: nonEmpty.length };
}
```

Change `dedupeTaskTimingProducts_` to track `taskTimingProductKey_(product)`, preserving only the final identical pair.

- [ ] **Step 2: Make reconciliation pair-based**

Change the read endpoint to `?select=part_number,category`. Replace obsolete comparison and deletion input with product rows. Build current keys using `taskTimingProductKey_`; delete using both filters:

```js
baseUrl + '/rest/v1/task_timing_products?part_number=eq.' + encodeURIComponent(product.part_number)
  + '&category=eq.' + encodeURIComponent(product.category)
```

Use `?on_conflict=part_number,category` for the upsert endpoint.

- [ ] **Step 3: Return and display full counts**

After preparing products, compute `skippedDuplicates = prepared.sourceCount - prepared.injectionCount - prepared.products.length`. Reject an empty non-injection set before writes. Return:

```js
{ synced: products.length, skippedInjection: prepared.injectionCount, skippedDuplicates: skippedDuplicates, deleted: obsoleteProducts.length }
```

Display all four counts in the success alert.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/taskTimingProductsSync.test.js test/taskTimingProducts.test.js`

Expected: all tests pass; `A/組裝`, `A/包裝`, and `A/檢查` are preserved, while `射出` is not posted and is deleted if present.

### Task 4: Complete verification and deployment handoff

**Files:**

- Modify: `docs/task-timing-maintenance.md`

- [ ] **Step 1: Update maintenance rule**

Replace the product maintenance statement with: Sheet is the source; Supabase mirrors only non-injection `品番＋類別`; same part number across operations is intentional and retained.

- [ ] **Step 2: Run complete local verification**

Run: `npm test && cp google-apps-script/task_timing_products_sync.gs /private/tmp/task_timing_products_sync_check.js && node --check /private/tmp/task_timing_products_sync_check.js && git diff --check`

Expected: all tests pass, syntax check exits 0, and no whitespace errors print.

- [ ] **Step 3: Commit and state external steps**

Run: `git add supabase/task_timing_products.sql google-apps-script/task_timing_products_sync.gs test/taskTimingProductsSync.test.js test/taskTimingProducts.test.js test/taskTimingProductsSchema.test.js docs/task-timing-maintenance.md`

Run: `git commit -m "feat: preserve product operations in Supabase sync"`

Then instruct the operator to run the SQL migration in Supabase, paste/save the Apps Script to the bound product Sheet project, then run the product sync once. No frontend deploy is required.
