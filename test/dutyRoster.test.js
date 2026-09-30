import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEN_DUTY_ROSTER,
  WOMEN_DUTY_ROSTER,
  getDutyRosterEmployeeId,
  getDutyRosterDisplayName,
  getWeeklyDutyRoster,
} from '../src/utils/dutyRoster.js';

test('places 阮金霞 after 杜氏美蓮 at the end of the women roster', () => {
  assert.deepEqual(WOMEN_DUTY_ROSTER.slice(-2), ['杜氏美蓮', '阮金霞']);
});

test('marks the Vietnamese women without changing their roster names', () => {
  assert.equal(getDutyRosterDisplayName('陳玉薇'), '陳玉薇 🇻🇳');
  assert.equal(getDutyRosterDisplayName('杜氏美蓮'), '杜氏美蓮 🇻🇳');
  assert.equal(getDutyRosterDisplayName('阮金霞'), '阮金霞 🇻🇳');
});

test('uses the confirmed employee IDs, separately from roster positions', () => {
  const expected = {
    '林祐香': '26', '何淑如': '16', '陳玉薇': '33', '楊淑婷': '21', '黃舒嬪': '39',
    '陳麗如': '20', '何佩函': '36', '潘麗芳': '31', '杜氏美蓮': '15', '阮金霞': '27',
    '阿里': '77', '施聖浩': '32', '阿杜': '94', '楊子賢': '58', '志丹': '84',
  };
  const people = [...WOMEN_DUTY_ROSTER, ...MEN_DUTY_ROSTER];

  assert.equal(people.length, Object.keys(expected).length);
  assert.equal(new Set(Object.values(expected)).size, people.length);
  for (const person of people) {
    assert.equal(getDutyRosterEmployeeId(person), expected[person]);
  }
  assert.equal(getDutyRosterEmployeeId('毆吉'), null);
});

test('removes 毆吉 while preserving the current men assignment', () => {
  const weekBeforeRemoval = getWeeklyDutyRoster(new Date(2026, 8, 21, 9));
  const removalWeek = getWeeklyDutyRoster(new Date(2026, 8, 28, 9));
  const followingWeek = getWeeklyDutyRoster(new Date(2026, 9, 5, 9));

  assert.equal(MEN_DUTY_ROSTER.includes('毆吉'), false);
  assert.equal(weekBeforeRemoval.current.men, '楊子賢');
  assert.equal(weekBeforeRemoval.next.men, '志丹');
  assert.equal(removalWeek.current.men, '志丹');
  assert.equal(removalWeek.next.men, '阿里');
  assert.equal(followingWeek.current.men, '阿里');
});

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
