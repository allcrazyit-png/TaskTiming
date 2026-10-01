import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/google_apps_script.js', import.meta.url), 'utf8');

test('record upload writes Sheet first and then mirrors the same stable ID to Supabase', () => {
  assert.match(source, /data\.recordId \|\| Utilities\.getUuid\(\)/);
  assert.match(source, /sheet\.appendRow\(rowData\)/);
  assert.match(source, /taskTimingUpsertRecords_\(\[taskTimingRecordFromRow_/);
  assert.match(source, /Supabase紀錄ID/);
  assert.match(source, /Supabase同步狀態/);
});

test('record sync keeps secrets in Script Properties and retries unfinished rows', () => {
  assert.match(source, /getProperty\('TASK_TIMING_SUPABASE_URL'\)/);
  assert.match(source, /getProperty\('TASK_TIMING_SUPABASE_SECRET_KEY'\)/);
  assert.doesNotMatch(source, /TASK_TIMING_SUPABASE_SECRET_KEY\s*=\s*['"][^'"]+/);
  assert.match(source, /everyMinutes\(10\)/);
  assert.match(source, /after\(60 \* 1000\)/);
  assert.match(source, /ScriptApp\.deleteTrigger\(trigger\)/);
  assert.match(source, /'待重試'/);
});
