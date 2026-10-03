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
    todayDefects: ['today_defect_missing', 'today_defect_deform', 'today_defect_appearance', 'today_defect_other'].every(key => payload[key] != null)
      ? { missing: asNumber(payload.today_defect_missing), deform: asNumber(payload.today_defect_deform), appearance: asNumber(payload.today_defect_appearance), other: asNumber(payload.today_defect_other) }
      : null,
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


export function getActiveTaskTimingNotices(notices, today) {
  return (Array.isArray(notices) ? notices : []).filter(notice =>
    typeof notice.content === 'string' && notice.content.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(notice.start_date) &&
    notice.start_date <= today &&
    (notice.end_date == null || notice.end_date === '' || (/^\d{4}-\d{2}-\d{2}$/.test(notice.end_date) && today <= notice.end_date))
  );
}

export async function fetchTaskTimingNotices({ accessToken, today, signal }) {
  const source = '1xo4YhDuxh-wpstg7tmAqW4orB9aBheF1CUFzM1TDWKw';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/task_timing_notice_snapshot?source_sheet_id=eq.${source}&select=notices`, {
    signal,
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Notice request failed: ${response.status}`);
  const rows = await response.json();
  return getActiveTaskTimingNotices(rows[0]?.notices, today);
}

export function getTaskTimingNoticeContent(notice, language) {
  const lang = String(language).split('-')[0];
  const translated = lang === 'vi' ? notice.content_vi : lang === 'id' ? notice.content_id : null;
  return typeof translated === 'string' && translated.trim() ? translated : notice.content;
}
