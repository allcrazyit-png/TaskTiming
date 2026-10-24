import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('master cache accepts fresh empty lists but expires at ten minutes and rejects future or broken timestamps', async () => {
  const source = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  let stored;
  const context = vm.createContext({ localStorage: { getItem: () => stored }, Date });
  vm.runInContext(source.slice(source.indexOf('const MASTER_CACHE_TTL'), source.indexOf('function readCache')), context);
  for (const [age, expected] of [[0, true], [599000, true], [600000, false], [-60000, false]]) {
    stored = JSON.stringify({ at: Date.now() - age, data: [] });
    assert.equal(context.isCacheFresh('test'), expected);
  }
  stored = '{broken';
  assert.equal(context.isCacheFresh('test'), false);
});

test('notice sync skips unchanged successful payloads and retries failed changes including removal of last notice', async () => {
  const source = await readFile(new URL('../src/google_apps_script.js', import.meta.url), 'utf8');
  const props = new Map(); let content = [{ content: 'hello' }]; let calls = 0; let status = 200;
  const context = vm.createContext({ Date, JSON,
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({ getLastColumn: () => 4, getLastRow: () => 1, getRange: () => ({ getDisplayValues: () => [['開始日期', '結束日期', '提醒內容', '啟用']] }) }) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key), setProperty: (key, value) => props.set(key, value) }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_, value) => value, base64Encode: value => value },
    UrlFetchApp: { fetch: () => { calls++; return { getResponseCode: () => status }; } },
  });
  vm.runInContext(source, context);
  context.taskTimingNoticeRows_ = () => content;
  context.taskTimingSupabaseConfig_ = () => ({ baseUrl: 'https://test', secret: 'test' });
  context.syncTaskTimingNoticesToSupabase();
  assert.equal(context.syncTaskTimingNoticesToSupabase().unchanged, true);
  assert.equal(calls, 1);
  content = []; status = 500;
  assert.throws(() => context.syncTaskTimingNoticesToSupabase());
  status = 200; context.syncTaskTimingNoticesToSupabase();
  assert.equal(calls, 3);
  assert.equal(context.syncTaskTimingNoticesToSupabase().unchanged, true);
});
