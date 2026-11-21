import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicBoardKeyError } from '../src/services/taskTimingRecords.js';
import {
  initialBoardState, reduceBoardState, getMilestoneProgress, nextNoticeIndex, getNoticeDisplayMs, msUntilNextReload,
  TV_REFRESH_MS, TV_NOTICE_ROTATE_MS, TV_NOTICE_HOLD_MS, TV_RELOAD_HOUR, TV_MILESTONES,
} from '../src/utils/tvBoard.js';

const data = { todayGoodCount: 1 };
const t0 = new Date('2026-11-21T10:00:00');

test('constants match the spec', () => {
  assert.equal(TV_REFRESH_MS, 60_000);
  assert.equal(TV_NOTICE_ROTATE_MS, 15_000);
  assert.equal(TV_NOTICE_HOLD_MS, 3_000);
  assert.equal(TV_RELOAD_HOUR, 4);
  assert.deepEqual(TV_MILESTONES, [10000, 50000, 100000, 500000, 1000000]);
});

test('success shows data and clears stale', () => {
  const s = reduceBoardState({ ...initialBoardState, stale: true }, { type: 'success', data, at: t0 });
  assert.deepEqual(s, { status: 'ready', data, lastSuccessAt: t0, stale: false });
});

test('failure after success keeps the old data and marks it stale', () => {
  const ready = reduceBoardState(initialBoardState, { type: 'success', data, at: t0 });
  const s = reduceBoardState(ready, { type: 'failure', error: new TypeError('Failed to fetch'), at: new Date() });
  assert.equal(s.status, 'ready'); assert.equal(s.data, data); assert.equal(s.lastSuccessAt, t0); assert.equal(s.stale, true);
});

test('a network failure on first load is "connecting", never a key error', () => {
  const s = reduceBoardState(initialBoardState, { type: 'failure', error: new TypeError('Failed to fetch'), at: t0 });
  assert.equal(s.status, 'connecting'); assert.equal(s.data, null);
});

test('a key error replaces the board even if data was shown', () => {
  const ready = reduceBoardState(initialBoardState, { type: 'success', data, at: t0 });
  const s = reduceBoardState(ready, { type: 'failure', error: new PublicBoardKeyError('bad'), at: t0 });
  assert.equal(s.status, 'keyError'); assert.equal(s.data, null);
});

test('milestone progress', () => {
  assert.deepEqual(getMilestoneProgress(488221), { next: 500000, remaining: 11779, percent: 488221 / 500000 * 100, allDone: false, reached: [10000, 50000, 100000] });
  assert.equal(getMilestoneProgress(0).next, 10000);
  assert.deepEqual(getMilestoneProgress(1200000), { next: 1000000, remaining: 0, percent: 100, allDone: true, reached: [10000, 50000, 100000, 500000, 1000000] });
});

test('notice index wraps and survives a shrinking list', () => {
  assert.equal(nextNoticeIndex(0, 2), 1);
  assert.equal(nextNoticeIndex(1, 2), 0);
  assert.equal(nextNoticeIndex(2, 1), 0);
  assert.equal(nextNoticeIndex(5, 0), 0);
});

test('short notices rotate every 15 s; long ones scroll after a 3 s hold', () => {
  assert.deepEqual(getNoticeDisplayMs({ overflowPx: 0, viewportPx: 500 }), { scrollMs: 0, totalMs: 15000 });
  const long = getNoticeDisplayMs({ overflowPx: 1000, viewportPx: 500 });
  assert.equal(long.scrollMs, 28000);
  assert.equal(long.totalMs, 28000 + 3000 * 2);
});

test('next reload is the coming 04:00', () => {
  assert.equal(msUntilNextReload(new Date('2026-11-21T03:00:00')), 60 * 60 * 1000);
  assert.equal(msUntilNextReload(new Date('2026-11-21T04:00:00')), 24 * 60 * 60 * 1000);
  assert.equal(msUntilNextReload(new Date('2026-11-21T22:30:00')), 5.5 * 60 * 60 * 1000);
});
