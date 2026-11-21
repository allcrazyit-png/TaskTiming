import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicBoard, mapPublicBoard, PublicBoardKeyError } from '../src/services/taskTimingRecords.js';

async function withFetch(impl, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await run(); } finally { globalThis.fetch = originalFetch; }
}

test('maps the public board payload and normalizes notice languages', () => {
  const board = mapPublicBoard({
    today: '2026-11-21', today_good_count: '1240', today_operator_count: 5, avg_efficiency: 102,
    today_record_count: 8, cumulative_total: 488221,
    today_defect_missing: 6, today_defect_deform: 3, today_defect_appearance: 12, today_defect_other: 2,
    notices: [{ content: ' 甲 ', content_vi: '  ', content_id: null }, { content: '乙', content_vi: 'B', content_id: 'C' }, { content: '   ' }],
  });
  assert.equal(board.today, '2026-11-21');
  assert.equal(board.todayGoodCount, 1240);
  assert.equal(board.todayOperators, 5);
  assert.equal(board.avgEfficiency, 102);
  assert.equal(board.todayRecordCount, 8);
  assert.equal(board.cumulativeTotal, 488221);
  assert.deepEqual(board.todayDefects, { missing: 6, deform: 3, appearance: 12, other: 2 });
  assert.deepEqual(board.notices, [{ zh: '甲', vi: '', id: '' }, { zh: '乙', vi: 'B', id: 'C' }]);
});

test('missing fields become zeros and an empty notice list', () => {
  const board = mapPublicBoard({});
  assert.equal(board.cumulativeTotal, 0);
  assert.deepEqual(board.todayDefects, { missing: 0, deform: 0, appearance: 0, other: 0 });
  assert.deepEqual(board.notices, []);
});

test('calls the RPC anonymously with the key', async () => {
  const requests = [];
  const board = await withFetch(async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ today_good_count: 3 }) };
  }, () => fetchPublicBoard({ key: 'abc', supabaseUrl: 'https://example.supabase.co', publishableKey: 'public-key' }));
  assert.equal(board.todayGoodCount, 3);
  assert.equal(requests[0].url, 'https://example.supabase.co/rest/v1/rpc/task_timing_public_board');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers.apikey, 'public-key');
  // sb_publishable_ keys are not JWTs; anon calls send apikey only, like taskTimingEmployees.js.
  assert.equal(requests[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(requests[0].options.body), { p_key: 'abc' });
});

test('a missing key fails as a key error without any request', async () => {
  let calls = 0;
  await withFetch(async () => { calls++; }, async () => {
    await assert.rejects(fetchPublicBoard({ key: '', supabaseUrl: 'u', publishableKey: 'k' }), PublicBoardKeyError);
    await assert.rejects(fetchPublicBoard({ key: null, supabaseUrl: 'u', publishableKey: 'k' }), PublicBoardKeyError);
  });
  assert.equal(calls, 0);
});

test('a rejected key is a key error; other failures are plain errors', async () => {
  const call = response => withFetch(async () => response, () => fetchPublicBoard({ key: 'abc', supabaseUrl: 'u', publishableKey: 'k' }));
  await assert.rejects(call({ ok: false, status: 403, json: async () => ({ code: '28000' }) }), PublicBoardKeyError);
  await assert.rejects(call({ ok: false, status: 400, json: async () => ({ code: '28000' }) }), PublicBoardKeyError);
  await assert.rejects(call({ ok: false, status: 503, json: async () => ({}) }), error => !(error instanceof PublicBoardKeyError) && /503/.test(error.message));
  await assert.rejects(call({ ok: false, status: 502, json: async () => { throw new SyntaxError('html'); } }), error => !(error instanceof PublicBoardKeyError));
  await assert.rejects(
    withFetch(async () => { throw new TypeError('Failed to fetch'); }, () => fetchPublicBoard({ key: 'abc', supabaseUrl: 'u', publishableKey: 'k' })),
    error => error instanceof TypeError && !(error instanceof PublicBoardKeyError),
  );
});
