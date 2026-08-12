import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchTaskTimingProducts,
  mapTaskTimingProduct,
  selectAssemblyProducts,
} from '../src/services/taskTimingProducts.js';

test('maps a Supabase product row to the existing Chinese product contract', () => {
  assert.deepEqual(mapTaskTimingProduct({
    part_number: '55514-02340', product_name: '側裙', car_model: '753D',
    category: '組裝', ct_time_seconds: 45, product_image: '55514-02340_main.jpg',
  }), {
    '品番': '55514-02340', '品名': '側裙', '車型': '753D', '類別': '組裝',
    'CT時間(秒)': 45, '產品圖片': '55514-02340_main.jpg',
  });
});

test('excludes injection products from the assembly product list', () => {
  assert.deepEqual(selectAssemblyProducts([
    { part_number: 'A', product_name: '組裝品', car_model: 'A', category: '組裝' },
    { part_number: 'B', product_name: '射出品', car_model: 'B', category: '射出' },
  ]).map(product => product['品番']), ['A']);
});

test('fetches every product page when the mirror exceeds the PostgREST page size', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const firstPage = Array.from({ length: 1000 }, (_, index) => ({
    part_number: `P${index}`,
    product_name: '組裝品',
    car_model: '753D',
    category: '組裝',
  }));
  const lastPage = [{
    part_number: 'P1000', product_name: '組裝品', car_model: '753D', category: '組裝',
  }];

  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    const body = requests.length === 1 ? firstPage : lastPage;
    return { ok: true, status: 200, json: async () => body };
  };

  try {
    const controller = new AbortController();
    const products = await fetchTaskTimingProducts({
      supabaseUrl: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_test',
      signal: controller.signal,
    });

    assert.equal(products.length, 1001);
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /category=neq\.%E5%B0%84%E5%87%BA/);
    assert.match(requests[0].url, /order=part_number\.asc/);
    assert.equal(requests[0].options.headers.apikey, 'sb_publishable_test');
    assert.equal(requests[0].options.signal, controller.signal);
    assert.equal(requests[0].options.headers.Range, '0-999');
    assert.equal(requests[1].options.headers.Range, '1000-1999');
    assert.equal(products.at(-1)['品番'], 'P1000');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
