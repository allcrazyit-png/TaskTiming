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
  assert.equal((translations.match(/"duty_roster_employee_number":/g) || []).length, 3);
});

test('duty roster shows employee numbers with a badge icon, without list position or ID text', async () => {
  const page = await readFile(new URL('../src/pages/BattleReport.jsx', import.meta.url), 'utf8');
  const roster = page.slice(page.indexOf('function EmployeeBadgeIcon'), page.indexOf('export default function BattleReport'));

  assert.match(roster, /<svg viewBox="0 0 24 24"/);
  assert.match(roster, /duty_roster_employee_number/);
  assert.doesNotMatch(roster, /\{index \+ 1\}/);
  assert.doesNotMatch(roster, /ID \$\{/);
});
