# Add Women Duty Roster Member Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 「阮金霞」 to the end of the women duty roster without changing assignments before or during the 2026-09-28 effective week.

**Architecture:** Keep the exported roster as the complete display order, and calculate women indexes with two cycle lengths: the original nine-person cycle before 2026-09-28 and the expanded ten-person cycle from that Monday onward. Calculate next week's women index through the same date-aware function so a historical week does not incorrectly preview the newly added member.

**Tech Stack:** JavaScript ES modules, Node.js built-in test runner, React/Vite, ESLint

---

## File Structure

- Modify `src/utils/dutyRoster.js`: append the member and add the effective-date-aware women index calculation.
- Modify `test/dutyRoster.test.js`: add roster-order and schedule-continuity regression coverage.

### Task 1: Append the new member with a failing order test

**Files:**
- Modify: `test/dutyRoster.test.js:1-4`
- Modify: `src/utils/dutyRoster.js:1-3`

- [ ] **Step 1: Write the failing roster-order test**

Change the import and add this test before the existing baseline test:

```js
import { WOMEN_DUTY_ROSTER, getWeeklyDutyRoster } from '../src/utils/dutyRoster.js';

test('places 阮金霞 after 杜氏美蓮 at the end of the women roster', () => {
  assert.deepEqual(WOMEN_DUTY_ROSTER.slice(-2), ['杜氏美蓮', '阮金霞']);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test --test-name-pattern='places 阮金霞' test/dutyRoster.test.js
```

Expected: FAIL because the final two names are currently `['潘麗芳', '杜氏美蓮']`.

- [ ] **Step 3: Append the new member**

Update the exported array:

```js
export const WOMEN_DUTY_ROSTER = [
  '林祐香', '何淑如', '陳玉薇', '楊淑婷', '黃舒嬪', '陳麗如', '何佩函', '潘麗芳', '杜氏美蓮', '阮金霞',
];
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test --test-name-pattern='places 阮金霞' test/dutyRoster.test.js
```

Expected: PASS.

### Task 2: Preserve the established schedule across the expansion date

**Files:**
- Modify: `test/dutyRoster.test.js:5-45`
- Modify: `src/utils/dutyRoster.js:7-45`

- [ ] **Step 1: Write the failing schedule-continuity test**

Add:

```js
test('preserves the women schedule when the expanded roster takes effect', () => {
  const weekBefore = getWeeklyDutyRoster(new Date(2026, 8, 21, 9));
  const effectiveWeek = getWeeklyDutyRoster(new Date(2026, 8, 28, 9));
  const oldLastWeek = getWeeklyDutyRoster(new Date(2026, 10, 2, 9));
  const newLastWeek = getWeeklyDutyRoster(new Date(2026, 10, 9, 9));
  const wrappedWeek = getWeeklyDutyRoster(new Date(2026, 10, 16, 9));

  assert.equal(weekBefore.current.women, '陳玉薇');
  assert.equal(weekBefore.next.women, '楊淑婷');
  assert.equal(effectiveWeek.current.women, '楊淑婷');
  assert.equal(effectiveWeek.next.women, '黃舒嬪');
  assert.equal(oldLastWeek.current.women, '杜氏美蓮');
  assert.equal(oldLastWeek.next.women, '阮金霞');
  assert.equal(newLastWeek.current.women, '阮金霞');
  assert.equal(newLastWeek.next.women, '林祐香');
  assert.equal(wrappedWeek.current.women, '林祐香');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test --test-name-pattern='preserves the women schedule' test/dutyRoster.test.js
```

Expected: FAIL because appending a tenth member makes the existing baseline modulo calculation select the wrong women index.

- [ ] **Step 3: Add the effective-date-aware women index calculation**

Below `BASELINE_MONDAY`, add:

```js
const WOMEN_ROSTER_EFFECTIVE_MONDAY = new Date(2026, 8, 28);
const WOMEN_LEGACY_LENGTH = WOMEN_DUTY_ROSTER.length - 1;
const WOMEN_EFFECTIVE_INDEX = WOMEN_DUTY_ROSTER.indexOf('楊淑婷');
```

