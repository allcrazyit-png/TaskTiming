const env = import.meta.env ?? {};
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMPLOYEE_PAGE_SIZE = 1000;

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
  if (String(session.user?.user_metadata?.employee_id) !== String(employeeId)) {
    throw new Error('Auth employee mismatch');
  }
  return true;
}
