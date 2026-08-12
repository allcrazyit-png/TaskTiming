import test from 'node:test';
import assert from 'node:assert/strict';
import {
  employeeAuthEmail,
  fetchTaskTimingEmployees,
  mapTaskTimingEmployee,
  verifyTaskTimingEmployeePassword,
} from '../src/services/taskTimingEmployees.js';

test('maps a public employee row without a password', () => {
  assert.deepEqual(mapTaskTimingEmployee({ employee_id: 'E01', employee_name: '王小美' }), {
    '員工編號': 'E01', '姓名': '王小美',
  });
});

test('derives a stable internal Auth email from a trimmed lowercased employee ID', () => {
  assert.equal(employeeAuthEmail(' E01 '), 'e01@tasktiming.local');
});

test('encodes reserved characters in the internal Auth email local part', () => {
  assert.equal(employeeAuthEmail(' A/B '), 'a%2Fb@tasktiming.local');
});

test('fetches public employees ordered by name', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => [{ employee_id: 'E01', employee_name: '王小美' }],
    };
  };
  try {
    assert.deepEqual(await fetchTaskTimingEmployees({
      supabaseUrl: 'https://example.supabase.co', publishableKey: 'test-key',
    }), [{ '員工編號': 'E01', '姓名': '王小美' }]);
    assert.match(requests[0].url, /order=employee_name\.asc,employee_id\.asc/);
    assert.equal(requests[0].options.headers.apikey, 'test-key');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('accepts only an Auth session belonging to the selected employee', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      user: { user_metadata: { employee_id: 'E01' } },
      access_token: 'not-stored',
      refresh_token: 'not-stored',
    }),
  });
  try {
    assert.equal(await verifyTaskTimingEmployeePassword({
      employeeId: 'E01', password: '1234', supabaseUrl: 'https://example.supabase.co', publishableKey: 'test-key',
    }), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects an Auth session that belongs to another employee', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ user: { user_metadata: { employee_id: 'E02' } } }),
  });
  try {
    await assert.rejects(
      () => verifyTaskTimingEmployeePassword({
        employeeId: 'E01', password: '1234', supabaseUrl: 'https://example.supabase.co', publishableKey: 'test-key',
      }),
      /Auth employee mismatch/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
