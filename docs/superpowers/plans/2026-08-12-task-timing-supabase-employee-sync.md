# TaskTiming 員工資料 Supabase 同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Google Sheet `員工資料` as the editable source while serving the employee selector and password verification from Supabase.

**Architecture:** A public `task_timing_employees` mirror exposes only employee ID and name. A Sheet-bound Apps Script syncs that mirror and provisions Supabase Auth users with the sheet password through the Admin API; plaintext passwords never enter the public table or browser. The React homepage fetches the mirror and verifies a selected employee password through Supabase Auth before preserving the existing `savedOperatorId` workflow.

**Tech Stack:** React 19, Vite, browser Fetch API, Supabase PostgREST/Auth REST APIs, Google Apps Script, Node built-in test runner.

---

## File structure

- Create `supabase/task_timing_employees.sql`: employee mirror schema, read-only anonymous RLS policy, and an index for deterministic display order.
- Create `src/services/taskTimingEmployees.js`: browser-safe mapping, paged employee fetch, deterministic internal Auth email generation, and password grant verification.
- Create `google-apps-script/task_timing_employees_sync.gs`: source-row mapping plus manual Sheet-to-Supabase/Auth synchronization.
- Create `test/taskTimingEmployees.test.js`: product-contract-compatible employee mapping, public fetch and Auth verification tests.
- Create `test/taskTimingEmployeesSync.test.js`: Apps Script row-mapping and header-normalization tests in a Node VM.
- Modify `src/pages/Home.jsx`: replace GAS employee loading and client-side plaintext comparison with the employee service.
- Modify the deployed bound Apps Script legacy menu file (`程式碼.gs`): add a single `syncTaskTimingEmployeesToSupabase` menu action alongside the existing product action.

### Task 1: Add the employee mirror schema

**Files:**
- Create: `supabase/task_timing_employees.sql`

- [ ] **Step 1: Write the schema contract test**

Add a test in `test/taskTimingEmployeesSync.test.js` that reads the SQL file and requires the table, ID primary key, RLS enablement, anonymous `select` grant, and a `for select` policy:

```js
test('employee mirror is public-read-only and has no password column', async () => {
  const sql = await readFile(new URL('../supabase/task_timing_employees.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.task_timing_employees/i);
  assert.match(sql, /employee_id text primary key/i);
  assert.doesNotMatch(sql, /password/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /grant select on public\.task_timing_employees to anon/i);
  assert.match(sql, /for select to anon/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/taskTimingEmployeesSync.test.js`

Expected: FAIL because `supabase/task_timing_employees.sql` does not exist.

- [ ] **Step 3: Add the minimal schema**

Create `supabase/task_timing_employees.sql`:

```sql
create table if not exists public.task_timing_employees (
  employee_id text primary key,
  employee_name text not null default '',
  auth_user_id uuid unique not null,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.task_timing_employees enable row level security;
grant select on public.task_timing_employees to anon;

drop policy if exists "Anonymous users can read task timing employees"
on public.task_timing_employees;

create policy "Anonymous users can read task timing employees"
on public.task_timing_employees
for select to anon
using (true);

create index if not exists task_timing_employees_name_idx
on public.task_timing_employees (employee_name, employee_id);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/taskTimingEmployeesSync.test.js`

Expected: PASS for the schema contract test.

- [ ] **Step 5: Apply it in Supabase SQL Editor**

Run the exact SQL file in the existing Supabase project, then verify with:

```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'task_timing_employees'
order by ordinal_position;
```

Expected: `employee_id`, `employee_name`, `auth_user_id`, `source_updated_at`, and `synced_at`; no password column.

- [ ] **Step 6: Commit**

```bash
git add supabase/task_timing_employees.sql test/taskTimingEmployeesSync.test.js
git commit -m "feat: add employee mirror schema"
```

### Task 2: Implement the browser employee service with TDD

**Files:**
- Create: `src/services/taskTimingEmployees.js`
- Create: `test/taskTimingEmployees.test.js`

