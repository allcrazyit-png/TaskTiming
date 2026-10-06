import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../src/hooks/useNoticeInbox.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '')
  .replace(/export default /g, '').replace(/export /g, '');

async function exercise(errorMessage) {
  let requests = 0;
  let poll;
  let focus;
  const context = vm.createContext({
    AbortController,
    localStorage: { getItem: () => null, setItem() {} },
    useState: () => [0, () => {}],
    useMemo: callback => callback(),
    useEffect: callback => callback(),
    getActiveTaskTimingNotices: () => [],
    sortNotices: values => values,
    getTaskTimingAccessToken: async () => { requests++; throw new Error(errorMessage); },
    fetchTaskTimingNotices: async () => { throw new Error('Unexpected notice fetch'); },
    setInterval: callback => { poll = callback; return 1; },
    clearInterval() {},
    window: { addEventListener: (_, callback) => { focus = callback; }, removeEventListener() {} },
  });
  vm.runInContext(source, context);
  context.useNoticeInbox('employee');
  await new Promise(resolve => setImmediate(resolve));
  poll();
  await new Promise(resolve => setImmediate(resolve));
  focus();
  await new Promise(resolve => setImmediate(resolve));
  return requests;
}

test('expired notice login stops interval and focus retries', async () => {
  assert.equal(await exercise('Employee login expired'), 1);
  assert.equal(await exercise('Employee login required'), 1);
});

test('temporary service failure still allows notice retries', async () => {
  assert.equal(await exercise('Employee login temporarily unavailable'), 3);
});
