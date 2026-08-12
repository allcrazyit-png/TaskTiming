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
  const tableDefinition = sql.match(/create table if not exists public\.task_timing_employees\s*\([\s\S]*?\);/i)?.[0];

  assert.match(sql, /create table if not exists public\.task_timing_employees/i);
  assert.ok(tableDefinition);
  assert.match(sql, /employee_id text primary key/i);
  assert.doesNotMatch(tableDefinition, /password/i);
  assert.match(sql, /drop column if exists password/i);
  assert.match(sql, /drop column if exists employee_password/i);
  assert.match(sql, /add column if not exists auth_user_id uuid/i);
  assert.match(sql, /alter column auth_user_id set not null/i);
  assert.match(sql, /create unique index if not exists task_timing_employees_auth_user_id_idx/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.task_timing_employees from anon, authenticated/i);
  assert.match(sql, /grant select on public\.task_timing_employees to anon/i);
  assert.match(sql, /drop policy if exists "Anonymous users can (insert|update|delete|write) task timing employees"/i);
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

test('maps numeric zero employee IDs without dropping them', () => {
  const employee = context.employeeRowToTaskTimingEmployee_(
    ['員工編號', '姓名', '密碼'],
    [0, '王小美', ''],
  );

  assert.deepEqual(JSON.parse(JSON.stringify(employee)), {
    employee_id: '0', employee_name: '王小美', password: '',
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

test('retries an Auth-created employee by reconciling its email before public upsert', () => {
  const requests = [];
  const alerts = [];
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => key === 'TASK_TIMING_SUPABASE_URL' ? 'https://example.supabase.co' : 'secret',
    }),
  };
  context.SpreadsheetApp = {
    getUi: () => ({ alert: message => alerts.push(message) }),
    getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getDataRange: () => ({ getValues: () => [
          ['員工編號', '姓名', '密碼'],
          ['E01', '王小美', ''],
        ] }),
      }),
    }),
  };
  context.UrlFetchApp = {
    fetch: (url, options) => {
      requests.push({ url, options });
      if (url.includes('/rest/v1/task_timing_employees?select=')) {
        return { getResponseCode: () => 200, getContentText: () => '[]' };
      }
      if (url.includes('/auth/v1/admin/users?')) {
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify([
          { id: 'auth-existing-uuid', email: 'e01@tasktiming.local' },
        ]) };
      }
      if (url.includes('/auth/v1/admin/users/auth-existing-uuid')) {
        return { getResponseCode: () => 200, getContentText: () => '{}' };
      }
      if (url.includes('/rest/v1/task_timing_employees?on_conflict=')) {
        return { getResponseCode: () => 201, getContentText: () => '' };
      }
      throw new Error('Unexpected request: ' + url);
    },
  };

  assert.deepEqual(JSON.parse(JSON.stringify(context.syncTaskTimingEmployeesToSupabase())), {
    created: 0, updated: 1, failed: 0,
  });
  assert.equal(requests.some(request => request.url === 'https://example.supabase.co/auth/v1/admin/users' && request.options.method === 'post'), false);
  const authUpdate = requests.find(request => request.url.includes('/auth/v1/admin/users/auth-existing-uuid') && request.options.method === 'put');
  assert.ok(authUpdate);
  assert.doesNotMatch(authUpdate.options.payload, /password/i);
  const publicWrite = requests.find(request => request.url.includes('/rest/v1/task_timing_employees?on_conflict='));
  assert.match(publicWrite.options.payload, /"auth_user_id":"auth-existing-uuid"/);
  assert.doesNotMatch(publicWrite.options.payload, /password/i);
  assert.match(alerts[0], /新增 0 筆、更新 1 筆、失敗 0 筆/);
});

