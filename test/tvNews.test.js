import test from 'node:test';
import assert from 'node:assert/strict';
import { validNews, NEWS_MAX_AGE_MS, NEWS_ROTATE_MS } from '../src/utils/tvNews.js';
const now = Date.now();
const item = { title: '新聞標題', source: '測試來源', publishedAt: new Date(now).toISOString() };
const payload = items => ({ fetchedAt: new Date(now).toISOString(), items });
test('news rejects expired cache and stale/future/malformed headlines', () => {
    assert.deepEqual(validNews({ ...payload([item]), fetchedAt: new Date(now - NEWS_MAX_AGE_MS - 1).toISOString() }, now), []);
    assert.deepEqual(validNews(payload([null, {}, { ...item, publishedAt: 'invalid' }, { ...item, publishedAt: new Date(now + 120000).toISOString() }, { ...item, publishedAt: new Date(now - NEWS_MAX_AGE_MS - 1).toISOString() }]), now), []);
});
test('news deduplicates, caps ten items and preserves original publication time', () => {
    const items = [item, item, ...Array.from({ length: 12 }, (_, i) => ({ ...item, title: `標題${i}` }))];
    const result = validNews(payload(items), now);
    assert.equal(result.length, 10);
    assert.deepEqual(result[0], item);
});
test('headlines rotate every 15 seconds', () => {
    assert.equal(NEWS_ROTATE_MS, 15_000);
});
