import { PublicBoardKeyError } from '../services/taskTimingRecords.js';

export const TV_REFRESH_MS = 60_000;
export const TV_NOTICE_ROTATE_MS = 15_000;
export const TV_NOTICE_HOLD_MS = 3_000;
export const TV_RELOAD_HOUR = 4;
export const TV_MILESTONES = [10000, 50000, 100000, 500000, 1000000];
const SCROLL_MS_PER_VIEWPORT = 14_000;

export const initialBoardState = { status: 'loading', data: null, lastSuccessAt: null, stale: false };

// A failed refresh keeps the last good board on screen; only a rejected key clears it.
export function reduceBoardState(state, event) {
  if (event.type === 'success') {
    return { status: 'ready', data: event.data, lastSuccessAt: event.at, stale: false };
  }
  if (event.error instanceof PublicBoardKeyError) {
    return { status: 'keyError', data: null, lastSuccessAt: null, stale: false };
  }
  if (state.data) return { ...state, status: 'ready', stale: true };
  return { ...state, status: 'connecting' };
}

export function getMilestoneProgress(cumulative) {
  const last = TV_MILESTONES[TV_MILESTONES.length - 1];
  const reached = TV_MILESTONES.filter(m => cumulative >= m);
  const allDone = cumulative >= last;
  const next = allDone ? last : TV_MILESTONES.find(m => m > cumulative);
  return {
    next,
    remaining: Math.max(0, next - cumulative),
    percent: allDone ? 100 : cumulative / next * 100,
    allDone,
    reached,
  };
}

export function nextNoticeIndex(current, count) {
  if (count <= 0) return 0;
  return (current + 1) % count;
}

export function getNoticeDisplayMs({ overflowPx, viewportPx }) {
  const scrollMs = overflowPx > 0 && viewportPx > 0 ? overflowPx / viewportPx * SCROLL_MS_PER_VIEWPORT : 0;
  return { scrollMs, totalMs: Math.max(TV_NOTICE_ROTATE_MS, scrollMs + TV_NOTICE_HOLD_MS * 2) };
}

export function msUntilNextReload(now, hour = TV_RELOAD_HOUR) {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

const pad2 = n => String(n).padStart(2, '0');
export function formatClock(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