test('retries an encoded employee email despite Auth returning lowercase percent escapes', () => {
  const requests = [];
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => key === 'TASK_TIMING_SUPABASE_URL' ? 'https://example.supabase.co' : 'secret',
    }),
  };
  context.SpreadsheetApp = {
    getUi: () => ({ alert: () => {} }),
    getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getDataRange: () => ({ getValues: () => [
          ['員工編號', '姓名', '密碼'],
          ['A/B', '王小美', ''],
        ] }),
      }),
    }),
  };
  context.UrlFetchApp = {
    fetch: (url, options) => {
      requests.push({ url, options });
      if (url.includes('/rest/v1/task_timing_employees?select=')) {
        return { getResponseCode: () => 200, getContentText: () => '[]' };
      }
      if (url.includes('/auth/v1/admin/users?')) {
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify([
          { id: 'auth-slash-uuid', email: 'a%2fb@tasktiming.local' },
        ]) };
      }
      if (url.includes('/auth/v1/admin/users/auth-slash-uuid')) {
        return { getResponseCode: () => 200, getContentText: () => '{}' };
      }
      if (url.includes('/rest/v1/task_timing_employees?on_conflict=')) {
        return { getResponseCode: () => 201, getContentText: () => '' };
      }
      throw new Error('Unexpected request: ' + url);
    },
  };

  context.syncTaskTimingEmployeesToSupabase();
  assert.equal(requests.some(request => request.url === 'https://example.supabase.co/auth/v1/admin/users' && request.options.method === 'post'), false);
  assert.equal(requests.some(request => request.url.includes('/auth/v1/admin/users/auth-slash-uuid') && request.options.method === 'put'), true);
  const publicWrite = requests.find(request => request.url.includes('/rest/v1/task_timing_employees?on_conflict='));
  assert.match(publicWrite.options.payload, /"auth_user_id":"auth-slash-uuid"/);
});

test('stops before any network request when distinct employee IDs collide after Auth email normalization', () => {
  const requests = [];
  const alerts = [];
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => key === 'TASK_TIMING_SUPABASE_URL' ? 'https://example.supabase.co' : 'secret',
    }),
  };
  context.SpreadsheetApp = {
    getUi: () => ({ alert: message => alerts.push(message) }),
    getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getDataRange: () => ({ getValues: () => [
          ['員工編號', '姓名', '密碼'],
          ['E01', '王小美', ''],
          ['e01', '王小華', ''],
        ] }),
      }),
    }),
  };
  context.UrlFetchApp = { fetch: (url, options) => requests.push({ url, options }) };

  assert.throws(() => context.syncTaskTimingEmployeesToSupabase(), /員工編號 Auth email 衝突：E01、e01/);
  assert.equal(requests.length, 0);
  assert.match(alerts[0], /員工編號 Auth email 衝突：E01、e01/);
});

test('stops before any network request for duplicate literal employee IDs', () => {
  const requests = [];
  const alerts = [];
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => key === 'TASK_TIMING_SUPABASE_URL' ? 'https://example.supabase.co' : 'secret',
    }),
  };
  context.SpreadsheetApp = {
    getUi: () => ({ alert: message => alerts.push(message) }),
    getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getDataRange: () => ({ getValues: () => [
          ['員工編號', '姓名', '密碼'],
          ['E01', '王小美', 'pass-1'],
          ['E01', '王小華', 'pass-2'],
        ] }),
      }),
    }),
  };
  context.UrlFetchApp = { fetch: (url, options) => requests.push({ url, options }) };

  assert.throws(() => context.syncTaskTimingEmployeesToSupabase(), /員工編號重複：E01/);
  assert.equal(requests.length, 0);
  assert.match(alerts[0], /員工編號重複：E01/);
});

test('stops before writes when a canonical Auth email belongs to another literal employee ID', () => {
  const requests = [];
  const alerts = [];
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => key === 'TASK_TIMING_SUPABASE_URL' ? 'https://example.supabase.co' : 'secret',
    }),
  };
  context.SpreadsheetApp = {
    getUi: () => ({ alert: message => alerts.push(message) }),
    getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getDataRange: () => ({ getValues: () => [
          ['員工編號', '姓名', '密碼'],
          ['e01', '王小美', 'pass'],
        ] }),
      }),
    }),
  };
  context.UrlFetchApp = {
    fetch: (url, options) => {
      requests.push({ url, options });
      if (url.includes('/rest/v1/task_timing_employees?select=')) {
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify([
          { employee_id: 'E01', auth_user_id: 'auth-e01-uuid' },
        ]) };
      }
      if (url.includes('/auth/v1/admin/users?')) {
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify([
          { id: 'auth-e01-uuid', email: 'e01@tasktiming.local', user_metadata: { employee_id: 'E01' } },
        ]) };
      }
      throw new Error('Unexpected write: ' + url);
    },
  };

  assert.throws(() => context.syncTaskTimingEmployeesToSupabase(), /員工資料歸屬衝突：e01/);
  assert.equal(requests.some(request => request.options.method === 'post' || request.options.method === 'put'), false);
  assert.match(alerts[0], /員工資料歸屬衝突：e01/);
});

