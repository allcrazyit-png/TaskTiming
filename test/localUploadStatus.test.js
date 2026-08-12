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
