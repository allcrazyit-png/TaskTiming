# 公共區域看板螢幕 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal：** 新增免登入的 `/#/tv?key=…` 看板頁，放在飲水機旁的迷你電腦上以 Chrome kiosk 模式長時間播放今日公告與產量。

**Architecture：** 後端新增 `security definer` 的唯讀函式 `task_timing_public_board(p_key)`，以網址密鑰的 SHA-256 比對 `task_timing_board_keys`，只回傳彙總數字與今日有效公告。前端新增 `TvBoard` 頁面，每 60 秒以 anon 身分呼叫該函式，抓取失敗時保留上一次的畫面；狀態轉換、里程碑、輪播時間、凌晨重載時間都抽成純函式，用 `node --test` 測試。

**Tech Stack：** React 19、react-router-dom v7（HashRouter）、react-i18next、Vite 7、純 CSS（container query 單位）、Supabase（Postgres + PostgREST）、`node --test`。

**Spec：** `docs/superpowers/specs/2026-11-21-public-board-screen-design.md`；版面樣品 `tv-board-preview.html`（Tesla 黑主題，看 `:root`/`[data-theme="tesla"]` 與 `.stage` 之後的規則，忽略 `.ctrl` 控制列與 apple 主題）。

## Global Constraints

- 不得 `git push`、`npm run deploy`；只做本地 commit。
- 套用到線上 Supabase 的任何變更（migration、插入密鑰雜湊）必須先在聊天中取得使用者明確同意。
- 密鑰原文不得寫進 repo、commit、測試或文件；只在聊天中交給使用者一次。密鑰格式：`openssl rand -hex 32`（64 個十六進位字元，URL 安全）。
- 函式回傳內容不得包含作業員姓名、編號、品番或任何個別紀錄。
- 更新間隔 `60_000` ms；公告輪播 `15_000` ms；長公告先停 `3_000` ms 再捲動；每日 `04:00` 整頁重載。
- 里程碑：`[10000, 50000, 100000, 500000, 1000000]`。
- 風格：純黑背景 `#000`、白字、唯一強調色 `#e82127`（只用於「公告」標題、不良合計 > 0、斷線狀態）；畫面 16:9，以 `cqh`/`cqw` 縮放；不跟隨 `appTheme`。
- 不改動 `src/pages/BattleReport.jsx` 的行為。
- 目標瀏覽器：迷你電腦上的新版 Chrome；不加 legacy build。

## Review Focus

1. **公告缺少越南文或印尼文**（`content_vi`/`content_id` 為空或空白）→ 該語言整段不顯示，不留空白標題。Task 2 `mapPublicBoard` 的測試鎖住正規化。
2. **凌晨 04:00 重載時剛好斷網**（第一次抓取就是網路錯誤）→ 顯示「連線中…」並持續重試，不顯示密鑰錯誤。Task 3 `reduceBoardState` 的測試鎖住。
3. **輪播中公告數量變少**（例如 3 則變 1 則，或變 0 則）→ 索引不越界，0 則時切到無公告版面。Task 3 `nextNoticeIndex` 的測試鎖住。
4. **累計產量超過 1M**（所有里程碑都達成）→ 進度條 100%，不出現「還差 0 件」或負數。Task 3 `getMilestoneProgress` 的測試鎖住。
5. **網址沒帶 `key` 或密鑰錯誤** → 不發出無意義的請求（缺 key 時）、顯示大字設定錯誤訊息，且函式不回傳任何資料。Task 1 schema 測試與 Task 2 服務測試鎖住。

---

### Task 1: 看板唯讀函式與密鑰資料表（migration）

**Files:**
- Create: `supabase/migrations/20261121_public_board.sql`
- Test: `test/taskTimingPublicBoardSchema.test.js`

**Interfaces:**
- Produces: RPC `POST /rest/v1/rpc/task_timing_public_board`，body `{ "p_key": string }`。
  - 成功回傳 jsonb（snake_case）：`{ today: 'YYYY-MM-DD', today_good_count, today_operator_count, avg_efficiency, today_record_count, cumulative_total, today_defect_missing, today_defect_deform, today_defect_appearance, today_defect_other, notices: [{ content, content_vi, content_id }] }`。
  - 密鑰不符（含 null）：`raise exception 'invalid board key' using errcode = '28000'`，PostgREST 回 4xx 且 body 的 `code` 為 `'28000'`。