test('stops before writes when the mirror and canonical Auth email point to different UUIDs', () => {
  const requests = [];
  const alerts = [];
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => key === 'TASK_TIMING_SUPABASE_URL' ? 'https://example.supabase.co' : 'secret',
    }),
  };
  context.SpreadsheetApp = {
    getUi: () => ({ alert: message => alerts.push(message) }),
    getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getDataRange: () => ({ getValues: () => [
          ['員工編號', '姓名', '密碼'],
          ['E01', '王小美', 'pass'],
        ] }),
      }),
    }),
  };
  context.UrlFetchApp = {
    fetch: (url, options) => {
      requests.push({ url, options });
      if (url.includes('/rest/v1/task_timing_employees?select=')) {
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify([
          { employee_id: 'E01', auth_user_id: 'mirror-uuid' },
        ]) };
      }
      if (url.includes('/auth/v1/admin/users?')) {
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify([
          { id: 'auth-uuid', email: 'e01@tasktiming.local', user_metadata: { employee_id: 'E01' } },
        ]) };
      }
      throw new Error('Unexpected write: ' + url);
    },
  };

  assert.throws(() => context.syncTaskTimingEmployeesToSupabase(), /員工資料歸屬衝突：E01/);
  assert.equal(requests.some(request => request.options.method === 'post' || request.options.method === 'put'), false);
  assert.match(alerts[0], /員工資料歸屬衝突：E01/);
});

test('refuses to create Auth users with a blank password', () => {
  assert.throws(
    () => context.taskTimingProvisionEmployeeAuth_(
      'https://example.supabase.co', 'secret',
      { employee_id: 'E03', employee_name: '王小美', password: '' },
      null,
    ),
    /新員工必須填寫密碼/,
  );
});

test('includes a safe per-employee reason when an Auth request fails', () => {
  assert.match(
    employeeSyncSource,
    /failures\.push\(employee\.employee_id \+ '（' \+ taskTimingEmployeeSyncErrorMessage_\(error\) \+ '）'\);/,
  );
});

test('reports a new employee with blank password without creating Auth or public mirror rows', () => {
  const requests = [];
  const alerts = [];
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => key === 'TASK_TIMING_SUPABASE_URL' ? 'https://example.supabase.co' : 'secret',
    }),
  };
  context.SpreadsheetApp = {
    getUi: () => ({ alert: message => alerts.push(message) }),
    getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getDataRange: () => ({ getValues: () => [
          ['員工編號', '姓名', '密碼'],
          ['E02', '王小華', ''],
        ] }),
      }),
    }),
  };
  context.UrlFetchApp = {
    fetch: (url, options) => {
      requests.push({ url, options });
      if (url.includes('/rest/v1/task_timing_employees?select=') || url.includes('/auth/v1/admin/users?')) {
        return { getResponseCode: () => 200, getContentText: () => '[]' };
      }
      throw new Error('Unexpected write: ' + url);
    },
  };

  assert.throws(() => context.syncTaskTimingEmployeesToSupabase(), /員工同步失敗：E02/);
  assert.equal(requests.some(request => request.url === 'https://example.supabase.co/auth/v1/admin/users' && request.options.method === 'post'), false);
  assert.equal(requests.some(request => request.url.includes('/rest/v1/task_timing_employees?on_conflict=')), false);
  assert.match(alerts[0], /新增 0 筆、更新 0 筆、失敗 1 筆/);
});

test('paginates the existing public employee roster with Range headers', () => {
  const requests = [];
  const firstPage = Array.from({ length: 1000 }, (_, index) => ({
    employee_id: 'E' + index, auth_user_id: 'uuid-' + index,
  }));
  context.UrlFetchApp = {
    fetch: (url, options) => {
      requests.push({ url, options });
      const rows = requests.length === 1 ? firstPage : [{ employee_id: 'E1000', auth_user_id: 'uuid-1000' }];
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(rows) };
    },
  };

  const employees = context.taskTimingExistingEmployees_('https://example.supabase.co', 'secret');
  assert.equal(employees.byEmployeeId.E1000, 'uuid-1000');
  assert.equal(employees.employeeIdByAuthUserId['uuid-1000'], 'E1000');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers.Range, '0-999');
  assert.equal(requests[1].options.headers.Range, '1000-1999');
});
