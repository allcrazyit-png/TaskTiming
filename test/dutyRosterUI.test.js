import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('latest information page renders an always-available expandable duty roster', async () => {
  const page = await readFile(new URL('../src/pages/BattleReport.jsx', import.meta.url), 'utf8');

  assert.match(page, /from '\.\.\/utils\/dutyRoster'/);
  assert.match(page, /getWeeklyDutyRoster\(\)/);
  assert.match(page, /isRosterExpanded/);
  assert.match(page, /duty_roster_title/);
  assert.match(page, /duty_roster_view_full/);
  assert.match(page, /duty_roster_this_week/);
  assert.match(page, /<DutyRoster[\s\S]*?\{loading \?/);
});

test('all supported languages label the latest information duty roster', async () => {
  const translations = await readFile(new URL('../src/i18n.js', import.meta.url), 'utf8');

  assert.equal((translations.match(/"battle_report_tab": "(?:最新資訊|Thông tin mới|Info terbaru)"/g) || []).length, 3);
  assert.equal((translations.match(/"duty_roster_title":/g) || []).length, 3);
  assert.equal((translations.match(/"duty_roster_view_full":/g) || []).length, 3);
});