- Produces: 資料表 `public.task_timing_board_keys(key_hash text primary key, label text, created_at timestamptz not null default now())`。

- [ ] **Step 1: Write the failing test** `test/taskTimingPublicBoardSchema.test.js`，仿照 `test/taskTimingRecordsSchema.test.js` 讀檔再用 regex 斷言：

```js
const sql = await readFile(new URL('../supabase/migrations/20261121_public_board.sql', import.meta.url), 'utf8');
const fnBody = sql.slice(sql.search(/create or replace function public\.task_timing_public_board/i));

test('board keys are stored only as hashes and are invisible to browsers', () => {
  assert.match(sql, /create table if not exists public\.task_timing_board_keys/i);
  assert.match(sql, /key_hash text primary key/i);
  assert.match(sql, /alter table public\.task_timing_board_keys enable row level security/i);
  assert.match(sql, /revoke all on (table )?public\.task_timing_board_keys from anon, authenticated/i);
  assert.doesNotMatch(sql, /grant [^;]* on (table )?public\.task_timing_board_keys/i);
});

test('public board is a key-checked definer function callable by anon', () => {
  assert.match(fnBody, /security definer/i);
  assert.match(fnBody, /set search_path = public/i);
  assert.match(fnBody, /encode\(sha256\(convert_to\(p_key, 'UTF8'\)\), 'hex'\)/i);
  assert.match(fnBody, /errcode = '28000'/i);
  assert.match(fnBody, /at time zone 'Asia\/Taipei'/i);
  assert.match(sql, /revoke all on function public\.task_timing_public_board\(text\) from public/i);
  assert.match(sql, /grant execute on function public\.task_timing_public_board\(text\) to anon, authenticated/i);
});

test('public board returns aggregates and trilingual notice text only', () => {
  assert.match(fnBody, /1xo4YhDuxh-wpstg7tmAqW4orB9aBheF1CUFzM1TDWKw/);
  for (const field of ['content', 'content_vi', 'content_id']) assert.match(fnBody, new RegExp(`'${field}'`));
  for (const leak of ['operator_label', 'operator_name', 'part_number', 'product_name', 'live_feed']) assert.doesNotMatch(fnBody, new RegExp(leak));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/taskTimingPublicBoardSchema.test.js`
Expected: FAIL，`ENOENT`（migration 檔不存在）

- [ ] **Step 3: 寫 migration `supabase/migrations/20261121_public_board.sql`**

- 資料表與權限照上面的 Interfaces 與測試。
- 函式 `public.task_timing_public_board(p_key text) returns jsonb language plpgsql stable security definer set search_path = public`：
  1. `if not exists (select 1 from public.task_timing_board_keys where key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')) then raise exception ... using errcode = '28000'; end if;`（`p_key` 為 null 時 `sha256` 為 null，自然不符）。
  2. `v_today := (now() at time zone 'Asia/Taipei')::date`。
  3. 彙總欄位直接照抄 `supabase/task_timing_records.sql` 中 `task_timing_battle_report` 的 `totals` 與 `today_summary` CTE（含 `avg_efficiency` 公式），**不要**帶上 `live_feed`。
  4. `notices`：從 `task_timing_notice_snapshot where source_sheet_id = '1xo4YhDuxh-wpstg7tmAqW4orB9aBheF1CUFzM1TDWKw'` 的 `notices` 陣列以 `jsonb_array_elements` 展開，篩選條件與前端 `getActiveTaskTimingNotices`（`src/services/taskTimingRecords.js:56`）一致：`content` trim 後非空、`start_date ~ '^\d{4}-\d{2}-\d{2}$'` 且 `<= v_today::text`、`end_date` 為 null／空字串／或（符合日期格式且 `>= v_today::text`）。每則只 `jsonb_build_object('content', …, 'content_vi', …, 'content_id', …)`，保留原陣列順序（`with ordinality`），無資料時回 `'[]'::jsonb`。
