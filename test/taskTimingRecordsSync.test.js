import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/google_apps_script.js', import.meta.url), 'utf8');
const context = vm.createContext({
  Date,
  JSON,
  String,
  Object,
  Array,
  Math,
  console,
  isFinite,
  parseFloat,
  parseInt,
});
vm.runInContext(source, context);

test('record upload writes Sheet first and then mirrors the same stable ID to Supabase', () => {
  assert.match(source, /data\.recordId \|\| Utilities\.getUuid\(\)/);
  assert.match(source, /sheet\.appendRow\(rowData\)/);
  assert.match(source, /taskTimingUpsertRecords_\(\[taskTimingRecordFromRow_/);
  assert.match(source, /Supabase紀錄ID/);
  assert.match(source, /Supabase同步狀態/);
  assert.match(source, /ApiKey: config\.secret/);
  assert.doesNotMatch(source, /\bapikey: config\.secret/);
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

test('manual record sync deletes Supabase records missing from the Sheet', () => {
  assert.match(source, /function syncAndReconcileTaskTimingRecordsToSupabase\(\)/);
  assert.match(source, /method: 'delete'/);
  assert.match(source, /task_timing_records\?source_sheet_id=eq\./);
  assert.match(source, /record_id=in\.\(/);
  assert.match(source, /立即完整同步生產紀錄/);
});

test('scheduled record retry does not perform destructive reconciliation', () => {
  const continuation = source.match(/function continueTaskTimingRecordSync\(\)\s*{[^}]*}/)?.[0] || '';
  assert.match(continuation, /return syncTaskTimingRecordsToSupabase\(\);/);
  assert.match(source, /var handler = 'syncTaskTimingRecordsToSupabase';/);
  assert.doesNotMatch(continuation, /syncAndReconcileTaskTimingRecordsToSupabase/);
});

test('setup installs row-deletion triggers for records and employees', () => {
  assert.match(source, /taskTimingEnsureSheetChangeTrigger_\('taskTimingHandleRecordSheetChange', RECORDS_SS_ID\)/);
  assert.match(source, /taskTimingEnsureSheetChangeTrigger_\('taskTimingHandleEmployeeSheetChange', PRODUCTS_SS_ID\)/);
  assert.match(source, /\.forSpreadsheet\(spreadsheetId\)[\s\S]*?\.onChange\(\)/);
});

test('record row deletion automatically reconciles without a confirmation dialog', () => {
  const handler = source.match(/function taskTimingHandleRecordSheetChange\(e\)\s*{[\s\S]*?\n}/)?.[0] || '';
  assert.match(handler, /e\.changeType !== 'REMOVE_ROW'/);
  assert.match(handler, /taskTimingSyncAndReconcileRecords_\(\{ automatic: true \}\)/);
  assert.doesNotMatch(handler, /SpreadsheetApp\.getUi/);
});

test('finds only Supabase record IDs that no longer exist in the Sheet', () => {
  const obsolete = context.taskTimingObsoleteRecordIds_(
    ['record-a', 'record-b', 'record-c'],
    ['record-a', 'record-c'],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(obsolete)), ['record-b']);
});

test('manual reconciliation refuses deletion while record upserts are unfinished', () => {
  assert.match(
    source,
    /if \(syncResult\.failed > 0 \|\| syncResult\.remaining > 0\)[\s\S]*?未執行刪除/,
  );
});

test('manual reconciliation asks for confirmation with the exact delete count', () => {
  assert.match(source, /確認刪除 Supabase 生產紀錄/);
  assert.match(source, /obsoleteRecordIds\.length \+ ' 筆紀錄將從 Supabase 永久刪除/);
  assert.match(source, /ui\.ButtonSet\.YES_NO/);
  assert.match(source, /confirmation !== ui\.Button\.YES/);
});
