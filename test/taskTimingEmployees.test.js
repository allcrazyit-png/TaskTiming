import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  clearTaskTimingSession,
  employeeAuthEmail,
  fetchTaskTimingEmployees,
  getTaskTimingAccessToken,
  mapTaskTimingEmployee,
  readTaskTimingSession,
  saveTaskTimingSession,
  verifyTaskTimingEmployeePassword,
} from '../src/services/taskTimingEmployees.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

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

test('fetches every employee page when the mirror exceeds the PostgREST page size', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const firstPage = Array.from({ length: 1000 }, (_, index) => ({
    employee_id: `E${index}`, employee_name: `員工${index}`,
  }));
  const lastPage = [{ employee_id: 'E1000', employee_name: '員工1000' }];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => (requests.length === 1 ? firstPage : lastPage),
    };
  };
  try {
    const controller = new AbortController();
    const employees = await fetchTaskTimingEmployees({
      supabaseUrl: 'https://example.supabase.co',
      publishableKey: 'test-key',
      signal: controller.signal,
    });

    assert.equal(employees.length, 1001);
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /order=employee_name\.asc,employee_id\.asc/);
    assert.equal(requests[0].options.headers.apikey, 'test-key');
    assert.equal(requests[0].options.signal, controller.signal);
    assert.equal(requests[0].options.headers.Range, '0-999');
    assert.equal(requests[1].options.headers.Range, '1000-1999');
    assert.equal(employees.at(-1)['員工編號'], 'E1000');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns only the session fields needed for authenticated record reads', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      user: { user_metadata: { employee_id: 'E01' } },
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: 2000000000,
    }),
  });
  try {
    assert.deepEqual(await verifyTaskTimingEmployeePassword({
      employeeId: 'E01', password: '1234', supabaseUrl: 'https://example.supabase.co', publishableKey: 'test-key',
    }), {
      employeeId: 'E01',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 2000000000,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('stores, reads, and clears the employee Auth session without storing a password', () => {
  const storage = createStorage();
  const session = {
    employeeId: 'E01', accessToken: 'access-token', refreshToken: 'refresh-token', expiresAt: 2000000000,
  };
  saveTaskTimingSession(session, storage);
  assert.deepEqual(readTaskTimingSession(storage), session);
  assert.doesNotMatch(JSON.stringify(readTaskTimingSession(storage)), /password/i);
  clearTaskTimingSession(storage);
  assert.equal(readTaskTimingSession(storage), null);
});

test('refreshes an expired session and persists the replacement tokens', async () => {
  const originalFetch = globalThis.fetch;
  const storage = createStorage();
  saveTaskTimingSession({
    employeeId: 'E01', accessToken: 'expired', refreshToken: 'refresh-token', expiresAt: 1,
  }, storage);
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      user: { user_metadata: { employee_id: 'E01' } },
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_at: 2000000000,
    }),
  });
  try {
    assert.equal(await getTaskTimingAccessToken({
      storage,
      nowSeconds: 100,
      supabaseUrl: 'https://example.supabase.co',
      publishableKey: 'test-key',
    }), 'new-access-token');
    assert.equal(readTaskTimingSession(storage).refreshToken, 'new-refresh-token');
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

test('Home delegates employee loading and password validation to the employee service', async () => {
  const home = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  assert.match(home, /fetchTaskTimingEmployees,/);
  assert.match(home, /verifyTaskTimingEmployeePassword,/);
  assert.match(home, /from '\.\.\/services\/taskTimingEmployees';/);
  assert.match(home, /fetchTaskTimingEmployees\(\{ signal: employeeController\.signal \}\)/);
  assert.match(home, /await verifyTaskTimingEmployeePassword\(\{/);
  assert.match(home, /saveTaskTimingSession\(session\)/);
  assert.doesNotMatch(home, /const correctPassword = String\(tempOperator\['密碼'\]/);
});

test('Home shows local upload status without requesting GAS records', async () => {
  const home = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  assert.match(home, /import \{ formatLatestLocalUpload \} from '\.\.\/utils\/localUploadStatus';/);
  assert.match(home, /setLatestUploadStatus\(formatLatestLocalUpload\(existingHistory\)\)/);
  assert.doesNotMatch(home, /action=records/);
  assert.doesNotMatch(home, /missingWorkDays/);
});