- 最後加 `comment on function` 一行說明換密鑰的方法（刪舊列、插新列）。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/taskTimingPublicBoardSchema.test.js`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261121_public_board.sql test/taskTimingPublicBoardSchema.test.js
git commit -m "Add key-checked public board function for the TV screen"
```

---

### Task 2: 前端資料服務 `fetchPublicBoard`

**Files:**
- Modify: `src/services/taskTimingRecords.js`（在 `fetchTaskTimingBattleReport` 之後新增）
- Test: `test/taskTimingPublicBoard.test.js`

**Interfaces:**
- Consumes: Task 1 的 RPC 與錯誤碼 `'28000'`。
- Produces:
  - `export class PublicBoardKeyError extends Error`（`name = 'PublicBoardKeyError'`）
  - `export function mapPublicBoard(payload) -> { today: string, todayGoodCount: number, todayOperators: number, avgEfficiency: number, todayRecordCount: number, cumulativeTotal: number, todayDefects: { missing, deform, appearance, other }, notices: Array<{ zh: string, vi: string, id: string }> }`
  - `export async function fetchPublicBoard({ key, signal, supabaseUrl = SUPABASE_URL, publishableKey = SUPABASE_PUBLISHABLE_KEY }) -> ReturnType<mapPublicBoard>`

- [ ] **Step 1: Write the failing tests** `test/taskTimingPublicBoard.test.js`（mock `globalThis.fetch` 的方式照 `test/taskTimingRecords.test.js:30-58`，finally 還原）：

```js
test('maps the public board payload and normalizes notice languages', () => {
  const board = mapPublicBoard({
    today: '2026-11-21', today_good_count: '1240', today_operator_count: 5, avg_efficiency: 102,
    today_record_count: 8, cumulative_total: 488221,
    today_defect_missing: 6, today_defect_deform: 3, today_defect_appearance: 12, today_defect_other: 2,
    notices: [{ content: ' 甲 ', content_vi: '  ', content_id: null }, { content: '乙', content_vi: 'B', content_id: 'C' }],
  });
  assert.equal(board.todayGoodCount, 1240);
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
  // fetch mock 回 { ok: true, status: 200, json: async () => ({ today_good_count: 3 }) }
  const board = await fetchPublicBoard({ key: 'abc', supabaseUrl: 'https://example.supabase.co', publishableKey: 'public-key' });
  assert.equal(board.todayGoodCount, 3);
  assert.equal(requests[0].url, 'https://example.supabase.co/rest/v1/rpc/task_timing_public_board');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers.apikey, 'public-key');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer public-key');
  assert.deepEqual(JSON.parse(requests[0].options.body), { p_key: 'abc' });
});

test('a missing key fails as a key error without any request', async () => {
  // fetch mock 計數
  await assert.rejects(fetchPublicBoard({ key: '', supabaseUrl: 'u', publishableKey: 'k' }), PublicBoardKeyError);
  assert.equal(calls, 0);
});

test('a rejected key is a key error; other failures are plain errors', async () => {
  // { ok: false, status: 403, json: async () => ({ code: '28000' }) } -> PublicBoardKeyError
  // { ok: false, status: 400, json: async () => ({ code: '28000' }) } -> PublicBoardKeyError
  // { ok: false, status: 503, json: async () => ({}) }               -> Error 且 not instanceof PublicBoardKeyError
  // fetch 直接 throw TypeError('Failed to fetch')                    -> 原錯誤往外丟，not instanceof PublicBoardKeyError
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/taskTimingPublicBoard.test.js`
Expected: FAIL，`mapPublicBoard` / `fetchPublicBoard` 未匯出

- [ ] **Step 3: 實作** `PublicBoardKeyError`、`mapPublicBoard`、`fetchPublicBoard`

