import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/task_timing_records.sql', import.meta.url), 'utf8');

test('production records use a stable source identity and keep raw records private', () => {
  assert.match(sql, /create table if not exists public\.task_timing_records/i);
  assert.match(sql, /record_id text primary key/i);
  assert.doesNotMatch(sql, /unique\s*\(source_sheet_id, source_sheet_name, source_row\)/i);
  assert.match(sql, /drop constraint if exists task_timing_records_source_sheet_id_source_sheet_name_sourc_key/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.task_timing_records from anon, authenticated/i);
  assert.match(sql, /grant select on public\.task_timing_records to authenticated/i);
  assert.doesNotMatch(sql, /grant select on public\.task_timing_records to anon/i);
});

test('battle report is an authenticated aggregate instead of a full-table browser scan', () => {
  assert.match(sql, /create or replace function public\.task_timing_battle_report/i);
  assert.match(sql, /revoke all on function public\.task_timing_battle_report\(date\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.task_timing_battle_report\(date\) to authenticated/i);
  assert.match(sql, /sum\(good_count\)/i);
  assert.match(sql, /count\(distinct operator_id\)/i);
  assert.match(sql, /limit 15/i);
});