- [ ] **Step 1: Write failing service tests**

Create `test/taskTimingEmployees.test.js` with these behaviors:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('derives an internal Auth email from a trimmed employee ID', () => {
  assert.equal(employeeAuthEmail(' E01 '), 'e01@tasktiming.local');
});

test('fetches public employees ordered by name', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => ({ ok: true, status: 200, json: async () => [
    { employee_id: 'E01', employee_name: '王小美' },
  ] });
  try {
    assert.deepEqual(await fetchTaskTimingEmployees({
      supabaseUrl: 'https://example.supabase.co', publishableKey: 'test-key',
    }), [{ '員工編號': 'E01', '姓名': '王小美' }]);
  } finally { globalThis.fetch = originalFetch; }
});

test('accepts only an Auth session belonging to the selected employee', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({
    user: { user_metadata: { employee_id: 'E01' } }, access_token: 'not-stored',
  }) });
  try {
    await verifyTaskTimingEmployeePassword({ employeeId: 'E01', password: '1234', supabaseUrl: 'https://example.supabase.co', publishableKey: 'test-key' });
  } finally { globalThis.fetch = originalFetch; }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/taskTimingEmployees.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `taskTimingEmployees.js`.

- [ ] **Step 3: Implement the service**

Create `src/services/taskTimingEmployees.js` with these exports and behavior:

```js
const env = import.meta.env ?? {};
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function employeeAuthEmail(employeeId) {
  const id = String(employeeId ?? '').trim().toLowerCase();
  if (!id) throw new Error('Employee ID is required');
  return `${encodeURIComponent(id)}@tasktiming.local`;
}

export function mapTaskTimingEmployee(row) {
  return { '員工編號': String(row.employee_id), '姓名': String(row.employee_name || '') };
}

export async function fetchTaskTimingEmployees({ signal, supabaseUrl = SUPABASE_URL, publishableKey = SUPABASE_PUBLISHABLE_KEY } = {}) {
  if (!supabaseUrl || !publishableKey) throw new Error('Missing Supabase browser configuration');
  const response = await fetch(`${supabaseUrl}/rest/v1/task_timing_employees?select=employee_id,employee_name&order=employee_name.asc,employee_id.asc`, {
    headers: { apikey: publishableKey }, signal,
  });
  if (!response.ok) throw new Error(`Supabase employees request failed: ${response.status}`);
  return (await response.json()).map(mapTaskTimingEmployee).filter(employee => employee['員工編號'] && employee['姓名']);
}

export async function verifyTaskTimingEmployeePassword({ employeeId, password, signal, supabaseUrl = SUPABASE_URL, publishableKey = SUPABASE_PUBLISHABLE_KEY }) {
  if (!password) throw new Error('Password is required');
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', signal,
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: employeeAuthEmail(employeeId), password }),
  });
  if (!response.ok) throw new Error('Invalid employee password');
  const session = await response.json();
  if (String(session.user?.user_metadata?.employee_id) !== String(employeeId)) throw new Error('Auth employee mismatch');
  return true;
}
```

Do not save `access_token`, `refresh_token`, or the plaintext password in localStorage.

- [ ] **Step 4: Run service tests to verify they pass**

Run: `node --test test/taskTimingEmployees.test.js`

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/taskTimingEmployees.js test/taskTimingEmployees.test.js
git commit -m "feat: add Supabase employee service"
```

### Task 3: Implement Sheet-to-Supabase/Auth synchronization with TDD

**Files:**
- Create: `google-apps-script/task_timing_employees_sync.gs`
- Modify: `test/taskTimingEmployeesSync.test.js`
- Modify: deployed Apps Script legacy `程式碼.gs`

- [ ] **Step 1: Add failing Apps Script mapping tests**

Append to `test/taskTimingEmployeesSync.test.js` after loading the employee sync source in a VM:

```js
test('maps an employee row and preserves a blank password as no password update', () => {
  const employee = context.employeeRowToTaskTimingEmployee_(['員工編號', '姓名', '密碼'], ['E01', '王小美', '']);
  assert.deepEqual(JSON.parse(JSON.stringify(employee)), {
    employee_id: 'E01', employee_name: '王小美', password: '',
  });
});