- 數字一律用檔案內既有的 `asNumber`；語言字串用 `String(x ?? '').trim()`；`content` trim 後為空的公告丟掉。
- `fetchPublicBoard`：`key` 為空 → 直接 `throw new PublicBoardKeyError(...)`；缺 env → 同 `fetchTaskTimingBattleReport` 的錯誤。Authorization 用 `Bearer ${publishableKey}`（anon）。`!response.ok` 時嘗試讀 JSON（讀失敗當 `{}`），`body.code === '28000'` → `PublicBoardKeyError`，否則 `Error('Public board request failed: <status>')`。

- [ ] **Step 4: Run tests**

Run: `node --test test/taskTimingPublicBoard.test.js test/taskTimingRecords.test.js`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/taskTimingRecords.js test/taskTimingPublicBoard.test.js
git commit -m "Add anonymous public board fetch with key error detection"
```

---

### Task 3: 看板純函式（狀態、里程碑、輪播、重載時間）

**Files:**
- Create: `src/utils/tvBoard.js`
- Test: `test/tvBoard.test.js`

**Interfaces:**
- Produces（全部 named export）：
  - `TV_REFRESH_MS = 60_000`、`TV_NOTICE_ROTATE_MS = 15_000`、`TV_NOTICE_HOLD_MS = 3_000`、`TV_RELOAD_HOUR = 4`、`TV_MILESTONES = [10000, 50000, 100000, 500000, 1000000]`
  - `initialBoardState = { status: 'loading', data: null, lastSuccessAt: null, stale: false }`
  - `reduceBoardState(state, event) -> state`，`event` 為 `{ type: 'success', data, at: Date }` 或 `{ type: 'failure', error, at: Date }`。`status` ∈ `'loading' | 'ready' | 'connecting' | 'keyError'`。
  - `getMilestoneProgress(cumulative) -> { next: number, remaining: number, percent: number, allDone: boolean, reached: number[] }`
  - `nextNoticeIndex(current, count) -> number`
  - `getNoticeDisplayMs({ overflowPx, viewportPx }) -> { scrollMs: number, totalMs: number }`
  - `msUntilNextReload(now: Date, hour = TV_RELOAD_HOUR) -> number`

- [ ] **Step 1: Write the failing tests** `test/tvBoard.test.js`：

```js
const data = { todayGoodCount: 1 };
const t0 = new Date('2026-11-21T10:00:00');

test('success shows data and clears stale', () => {
  const s = reduceBoardState({ ...initialBoardState, stale: true }, { type: 'success', data, at: t0 });
  assert.deepEqual(s, { status: 'ready', data, lastSuccessAt: t0, stale: false });
});

test('failure after success keeps the old data and marks it stale', () => {
  const ready = reduceBoardState(initialBoardState, { type: 'success', data, at: t0 });
  const s = reduceBoardState(ready, { type: 'failure', error: new TypeError('Failed to fetch'), at: new Date() });
  assert.equal(s.status, 'ready'); assert.equal(s.data, data); assert.equal(s.lastSuccessAt, t0); assert.equal(s.stale, true);
});

test('a network failure on first load is "connecting", never a key error', () => {
  const s = reduceBoardState(initialBoardState, { type: 'failure', error: new TypeError('Failed to fetch'), at: t0 });
  assert.equal(s.status, 'connecting'); assert.equal(s.data, null);
});

test('a key error replaces the board even if data was shown', () => {
  const ready = reduceBoardState(initialBoardState, { type: 'success', data, at: t0 });
  const s = reduceBoardState(ready, { type: 'failure', error: new PublicBoardKeyError('bad'), at: t0 });
  assert.equal(s.status, 'keyError'); assert.equal(s.data, null);
});

test('milestone progress', () => {
  assert.deepEqual(getMilestoneProgress(488221), { next: 500000, remaining: 11779, percent: 488221 / 500000 * 100, allDone: false, reached: [10000, 50000, 100000] });
  assert.deepEqual(getMilestoneProgress(0).next, 10000);
  assert.deepEqual(getMilestoneProgress(1200000), { next: 1000000, remaining: 0, percent: 100, allDone: true, reached: [10000, 50000, 100000, 500000, 1000000] });
});

