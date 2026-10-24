import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmployeeProfileCache } from '../src/services/employeeProfileCache.js';
test('shares requests, expires at five minutes, and allows manual refresh', async () => {
  let calls = 0, clock = 0;
  const cache = createEmployeeProfileCache({ fetchProfile: async () => { calls++; return { 到職日: '2020-01-01' }; }, readSession: () => ({ employeeId: '60', refreshToken: 'r1' }), now: () => clock });
  await Promise.all([cache.load('60'),cache.load('60')]);
  await cache.load('60'); assert.equal(calls,1);
  clock = 300000; await cache.load('60'); assert.equal(calls,2);
  cache.clear(); await cache.load('60'); assert.equal(calls,3);
});
test('never serves another employee or a logged out session, and errors remain retryable', async () => {
  let session = { employeeId: '60', refreshToken: 'r1' }, fail = true;
  const cache = createEmployeeProfileCache({ fetchProfile: async () => { if(fail) throw Error('offline'); return { 性別:'女' }; }, readSession: () => session });
  await assert.rejects(cache.load('60'),/offline/);
  fail = false; assert.equal((await cache.load('60')).性別,'女');
  await assert.rejects(cache.load('36'),/login/);
  session = null; await assert.rejects(cache.load('60'),/login/);
});