test('normalizes bracket annotations in employee headers', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(context.normalizeTaskTimingHeaders_(['員工編號[登入]', '姓名', '密碼']))), ['員工編號', '姓名', '密碼']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/taskTimingEmployeesSync.test.js`

Expected: FAIL because `task_timing_employees_sync.gs` and its functions do not exist.

- [ ] **Step 3: Implement the synchronization file**

Create `google-apps-script/task_timing_employees_sync.gs` using the existing `TASK_TIMING_SUPABASE_URL` and `TASK_TIMING_SUPABASE_SECRET_KEY` Script Properties. Implement these exact responsibilities:

```js
function normalizeTaskTimingHeaders_(headers) {
  return headers.map(header => String(header).replace(/\[.*?\]/g, '').trim());
}

function employeeRowToTaskTimingEmployee_(headers, row) {
  const source = Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  const employeeId = String(source['員工編號'] || '').trim();
  const employeeName = String(source['姓名'] || '').trim();
  if (!employeeId || !employeeName) return null;
  return { employee_id: employeeId, employee_name: employeeName, password: String(source['密碼'] || '') };
}
```

`syncTaskTimingEmployeesToSupabase()` must:

1. Get the explicit `員工資料` tab, normalize headers, and require `員工編號` and `姓名`.
2. Fetch existing `employee_id,auth_user_id` rows from `/rest/v1/task_timing_employees` using the secret key.
3. For an existing employee, call `PUT /auth/v1/admin/users/{auth_user_id}` with `user_metadata: { employee_id, employee_name }`; include `password` only when the Sheet value is nonempty.
4. For a new employee, call `POST /auth/v1/admin/users` with `email: employeeId.toLowerCase() + '@tasktiming.local'`, `email_confirm: true`, `password: sheetPassword || employeeId`, and the same `user_metadata`.
5. Upsert `employee_id`, `employee_name`, `auth_user_id`, and `source_updated_at` to `/rest/v1/task_timing_employees?on_conflict=employee_id` using `Prefer: resolution=merge-duplicates,return=minimal`.
6. Continue through all rows, collecting per-ID failures; show a single UI alert with created, updated, and failed counts; throw after the alert if any failure occurred.

Never log the password, return it, or add it to the public table payload.

- [ ] **Step 4: Run Apps Script tests to verify they pass**

Run: `node --test test/taskTimingEmployeesSync.test.js`

Expected: schema and two mapping tests pass.

- [ ] **Step 5: Update the live bound Apps Script**

Paste the new employee sync file into the same live Apps Script project as the product sync, save it, and add this one menu item to the existing `onOpen` in legacy `程式碼.gs`:

```js
.addItem('同步員工資料到 Supabase', 'syncTaskTimingEmployeesToSupabase')
```

Do not add another `onOpen`. Ensure the shared Script Properties stay unchanged and contain the existing Supabase URL and secret key.

- [ ] **Step 6: Manually prove the sync**

In the Sheet, change only a designated test employee’s display name and password, execute the new menu item, then verify in Supabase:

```sql
select employee_id, employee_name, auth_user_id, synced_at
from public.task_timing_employees
order by employee_name, employee_id;
```

Expected: selected employee’s name is updated, an Auth UUID exists, and no password column is returned. Verify old password rejection and new password acceptance from the browser without recording either value.

- [ ] **Step 7: Commit local source and tests**

```bash
git add google-apps-script/task_timing_employees_sync.gs test/taskTimingEmployeesSync.test.js
git commit -m "feat: sync Sheet employees to Supabase Auth"
```

### Task 4: Switch the homepage to the employee service with TDD

**Files:**
- Modify: `src/pages/Home.jsx`
- Modify: `test/taskTimingEmployees.test.js`

- [ ] **Step 1: Add the failing homepage integration-contract test**

Add this test to `test/taskTimingEmployees.test.js`:

```js
test('Home delegates employee loading and password validation to the employee service', async () => {
  const home = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  assert.match(home, /import \{ fetchTaskTimingEmployees, verifyTaskTimingEmployeePassword \} from '\.\.\/services\/taskTimingEmployees';/);
  assert.match(home, /fetchTaskTimingEmployees\(\{ signal: employeeController\.signal \}\)/);
  assert.match(home, /await verifyTaskTimingEmployeePassword\(\{/);
  assert.doesNotMatch(home, /const correctPassword = String\(tempOperator\['密碼'\]/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/taskTimingEmployees.test.js`

Expected: FAIL because `Home.jsx` still fetches `員工資料` from GAS and directly compares `tempOperator['密碼']`.

- [ ] **Step 3: Modify Home with the minimal integration**

1. Import `fetchTaskTimingEmployees` and `verifyTaskTimingEmployeePassword` from `../services/taskTimingEmployees`.
2. Remove the `employeeUrl` and `fetchWithRetry(employeeUrl)` block from the homepage loading effect.
3. Add an `AbortController` for employees and replace it with:

```js
fetchTaskTimingEmployees({ signal: employeeController.signal })
  .then(employeeData => {
    setEmployees(employeeData);
    writeCache(CACHE_KEY_EMPLOYEES, employeeData);
  })
  .catch(error => console.warn('Supabase employee load failed; retaining local cache.', error));
```

4. Convert `verifyPassword` to `async`. Disable repeated submissions with a new `isVerifyingPassword` state. Await `verifyTaskTimingEmployeePassword({ employeeId: tempOperator['員工編號'], password: passwordInput })`; only after success execute the existing `selectedOperator`, `savedOperatorId`, history, favorites, and modal-close statements. On rejection set `passwordError` to `true`; always clear the submitting state in `finally`.
5. Set both password-confirm buttons to `disabled={isVerifyingPassword}` and keep their existing touch-target classes; display the existing translated login label while verifying to avoid translation-scope change.
6. Do not alter product fetching, records fetching, or navigation state.

- [ ] **Step 4: Run the employee service test to verify it passes**

Run: `node --test test/taskTimingEmployees.test.js`

Expected: 5 passing tests.

- [ ] **Step 5: Run all local verification**

Run:

```bash
git diff --check
npm test
npx eslint src/pages/Home.jsx src/services/taskTimingEmployees.js test/taskTimingEmployees.test.js test/taskTimingEmployeesSync.test.js
npm run build
```

Expected: no diff whitespace errors, all Node tests pass, focused ESLint passes, and Vite exits 0. The broad project lint may still report unrelated pre-existing files and is not a release gate for this change.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.jsx src/services/taskTimingEmployees.js test/taskTimingEmployees.test.js
git commit -m "feat: load and authenticate employees with Supabase"
```

### Task 5: Validate staged and live behavior

**Files:**
- No additional source changes.

- [ ] **Step 1: Test locally with a safe test employee**

Start `npm run dev`, open the mobile-width local URL, and confirm: employee buttons appear from Supabase; the selected worker’s old password is rejected after a Sheet sync; their changed password succeeds; and the existing product, favorite, start-work, and record-upload paths remain available.

- [ ] **Step 2: Deploy only with explicit user authorization**

Run `npm run deploy` only when the user explicitly says `deploy`. This is separate from saving the Apps Script sync file and from running the Sheet synchronization.

- [ ] **Step 3: Verify the live deployment**

After deployment, open `https://allcrazyit-png.github.io/TaskTiming/`, select the safe test employee, and validate login with the current Sheet-synced password. Report separately: Git state, GitHub Pages deployment, Apps Script saved state, Sheet-to-Supabase sync result, and device verification.
