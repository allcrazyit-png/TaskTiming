import test from 'node:test';
import assert from 'node:assert/strict';
import { getWeeklyDutyRoster } from '../src/utils/dutyRoster.js';

test('uses 2026-08-17 as the confirmed roster baseline', () => {
  const roster = getWeeklyDutyRoster(new Date(2026, 7, 17, 9));

  assert.equal(roster.weekStart.getTime(), new Date(2026, 7, 17).getTime());
  assert.deepEqual(roster.current, { women: '何佩函', men: '楊子賢' });
  assert.deepEqual(roster.next, { women: '潘麗芳', men: '毆吉' });
});

test('keeps every day through Sunday in the same Monday-based roster week', () => {
  const roster = getWeeklyDutyRoster(new Date(2026, 7, 23, 18));

  assert.deepEqual(roster.current, { women: '何佩函', men: '楊子賢' });
});

test('advances each roster independently and wraps after its own last member', () => {
  const afterFiveWeeks = getWeeklyDutyRoster(new Date(2026, 8, 21, 9));
  const afterNineWeeks = getWeeklyDutyRoster(new Date(2026, 9, 19, 9));

  assert.deepEqual(afterFiveWeeks.current, { women: '陳玉薇', men: '楊子賢' });
  assert.deepEqual(afterNineWeeks.current, { women: '何佩函', men: '阿杜' });
});

test('calculates a valid cycle for weeks before the baseline', () => {
  const roster = getWeeklyDutyRoster(new Date(2026, 7, 10, 9));

  assert.deepEqual(roster.current, { women: '陳麗如', men: '阿杜' });
});
