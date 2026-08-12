import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('../supabase/task_timing_products.sql', import.meta.url),
  'utf8',
);

test('migrates the product table to the part number and category primary key', () => {
  assert.match(sql, /drop constraint if exists task_timing_products_pkey/i);
  assert.match(sql, /add primary key \(part_number, category\)/i);
});

test('keeps anonymous read access to the product mirror', () => {
  assert.match(sql, /grant select on public\.task_timing_products to anon/i);
});
