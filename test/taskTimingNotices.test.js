import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { getActiveTaskTimingNotices } from '../src/services/taskTimingRecords.js';
const context = vm.createContext({ Date, isFinite, isNaN });
vm.runInContext(await readFile(new URL('../src/google_apps_script.js', import.meta.url), 'utf8'), context);
test('notice visibility includes both boundary days and excludes future/expired notices', () => {
  const active = { start_date: '2026-10-03', end_date: '2026-10-05', content: '提醒' };
  assert.equal(getActiveTaskTimingNotices([active], '2026-10-03').length, 1);
  assert.equal(getActiveTaskTimingNotices([active], '2026-10-05').length, 1);
  assert.equal(getActiveTaskTimingNotices([active], '2026-10-06').length, 0);
  assert.equal(getActiveTaskTimingNotices([active], '2026-10-02').length, 0);
});
test('Sheet rows skip disabled notices and block malformed enabled rows', () => {
  const rows = context.taskTimingNoticeRows_([['2026/10/03', '2026/10/05', '提醒', true], ['', '', '', false]]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].start_date, '2026-10-03');
  assert.throws(() => context.taskTimingNoticeRows_([['2026/02/30', '2026/10/05', '提醒', true]]));
  assert.throws(() => context.taskTimingNoticeRows_([['2026/10/06', '2026/10/05', '提醒', true]]));
});

test('open-ended notices stay active after start and dates remain required', () => {
  const notice = { start_date: '2026-10-03', end_date: null, content: '提醒' };
  assert.equal(getActiveTaskTimingNotices([notice], '2027-01-01').length, 1);
  assert.equal(getActiveTaskTimingNotices([notice], '2026-10-02').length, 0);
  const rows = context.taskTimingNoticeRows_([['2026/10/03', '', '提醒', true, 'Xin chú ý', 'Perhatian']]);
  assert.equal(rows[0].end_date, null);
  assert.equal(rows[0].content_vi, 'Xin chú ý');
  assert.throws(() => context.taskTimingNoticeRows_([['', '', '提醒', true]]));
  assert.throws(() => context.taskTimingNoticeRows_([['2026/10/03', '錯誤', '提醒', true]]));
});

test('translation follows language and falls back to Chinese when blank', async () => {
  const { getTaskTimingNoticeContent } = await import('../src/services/taskTimingRecords.js');
  const notice = { content: '中文', content_vi: 'Tiếng Việt', content_id: ' ' };
  assert.equal(getTaskTimingNoticeContent(notice, 'vi-VN'), 'Tiếng Việt');
  assert.equal(getTaskTimingNoticeContent(notice, 'id'), '中文');
  assert.equal(getTaskTimingNoticeContent(notice, 'zh'), '中文');
});
