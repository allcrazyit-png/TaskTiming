const env = import.meta.env ?? {};
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PRODUCT_PAGE_SIZE = 1000;

export function mapTaskTimingProduct(row) {
  return {
    '品番': row.part_number,
    '品名': row.product_name,
    '車型': row.car_model,
    '類別': row.category,
    'CT時間(秒)': row.ct_time_seconds ?? 0,
    '產品圖片': row.product_image ?? '',
  };
}

export function selectAssemblyProducts(rows) {
  return rows
    .filter(row => row.category !== '射出')
    .map(mapTaskTimingProduct)
    .filter(product => product['車型'] && product['品番']);
}

export async function fetchTaskTimingProducts({
  signal,
  supabaseUrl = SUPABASE_URL,
  publishableKey = SUPABASE_PUBLISHABLE_KEY,
} = {}) {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  const endpoint = `${supabaseUrl}/rest/v1/task_timing_products?select=part_number,product_name,car_model,category,ct_time_seconds,product_image&category=neq.%E5%B0%84%E5%87%BA&order=part_number.asc`;
  const rows = [];

  for (let offset = 0; ; offset += PRODUCT_PAGE_SIZE) {
    const response = await fetch(endpoint, {
      headers: {
        apikey: publishableKey,
        Range: `${offset}-${offset + PRODUCT_PAGE_SIZE - 1}`,
      },
      signal,
    });
    if (!response.ok) throw new Error(`Supabase products request failed: ${response.status}`);

    const page = await response.json();
    rows.push(...page);
    if (page.length < PRODUCT_PAGE_SIZE) break;
  }

  return selectAssemblyProducts(rows);
}
