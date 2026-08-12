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
