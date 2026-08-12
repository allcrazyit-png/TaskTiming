# Home Local Upload Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the homepage Google Sheet records request and display a selected employee's latest local upload time when available.

**Architecture:** Add a pure utility to format the newest valid `submitTimestamp` from existing `uploadHistory_<employeeId>` records. Home will use it while loading local history, delete the missing-days Sheet request, and render the local status beneath the greeting.

**Tech Stack:** React, JavaScript, Node built-in test runner, localStorage.

---

## File structure

- Create `src/utils/localUploadStatus.js`: pure latest-upload formatting logic.
- Create `test/localUploadStatus.test.js`: today, earlier date, and invalid-history tests.
- Modify `src/pages/Home.jsx`: remove `action=records` and render local status.
- Modify `test/taskTimingEmployees.test.js`: static integration guard.

### Task 1: Add local upload status formatting

**Files:**

- Create: `src/utils/localUploadStatus.js`
- Create: `test/localUploadStatus.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLatestLocalUpload } from '../src/utils/localUploadStatus.js';

test('formats the newest local upload for today', () => {
  const now = new Date(2026, 7, 12, 14, 0);
  const records = [{ submitTimestamp: new Date(2026, 7, 12, 10, 35).getTime() }];
  assert.equal(formatLatestLocalUpload(records, now), '最近上傳：今天 10:35');
});

test('formats a local upload from an earlier day', () => {
  const now = new Date(2026, 7, 12, 14, 0);
  const records = [{ submitTimestamp: new Date(2026, 7, 11, 16, 20).getTime() }];
  assert.equal(formatLatestLocalUpload(records, now), '最近上傳：8/11 16:20');
});

test('returns null for empty or invalid local history', () => {
  assert.equal(formatLatestLocalUpload([]), null);
  assert.equal(formatLatestLocalUpload([{ submitTimestamp: 'bad-date' }]), null);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/localUploadStatus.test.js`

Expected: FAIL because the utility does not yet exist.

- [ ] **Step 3: Implement the minimum utility**

```js
function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatLatestLocalUpload(records, now = new Date()) {
  if (!Array.isArray(records)) return null;
  const timestamps = records.map(record => Number(record?.submitTimestamp))
    .filter(timestamp => Number.isFinite(timestamp) && timestamp > 0);
  if (timestamps.length === 0) return null;
  const latest = new Date(Math.max(...timestamps));
  const time = `${pad(latest.getHours())}:${pad(latest.getMinutes())}`;
  const isToday = latest.getFullYear() === now.getFullYear()
    && latest.getMonth() === now.getMonth()
    && latest.getDate() === now.getDate();
  return isToday ? `最近上傳：今天 ${time}` : `最近上傳：${latest.getMonth() + 1}/${latest.getDate()} ${time}`;
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/localUploadStatus.test.js`

Expected: 3 passing tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/utils/localUploadStatus.js test/localUploadStatus.test.js
git commit -m "feat: format local upload status"
```

### Task 2: Use local status on Home and remove the Sheet records lookup

**Files:**

- Modify: `src/pages/Home.jsx:1-320,999-1006`
- Modify: `test/taskTimingEmployees.test.js`

- [ ] **Step 1: Write the failing integration test**

Append this test:

```js
test('Home shows local upload status without requesting GAS records', async () => {
  const home = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  assert.match(home, /import \{ formatLatestLocalUpload \} from '\.\.\/utils\/localUploadStatus';/);
  assert.match(home, /setLatestUploadStatus\(formatLatestLocalUpload\(existingHistory\)\)/);
  assert.doesNotMatch(home, /action=records/);
  assert.doesNotMatch(home, /missingWorkDays/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/taskTimingEmployees.test.js`

Expected: FAIL because Home still requests records and has no local status helper.

- [ ] **Step 3: Implement the minimum Home change**

1. Import `formatLatestLocalUpload` from `../utils/localUploadStatus`.
2. Replace `missingWorkDays` state with `latestUploadStatus`, initialized to `null`.
3. Delete `calcConsecutiveMissingDays` and its `useEffect` containing `action=records`.
4. In `loadOperatorHistory(id)`, call `setLatestUploadStatus(formatLatestLocalUpload(existingHistory))`; set `null` in the catch block.
5. Clear `latestUploadStatus` when the employee is cleared or logout runs.
6. Under the greeting, render `latestUploadStatus` when non-null; otherwise render `greetingSub`.

- [ ] **Step 4: Verify focused GREEN**

Run: `node --test test/localUploadStatus.test.js test/taskTimingEmployees.test.js`

Expected: all focused tests pass with 0 failures.

- [ ] **Step 5: Run complete verification**

Run: `npm test && npm run build && git diff --check`

Expected: all tests pass, Vite exits 0, and no whitespace errors print.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.jsx test/taskTimingEmployees.test.js
git commit -m "perf: stop homepage record sheet reads"
```
