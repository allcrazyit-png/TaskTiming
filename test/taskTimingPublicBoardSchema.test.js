import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/20261121_public_board.sql', import.meta.url), 'utf8');
const fnBody = sql.slice(sql.search(/create or replace function public\.task_timing_public_board/i));

test('board keys are stored only as hashes and are invisible to browsers', () => {
  assert.match(sql, /create table if not exists public\.task_timing_board_keys/i);
  assert.match(sql, /key_hash text primary key/i);
  assert.match(sql, /alter table public\.task_timing_board_keys enable row level security/i);
  assert.match(sql, /revoke all on (table )?public\.task_timing_board_keys from anon, authenticated/i);
  assert.doesNotMatch(sql, /grant [^;]* on (table )?public\.task_timing_board_keys/i);
});

test('public board is a key-checked definer function callable by anon', () => {
  assert.match(fnBody, /security definer/i);
  assert.match(fnBody, /set search_path = public/i);
  assert.match(fnBody, /encode\(sha256\(convert_to\(p_key, 'UTF8'\)\), 'hex'\)/i);
  assert.match(fnBody, /errcode = '28000'/i);
  assert.match(fnBody, /at time zone 'Asia\/Taipei'/i);
  assert.match(sql, /revoke all on function public\.task_timing_public_board\(text\) from public/i);
  assert.match(sql, /grant execute on function public\.task_timing_public_board\(text\) to anon, authenticated/i);
});

test('public board returns aggregates and trilingual notice text only', () => {
  assert.match(fnBody, /1xo4YhDuxh-wpstg7tmAqW4orB9aBheF1CUFzM1TDWKw/);
  for (const field of ['content', 'content_vi', 'content_id']) assert.match(fnBody, new RegExp(`'${field}'`));
  for (const leak of ['operator_label', 'operator_name', 'part_number', 'product_name', 'live_feed']) assert.doesNotMatch(fnBody, new RegExp(leak));
});
