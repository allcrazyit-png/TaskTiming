const env = import.meta.env ?? {};
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const asNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function mapTaskTimingBattleReport(payload = {}) {
  const liveFeed = Array.isArray(payload.live_feed) ? payload.live_feed : [];
  return {
    cumulativeTotal: asNumber(payload.cumulative_total),
    todayGoodCount: asNumber(payload.today_good_count),
    todayRecordCount: asNumber(payload.today_record_count),
    todayOperators: asNumber(payload.today_operator_count),
    avgEfficiency: asNumber(payload.avg_efficiency),
    liveFeed: liveFeed.map(record => ({
      '作業者': String(record.operator_label ?? ''),
      '品番': String(record.part_number ?? ''),
      '產品中文名稱': String(record.product_name ?? ''),
      '良品數量': asNumber(record.good_count),
    })),
  };
}

export async function fetchTaskTimingBattleReport({
  accessToken,
  today,
  signal,
  supabaseUrl = SUPABASE_URL,
  publishableKey = SUPABASE_PUBLISHABLE_KEY,
} = {}) {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  if (!accessToken) throw new Error('Employee login required');
  if (!today) throw new Error('Today is required');

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/task_timing_battle_report`, {
    method: 'POST',
    signal,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_today: today }),
  });
  if (!response.ok) throw new Error(`Supabase battle report request failed: ${response.status}`);

  return mapTaskTimingBattleReport(await response.json());
}