Below `modulo`, add:

```js
function weekOffsetBetween(weekStart, anchorMonday) {
  return Math.round((weekStart - anchorMonday) / (7 * DAY_MS));
}

function getWomenIndex(weekStart) {
  if (weekStart < WOMEN_ROSTER_EFFECTIVE_MONDAY) {
    return modulo(6 + weekOffsetBetween(weekStart, BASELINE_MONDAY), WOMEN_LEGACY_LENGTH);
  }

  return modulo(
    WOMEN_EFFECTIVE_INDEX + weekOffsetBetween(weekStart, WOMEN_ROSTER_EFFECTIVE_MONDAY),
    WOMEN_DUTY_ROSTER.length,
  );
}
```

Update `getWeeklyDutyRoster` so women use the date-aware calculation while men retain the current calculation:

```js
export function getWeeklyDutyRoster(date = new Date()) {
  const weekStart = getMonday(date);
  const weekOffset = weekOffsetBetween(weekStart, BASELINE_MONDAY);
  const nextWeekStart = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 7,
  );
  const womenIndex = getWomenIndex(weekStart);
  const nextWomenIndex = getWomenIndex(nextWeekStart);
  const menIndex = modulo(5 + weekOffset, MEN_DUTY_ROSTER.length);

  return {
    weekStart,
    weekEnd: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 4),
    current: { women: WOMEN_DUTY_ROSTER[womenIndex], men: MEN_DUTY_ROSTER[menIndex] },
    next: {
      women: WOMEN_DUTY_ROSTER[nextWomenIndex],
      men: MEN_DUTY_ROSTER[(menIndex + 1) % MEN_DUTY_ROSTER.length],
    },
    womenIndex,
    menIndex,
  };
}
```

- [ ] **Step 4: Run both new tests and verify GREEN**

Run:

```bash
node --test --test-name-pattern='places 阮金霞|preserves the women schedule' test/dutyRoster.test.js
```

Expected: 2 PASS, 0 FAIL; unmatched legacy tests are reported as skipped.

### Task 3: Verify and commit the local implementation

**Files:**
- Verify: `src/utils/dutyRoster.js`
- Verify: `test/dutyRoster.test.js`

- [ ] **Step 1: Run the complete duty-roster test file**

Run:

```bash
node --test test/dutyRoster.test.js
```

Expected: the two new women tests pass. The four existing mixed women/men tests may continue to fail only on their previously failing male assertions; do not alter the male roster in this task.

- [ ] **Step 2: Run all tests**

Run:

```bash
npm test
```

Expected: no new failures outside the four pre-existing male duty-roster assertions. Record the exact pass/fail totals.

- [ ] **Step 3: Run targeted lint**

Run:

```bash
npx eslint src/utils/dutyRoster.js test/dutyRoster.test.js
```

Expected: exit code 0 with no lint errors.

- [ ] **Step 4: Build the production bundle**

Run:

```bash
npm run build
```

Expected: exit code 0 and a generated `dist/` bundle.

- [ ] **Step 5: Inspect the exact diff**

Run:

```bash
git diff --check
git diff -- src/utils/dutyRoster.js test/dutyRoster.test.js
```

Expected: no whitespace errors; only the approved roster, date calculation, and regression tests changed.

- [ ] **Step 6: Commit only the implementation files and this plan**

```bash
git add src/utils/dutyRoster.js test/dutyRoster.test.js docs/superpowers/plans/2026-09-29-add-women-duty-roster-member.md
git commit -m "feat: add 阮金霞 to duty roster"
```

- [ ] **Step 7: Confirm the local-only boundary**

Run:

```bash
git status --short
git log -2 --oneline
```

Expected: the implementation commit appears locally; pre-existing unrelated untracked files remain untouched. Do not run `git push` or `npm run deploy`.
