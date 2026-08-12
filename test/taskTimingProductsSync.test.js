import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const syncSource = await readFile(
  new URL('../google-apps-script/task_timing_products_sync.gs', import.meta.url),
  'utf8',
);
const syncContext = {};
vm.runInNewContext(syncSource, syncContext);

test('keeps only the last product-master row for duplicate part numbers', () => {
  const products = syncContext.dedupeTaskTimingProducts_([
      { part_number: 'A', product_name: '舊資料' },
      { part_number: 'B', product_name: '唯一資料' },
      { part_number: 'A', product_name: '新資料' },
    ]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(products)),
    [
      { part_number: 'B', product_name: '唯一資料' },
      { part_number: 'A', product_name: '新資料' },
    ],
  );
});

function createProductSyncContext({ rows, existingPartNumbers, upsertStatus = 201 }) {
  const requests = [];
  const alerts = [];
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => key === 'TASK_TIMING_SUPABASE_URL' ? 'https://example.supabase.co' : 'secret',
      }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => ({ getDataRange: () => ({ getValues: () => rows }) }),
      }),
      getUi: () => ({ alert: message => alerts.push(message) }),
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        requests.push({ url, options });
        const isRead = options.method === 'get';
        const isDelete = options.method === 'delete';
        const status = isRead || isDelete ? 200 : upsertStatus;
        return {
          getResponseCode: () => status,
          getContentText: () => isRead
            ? JSON.stringify(existingPartNumbers.map(part_number => ({ part_number })))
            : '',
        };
      },
    },
    encodeURIComponent,
  };
  vm.runInNewContext(syncSource, context);
  return { context, requests, alerts };
}

test('sync deletes Supabase products missing from the current Sheet master', () => {
  const { context, requests, alerts } = createProductSyncContext({
    rows: [['品番', '品名'], ['A', 'A 品'], ['B', 'B 品']],
    existingPartNumbers: ['A', 'B', 'OLD'],
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.syncTaskTimingProductsToSupabase())),
    { synced: 2, deleted: 1 },
  );
  const deletes = requests.filter(request => request.options.method === 'delete');
  assert.equal(deletes.length, 1);
  assert.match(deletes[0].url, /part_number=eq\.OLD/);
  assert.match(alerts[0], /已同步 2 筆產品，刪除 1 筆舊產品/);
});

test('sync does not delete products when an upsert fails', () => {
  const { context, requests } = createProductSyncContext({
    rows: [['品番', '品名'], ['A', 'A 品']],
    existingPartNumbers: ['A', 'OLD'],
    upsertStatus: 500,
  });

  assert.throws(() => context.syncTaskTimingProductsToSupabase(), /Supabase 500/);
  assert.equal(requests.filter(request => request.options.method === 'get').length, 0);
  assert.equal(requests.filter(request => request.options.method === 'delete').length, 0);
});
