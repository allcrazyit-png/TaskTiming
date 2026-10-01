import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchTaskTimingBattleReport,
  mapTaskTimingBattleReport,
} from '../src/services/taskTimingRecords.js';

test('maps the aggregate RPC response to the battle-report contract', () => {
  assert.deepEqual(mapTaskTimingBattleReport({
    cumulative_total: 478858,
    today_good_count: 1200,
    today_record_count: 4,
    today_operator_count: 3,
    avg_efficiency: 118.8,
    live_feed: [{ operator_label: '[21] 楊淑婷', part_number: 'A-1', product_name: '飾板', good_count: 300 }],
  }), {
    cumulativeTotal: 478858,
    todayGoodCount: 1200,
    todayRecordCount: 4,
    todayOperators: 3,
    avgEfficiency: 118.8,
    liveFeed: [{
      作業者: '[21] 楊淑婷',
      品番: 'A-1',
      產品中文名稱: '飾板',
      良品數量: 300,
    }],
  });
});

test('battle report calls the authenticated Supabase RPC', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ cumulative_total: 12, live_feed: [] }),
    };
  };
  try {
    const result = await fetchTaskTimingBattleReport({
      accessToken: 'employee-token',
      today: '2026-10-01',
      supabaseUrl: 'https://example.supabase.co',
      publishableKey: 'public-key',
    });
    assert.equal(result.cumulativeTotal, 12);
    assert.equal(requests[0].url, 'https://example.supabase.co/rest/v1/rpc/task_timing_battle_report');
    assert.equal(requests[0].options.headers.Authorization, 'Bearer employee-token');
    assert.equal(requests[0].options.headers.apikey, 'public-key');
    assert.deepEqual(JSON.parse(requests[0].options.body), { p_today: '2026-10-01' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
