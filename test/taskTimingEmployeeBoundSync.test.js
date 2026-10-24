import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import vm from 'node:vm';

const source = await readFile(new URL('../google-apps-script/task_timing_employees_bound_sync.gs', import.meta.url), 'utf8');
function fixture() {
  const requests = [];
  const values = new Map([['TASK_TIMING_SUPABASE_URL', 'https://example.supabase.co'], ['TASK_TIMING_SUPABASE_SECRET_KEY', 'test-secret']]);
  const data = [['員工編號', '姓名', '密碼', '性別', '國籍', '到職日'], ['60', '測試員工', 'do-not-resubmit', '女', '台灣', '2026-10-05']];
  const context = vm.createContext({ Date, JSON, String, Object, encodeURIComponent, console: { log() {} },
    Utilities: { computeHmacSha256Signature: (value, key) => [...createHmac('sha256', key).update(value).digest()] },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => values.get(key) ?? null, setProperty: (key, value) => values.set(key, value) }) },
    SpreadsheetApp: { getUi: () => ({ alert() {} }), getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => 'Asia/Taipei', getSheetByName: () => ({ getDataRange: () => ({ getValues: () => data }) }) }) },
    UrlFetchApp: { fetch: (url, options) => {
      requests.push({ url, options });
      const body = options.method === 'get' ? (url.includes('/auth/') ? { users: [{ id: 'auth-60', email: '60@tasktiming.local' }] } : [{ employee_id: '60', auth_user_id: 'auth-60' }]) : {};
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(body) };
    } },
  });
  vm.runInContext(source, context);
  return { context, requests };
}
test('Sheet menu sync writes private fields separately without resetting existing passwords or deleting employees', () => {
  const { context, requests } = fixture();
  assert.equal(context.syncTaskTimingEmployeesToSupabase().updated, 1);
  assert.ok(requests.every(r => r.options.method !== 'delete'));
  const authWrites = requests.filter(r => r.url.includes('/auth/') && r.options.method !== 'get');
  assert.ok(authWrites.every(r => !r.options.payload.includes('password') && !r.options.payload.includes('do-not-resubmit')));
  const publicWrite = requests.find(r => r.url.includes('/rest/v1/task_timing_employees?') && r.options.method === 'post');
  assert.doesNotMatch(publicWrite.options.payload, /gender|nationality|hire_date|password/);
  const profileWrite = requests.find(r => r.url.includes('/task_timing_employee_profiles?'));
  const profile = JSON.parse(profileWrite.options.payload)[0];
  assert.equal(profile.gender, '女');
  assert.equal(profile.nationality, '台灣');
  assert.equal(profile.hire_date, '2026-10-05');
});
test('bound profile-only repair never touches Auth', () => {
  const { context, requests } = fixture();
  assert.equal(context.syncTaskTimingEmployeeProfilesToSupabase().updated, 1);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(r => !r.url.includes('/auth/') && r.options.method !== 'delete'));
});