test('notice index wraps and survives a shrinking list', () => {
  assert.equal(nextNoticeIndex(0, 2), 1);
  assert.equal(nextNoticeIndex(1, 2), 0);
  assert.equal(nextNoticeIndex(2, 1), 0);
  assert.equal(nextNoticeIndex(5, 0), 0);
});

test('short notices rotate every 15 s; long ones scroll after a 3 s hold', () => {
  assert.deepEqual(getNoticeDisplayMs({ overflowPx: 0, viewportPx: 500 }), { scrollMs: 0, totalMs: 15000 });
  const long = getNoticeDisplayMs({ overflowPx: 1000, viewportPx: 500 });
  assert.equal(long.scrollMs, 28000);           // 每捲過一個可視高度 14 秒
  assert.equal(long.totalMs, 28000 + 3000 * 2); // 前後各停 3 秒
});

test('next reload is the coming 04:00', () => {
  assert.equal(msUntilNextReload(new Date('2026-11-21T03:00:00')), 60 * 60 * 1000);
  assert.equal(msUntilNextReload(new Date('2026-11-21T04:00:00')), 24 * 60 * 60 * 1000);
  assert.equal(msUntilNextReload(new Date('2026-11-21T22:30:00')), 5.5 * 60 * 60 * 1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/tvBoard.test.js`
Expected: FAIL，`src/utils/tvBoard.js` 不存在

- [ ] **Step 3: 實作 `src/utils/tvBoard.js`**

- `reduceBoardState` 從 `../services/taskTimingRecords.js` import `PublicBoardKeyError` 判斷錯誤種類。
- `getNoticeDisplayMs`：`scrollMs = overflowPx > 0 ? overflowPx / viewportPx * 14000 : 0`；`totalMs = max(TV_NOTICE_ROTATE_MS, scrollMs + TV_NOTICE_HOLD_MS * 2)`（與樣品 `startNotice` 相同）。
- `msUntilNextReload`：用本地時間建立今天的 `hour:00:00`，若 `<= now` 就加一天。

- [ ] **Step 4: Run tests**

Run: `node --test test/tvBoard.test.js`
Expected: PASS（8 tests）

- [ ] **Step 5: Commit**

```bash
git add src/utils/tvBoard.js test/tvBoard.test.js
git commit -m "Add TV board state, milestone, rotation and reload helpers"
```

---

### Task 4: `/tv` 看板頁面

**Files:**
- Create: `src/pages/TvBoard.jsx`、`src/pages/tv-board.css`
- Create: `src/hooks/usePublicBoard.js`、`src/hooks/useScreenWakeLock.js`
- Modify: `src/App.jsx`（加 `<Route path="/tv" element={<TvBoard />} />`）
- Modify: `src/i18n.js`（`zh`、`vi`、`id` 三個 `translation` 各加 `tv_*` 鍵）

**Interfaces:**
- Consumes: `fetchPublicBoard`、`PublicBoardKeyError`（Task 2）；`reduceBoardState`、`initialBoardState`、`getMilestoneProgress`、`nextNoticeIndex`、`getNoticeDisplayMs`、`msUntilNextReload`、`TV_REFRESH_MS`、`TV_MILESTONES`（Task 3）；`getWeeklyDutyRoster`、`getDutyRosterEmployeeId`、`getDutyRosterDisplayName`（`src/utils/dutyRoster.js`）。
- Produces:
  - `usePublicBoard(key: string) -> { status, data, lastSuccessAt, stale }`：掛載時立即抓一次，之後每 `TV_REFRESH_MS` 抓一次；每次以 `reduceBoardState` 更新；卸載時 abort 並清 interval。另外用 `setTimeout(msUntilNextReload(new Date()))` 觸發 `window.location.reload()`。
  - `useScreenWakeLock()`：`navigator.wakeLock?.request('screen')`，`visibilitychange` 回到 visible 時重新請求；不支援或被拒時靜默忽略。
  - i18n 鍵（zh 值如下；vi/id 以樣品 `tv-board-preview.html` 中的對應文字為準）：`tv_brand`「組裝課　今日看板」、`tv_notice`「公告」、`tv_today_output`「今日產量」、`tv_operators`「上線」、`tv_efficiency`「平均效率」、`tv_uploads`「上傳」、`tv_cumulative`「累計產量」、`tv_to_next`「距離 {{target}} 還差 {{remaining}} 件」、`tv_all_done`「已達成全部里程碑」、`tv_defects`「今日不良」、`tv_defect_total`「合計」、`tv_defect_missing`「缺料」、`tv_defect_deform`「變形」、`tv_defect_appearance`「外觀」、`tv_defect_other`「其他」、`tv_duty`「本週值日生」、`tv_duty_women`「女生」、`tv_duty_men`「男生」、`tv_duty_next`「下週」、`tv_live`「即時 · 更新於 {{time}}」、`tv_stale`「連線中斷 · {{time}} 的資料」、`tv_connecting`「連線中…」、`tv_key_error`「看板網址的密鑰不正確，請洽管理人員」、`tv_unit_pcs`「件」、`tv_unit_people`「人」、`tv_unit_records`「筆」、`tv_weekday_0`…`tv_weekday_6`（日…六）。

- [ ] **Step 1: 寫 hooks 與 i18n 鍵**（如上 Interfaces）。

- [ ] **Step 2: 寫 `TvBoard.jsx` 與 `tv-board.css`**

- 讀 key：`useSearchParams()`（HashRouter 下 `#/tv?key=…` 的 query 由它取得）。
- 開發預覽：只在 `import.meta.env.DEV` 下，`?preview=two|long|none|stale|key|connecting` 時不呼叫 hook 的 fetch，改用樣品 `tv-board-preview.html` 的 `NOTICES`/`D` 假資料，直接給定 state。正式建置中此分支不得生效。
- 三語標籤：`const zh = i18n.getFixedT('zh'), vi = i18n.getFixedT('vi'), id = i18n.getFixedT('id')`；主標籤用 `zh(key)`，下方小字 `${vi(key)} · ${id(key)}`，結構照樣品的 `.eyebrow em`、`.k em`。
- 版面、class 名稱與 CSS 數值照搬樣品的 Tesla 主題（`.stage`、`.screen.with-notice|no-notice`、`.top`、`.notice`、`.output`、`.kpis`、`.mile`、`.strip`、`.duty`）。CSS 一律以 `.tv-root` 為前綴，避免汙染其他頁；`.tv-root` 自己設 `position: fixed; inset: 0; background: #000`。
- `data.notices.length === 0` → `no-notice` 版面，不渲染公告區塊，也不出現任何「沒有公告」字樣。
- 公告：越南文／印尼文為空字串時，不渲染該 `.tr` 區塊（含標題）。輪播用 `nextNoticeIndex` 與 `getNoticeDisplayMs`，換頁時量測 `#scroll` 的 `scrollHeight` 與容器 `clientHeight * .88` 算 overflow；公告清單更新後若索引超出範圍，用 `nextNoticeIndex(idx - 1, count)` 校正。
- 里程碑：`allDone` 時顯示 `tv_all_done`，不顯示「還差」。
- 不良合計 > 0 才加強調色 class。
- 值日生：女生、男生各顯示本週人選（`getDutyRosterDisplayName` + `#` + `getDutyRosterEmployeeId`，無編號時不顯示 `#`）與「下週 <名字>」。
- 頂列時鐘每 10 秒更新；`stale` 時用 `tv_stale` 並套紅色。
- `status === 'loading' | 'connecting'` 且沒有資料：全黑畫面置中顯示 `tv_connecting`。`status === 'keyError'`：全黑畫面置中大字 `tv_key_error`。
- 頁面不渲染底部導覽列，不讀 `savedOperatorId`。

- [ ] **Step 3: 靜態檢查與建置**

Run: `npm run lint && npm test && npm run build`
Expected: lint 無錯誤、全部測試 PASS、build 成功

- [ ] **Step 4: 視覺檢查**（`npm run dev`，用內建瀏覽器 pane 設 1920×1080）

依序開 `#/tv?preview=two`、`long`、`none`、`stale`、`key`、`connecting`，截圖並對照 `tv-board-preview.html` 同狀態：
- `two`：15 秒後換到 2 / 2，進度線前進。
- `long`：3 秒後開始往上捲，捲完再換頁。
- `none`：沒有公告欄，產量變大，畫面沒有任何空白區塊。
- `stale`：右上變紅色「連線中斷 · HH:MM 的資料」，其餘數字仍在。
- 另外把視窗改成 1366×768 與 3840×2160，確認等比縮放、沒有捲軸。

- [ ] **Step 5: Commit**

```bash
git add src/pages/TvBoard.jsx src/pages/tv-board.css src/hooks/usePublicBoard.js src/hooks/useScreenWakeLock.js src/App.jsx src/i18n.js
git commit -m "Add /tv public board screen page"
```

---

### Task 5: 套用到線上並建立密鑰（需使用者同意）

**Files:** 無（線上資料庫操作）

**Interfaces:**
- Consumes: Task 1 migration；Task 4 頁面。
- Produces: 線上可用的 `task_timing_public_board`；一組交給使用者的密鑰。

- [ ] **Step 1: 停下來請使用者同意**：說明將在線上 Supabase 執行 `20261121_public_board.sql`（新增一張密鑰表與一個函式，不改動既有資料表），以及插入一列密鑰雜湊。取得明確「可以」後才繼續。

- [ ] **Step 2: 套用 migration**（Supabase MCP `apply_migration`，name `public_board`，內容為該檔案）。

- [ ] **Step 3: 產生密鑰並寫入雜湊**

```bash
KEY=$(openssl rand -hex 32); printf %s "$KEY" | shasum -a 256 | cut -d' ' -f1
```

用 `execute_sql` 執行 `insert into public.task_timing_board_keys (key_hash, label) values ('<雜湊>', '飲水機旁螢幕');`。密鑰原文不寫入任何檔案。

- [ ] **Step 4: 線上驗證**（`curl`，用 `.env.local` 的 URL 與 publishable key）
- 錯誤密鑰 `{"p_key":"wrong"}` → 4xx 且 `code` 為 `28000`，body 不含任何數字資料。
- 正確密鑰 → 200，JSON 含 `today_good_count` 等欄位；用 `grep` 確認輸出不含 `operator`、`part_number`。
- 直接 `GET /rest/v1/task_timing_board_keys`（anon）→ 拿不到任何列。

- [ ] **Step 5: 端對端**：`npm run dev` 後在瀏覽器 pane 開 `#/tv?key=<密鑰>`，確認顯示今天真實數字、綠點「即時 · 更新於」，60 秒後時間更新。之後把網址的 key 改錯一個字，確認出現密鑰錯誤畫面。

- [ ] **Step 6: 把密鑰原文在聊天中交給使用者一次**，並附完整看板網址 `https://allcrazyit-png.github.io/TaskTiming/#/tv?key=<密鑰>`（提醒：需等使用者決定 deploy 後此網址才有新頁面）。

---

### Task 6: 迷你電腦安裝說明

**Files:**
- Create: `docs/tv-board-setup.md`

- [ ] **Step 1: 寫說明（繁體中文，給非技術人員）**，包含：
- Windows：建立 Chrome 捷徑，目標加上 `--kiosk "<看板網址>" --noerrdialogs --disable-session-crashed-bubble --disable-infobars`，放進「啟動」資料夾（`shell:startup`）讓開機自動開啟。
- 電源設定：螢幕關閉與睡眠都設「永不」；BIOS 若有「AC 復電自動開機」請開啟，停電復電後才會自己開機。
- 設定完成後收起鍵盤滑鼠；離開 kiosk 用 `Alt+F4`。
- 換密鑰：在 Supabase SQL Editor 執行 `delete from public.task_timing_board_keys;` 再插入新雜湊（附產生雜湊的指令），然後更新迷你電腦捷徑上的網址。
- 用量說明：每分鐘一次，只在看板開著時才會呼叫。
- 文件中不得出現真實密鑰，以 `<密鑰>` 代替。

- [ ] **Step 2: Commit**

```bash
git add docs/tv-board-setup.md
git commit -m "Add setup guide for the TV board mini PC"
```
