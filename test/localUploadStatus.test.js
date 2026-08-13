import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLatestLocalUpload } from '../src/utils/localUploadStatus.js';

test('reports the newest local upload for today without formatting text', () => {
  const now = new Date(2026, 7, 12, 14, 0);
  const records = [{ submitTimestamp: new Date(2026, 7, 12, 10, 35).getTime() }];
  assert.deepEqual(formatLatestLocalUpload(records, now), {
    isToday: true, time: '10:35', month: 8, day: 12,
  });
});

test('reports a local upload from an earlier day', () => {
  const now = new Date(2026, 7, 12, 14, 0);
  const records = [{ submitTimestamp: new Date(2026, 7, 11, 16, 20).getTime() }];
  assert.deepEqual(formatLatestLocalUpload(records, now), {
    isToday: false, time: '16:20', month: 8, day: 11,
  });
});

test('picks the newest record when the local history is unsorted', () => {
  const now = new Date(2026, 7, 12, 14, 0);
  const records = [
    { submitTimestamp: new Date(2026, 7, 12, 9, 5).getTime() },
    { submitTimestamp: new Date(2026, 7, 12, 13, 40).getTime() },
    { submitTimestamp: new Date(2026, 7, 12, 11, 15).getTime() },
  ];
  assert.equal(formatLatestLocalUpload(records, now).time, '13:40');
});

test('returns null for empty or invalid local history', () => {
  assert.equal(formatLatestLocalUpload([]), null);
  assert.equal(formatLatestLocalUpload([{ submitTimestamp: 'bad-date' }]), null);
});
