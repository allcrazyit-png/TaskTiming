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

test('keeps only the last product-master row for duplicate part number and category pairs', () => {
  const products = syncContext.dedupeTaskTimingProducts_([
      { part_number: 'A', category: '組裝', product_name: '舊資料' },
      { part_number: 'A', category: '包裝', product_name: '包裝資料' },
      { part_number: 'A', category: '組裝', product_name: '新資料' },
    ]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(products)),
    [
      { part_number: 'A', category: '包裝', product_name: '包裝資料' },
      { part_number: 'A', category: '組裝', product_name: '新資料' },
    ],
  );
});

function createProductSyncContext({ rows, existingPairs, upsertStatus = 201 }) {
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
            ? JSON.stringify(existingPairs.map(([part_number, category]) => ({ part_number, category })))
            : '',
        };
      },
    },
    encodeURIComponent,
  };
  vm.runInNewContext(syncSource, context);
  return { context, requests, alerts };
}

test('sync mirrors every non-injection part number and category pair', () => {
  const { context, requests, alerts } = createProductSyncContext({
    rows: [
      ['品番', '品名', '類別'],
      ['A', 'A 組裝', '組裝'],
      ['A', 'A 包裝', '包裝'],
      ['A', 'A 檢查', '檢查'],
      ['A', 'A 射出', '射出'],
    ],
    existingPairs: [['A', '組裝'], ['A', '射出'], ['OLD', '組裝']],
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.syncTaskTimingProductsToSupabase())),
    { synced: 3, skippedInjection: 1, skippedDuplicates: 0, deleted: 2 },
  );

  const posted = requests
    .filter(request => request.options.method === 'post')
    .flatMap(request => JSON.parse(request.options.payload))
    .map(product => [product.part_number, product.category]);
  assert.deepEqual(posted, [['A', '組裝'], ['A', '包裝'], ['A', '檢查']]);

  const deletes = requests
    .filter(request => request.options.method === 'delete')
    .map(request => request.url);
  assert.equal(deletes.length, 2);
  assert.match(deletes[0], /part_number=eq\.A&category=eq\.%E5%B0%84%E5%87%BA/);
  assert.match(deletes[1], /part_number=eq\.OLD&category=eq\.%E7%B5%84%E8%A3%9D/);
  assert.match(
    alerts[0],
    /已同步 3 筆產品，略過 1 筆射出、0 筆重複，刪除 2 筆舊產品/,
  );
});

test('sync does not delete products when an upsert fails', () => {
  const { context, requests } = createProductSyncContext({
    rows: [['品番', '品名', '類別'], ['A', 'A 品', '組裝']],
    existingPairs: [['A', '組裝'], ['OLD', '組裝']],
    upsertStatus: 500,
  });

  assert.throws(() => context.syncTaskTimingProductsToSupabase(), /Supabase 500/);
  assert.equal(requests.filter(request => request.options.method === 'get').length, 0);
  assert.equal(requests.filter(request => request.options.method === 'delete').length, 0);
});
