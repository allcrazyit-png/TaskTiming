import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const employeeSyncSource = await readFile(
  new URL('../google-apps-script/task_timing_employees_sync.gs', import.meta.url),
  'utf8',
);
const context = vm.createContext({
  Date,
  JSON,
  String,
  Object,
  encodeURIComponent,
});
vm.runInContext(employeeSyncSource, context);

test('employee mirror is public-read-only and has no password column', async () => {
  const sql = await readFile(new URL('../supabase/task_timing_employees.sql', import.meta.url), 'utf8');

  assert.match(sql, /create table if not exists public\.task_timing_employees/i);
  assert.match(sql, /employee_id text primary key/i);
  assert.doesNotMatch(sql, /password/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /grant select on public\.task_timing_employees to anon/i);
  assert.match(sql, /for select to anon/i);
});

test('maps an employee row and preserves a blank password as no password update', () => {
  const employee = context.employeeRowToTaskTimingEmployee_(
    ['員工編號', '姓名', '密碼'],
    ['E01', '王小美', ''],
  );

  assert.deepEqual(JSON.parse(JSON.stringify(employee)), {
    employee_id: 'E01', employee_name: '王小美', password: '',
  });
});

test('normalizes bracket annotations in employee headers', () => {
  const headers = context.normalizeTaskTimingHeaders_(['員工編號[登入]', '姓名', '密碼']);
  assert.deepEqual(JSON.parse(JSON.stringify(headers)), ['員工編號', '姓名', '密碼']);
});

test('uses the same percent-encoded Auth email for employee IDs with a slash', () => {
  assert.equal(context.taskTimingEmployeeAuthEmail_(' A/B '), 'a%2Fb@tasktiming.local');
});

test('retains a numeric zero employee ID like the browser helper', () => {
  assert.equal(context.taskTimingEmployeeAuthEmail_(0), '0@tasktiming.local');
});
