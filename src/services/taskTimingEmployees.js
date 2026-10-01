const env = import.meta.env ?? {};
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMPLOYEE_PAGE_SIZE = 1000;
const AUTH_SESSION_KEY = 'taskTimingSupabaseSession';

function defaultStorage() {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

function mapAuthSession(session, employeeId) {
  const actualEmployeeId = String(session.user?.user_metadata?.employee_id ?? '');
  if (actualEmployeeId !== String(employeeId)) throw new Error('Auth employee mismatch');
  if (!session.access_token || !session.refresh_token) throw new Error('Incomplete Auth session');
  return {
    employeeId: actualEmployeeId,
    accessToken: String(session.access_token),
    refreshToken: String(session.refresh_token),
    expiresAt: Number(session.expires_at || (Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600))),
  };
}

export function saveTaskTimingSession(session, storage = defaultStorage()) {
  if (!storage) return;
  storage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function readTaskTimingSession(storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const session = JSON.parse(storage.getItem(AUTH_SESSION_KEY) || 'null');
    if (!session?.employeeId || !session?.accessToken || !session?.refreshToken || !session?.expiresAt) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearTaskTimingSession(storage = defaultStorage()) {
  storage?.removeItem(AUTH_SESSION_KEY);
}

export function employeeAuthEmail(employeeId) {
  const id = String(employeeId ?? '').trim().toLowerCase();
  if (!id) throw new Error('Employee ID is required');
  return `${encodeURIComponent(id)}@tasktiming.local`;
}

export function mapTaskTimingEmployee(row) {
  return {
    '員工編號': String(row.employee_id ?? ''),
    '姓名': String(row.employee_name ?? ''),
  };
}

export async function fetchTaskTimingEmployees({
  signal,
  supabaseUrl = SUPABASE_URL,
  publishableKey = SUPABASE_PUBLISHABLE_KEY,
} = {}) {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  const endpoint = `${supabaseUrl}/rest/v1/task_timing_employees?select=employee_id,employee_name&order=employee_name.asc,employee_id.asc`;
  const rows = [];

  for (let offset = 0; ; offset += EMPLOYEE_PAGE_SIZE) {
    const response = await fetch(endpoint, {
      headers: {
        apikey: publishableKey,
        Range: `${offset}-${offset + EMPLOYEE_PAGE_SIZE - 1}`,
      },
      signal,
    });
    if (!response.ok) throw new Error(`Supabase employees request failed: ${response.status}`);

    const page = await response.json();
    rows.push(...page);
    if (page.length < EMPLOYEE_PAGE_SIZE) break;
  }

  return rows
    .map(mapTaskTimingEmployee)
    .filter(employee => employee['員工編號'] && employee['姓名']);
}

export async function verifyTaskTimingEmployeePassword({
  employeeId,
  password,
  signal,
  supabaseUrl = SUPABASE_URL,
  publishableKey = SUPABASE_PUBLISHABLE_KEY,
}) {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  if (!password) throw new Error('Password is required');

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    signal,
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: employeeAuthEmail(employeeId),
      password,
    }),
  });
  if (!response.ok) throw new Error('Invalid employee password');

  const session = await response.json();
  return mapAuthSession(session, employeeId);
}

export async function getTaskTimingAccessToken({
  signal,
  storage = defaultStorage(),
  nowSeconds = Math.floor(Date.now() / 1000),
  supabaseUrl = SUPABASE_URL,
  publishableKey = SUPABASE_PUBLISHABLE_KEY,
} = {}) {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  const current = readTaskTimingSession(storage);
  if (!current) throw new Error('Employee login required');
  if (Number(current.expiresAt) > nowSeconds + 60) return current.accessToken;

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    signal,
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: current.refreshToken }),
  });
  if (!response.ok) {
    clearTaskTimingSession(storage);
    throw new Error('Employee login expired');
  }

  const refreshed = mapAuthSession(await response.json(), current.employeeId);
  saveTaskTimingSession(refreshed, storage);
  return refreshed.accessToken;
}
