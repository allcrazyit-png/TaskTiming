export const WOMEN_DUTY_ROSTER = [
  '林祐香', '何淑如', '陳玉薇', '楊淑婷', '黃舒嬪', '陳麗如', '何佩函', '潘麗芳', '杜氏美蓮', '阮金霞',
];

export const MEN_DUTY_ROSTER = ['阿里', '施聖浩', '阿杜', '楊子賢', '志丹'];

// Confirmed employee IDs are separate from the numbered rotation order.
export const DUTY_ROSTER_EMPLOYEE_IDS = {
  '林祐香': '26',
  '何淑如': '16',
  '陳玉薇': '33',
  '楊淑婷': '21',
  '黃舒嬪': '39',
  '陳麗如': '20',
  '何佩函': '36',
  '潘麗芳': '31',
  '杜氏美蓮': '15',
  '阮金霞': '27',
  '阿里': '77',
  '施聖浩': '32',
  '阿杜': '94',
  '楊子賢': '58',
  '志丹': '84',
};

export function getDutyRosterEmployeeId(name) {
  return DUTY_ROSTER_EMPLOYEE_IDS[name] ?? null;
}

const MEN_ORIGINAL_DUTY_ROSTER = ['毆吉', '阿里', '施聖浩', '阿杜', '楊子賢'];
const MEN_EXPANDED_DUTY_ROSTER = [...MEN_ORIGINAL_DUTY_ROSTER, '志丹'];

const DUTY_ROSTER_COUNTRY_FLAGS = {
  '陳玉薇': '🇻🇳',
  '杜氏美蓮': '🇻🇳',
  '阮金霞': '🇻🇳',
  '阿里': '🇮🇩',
  '阿杜': '🇮🇩',
  '志丹': '🇮🇩',
};

export function getDutyRosterDisplayName(name) {
  const flag = DUTY_ROSTER_COUNTRY_FLAGS[name];
  return flag ? `${name} ${flag}` : name;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BASELINE_MONDAY = new Date(2026, 7, 17);
const WOMEN_ROSTER_EFFECTIVE_MONDAY = new Date(2026, 8, 28);
const WOMEN_LEGACY_LENGTH = WOMEN_DUTY_ROSTER.length - 1;
const WOMEN_EFFECTIVE_INDEX = WOMEN_DUTY_ROSTER.indexOf('楊淑婷');
const MEN_ROSTER_EXPANDED_MONDAY = new Date(2026, 7, 24);
const MEN_ROSTER_REMOVAL_MONDAY = new Date(2026, 8, 28);
const MEN_REMOVAL_INDEX = MEN_DUTY_ROSTER.indexOf('志丹');

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getMonday(date = new Date()) {
  const monday = startOfLocalDay(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function modulo(value, length) {
  return ((value % length) + length) % length;
}

function weekOffsetBetween(weekStart, anchorMonday) {
  return Math.round((weekStart - anchorMonday) / (7 * DAY_MS));
}

function getWomenIndex(weekStart) {
  if (weekStart < WOMEN_ROSTER_EFFECTIVE_MONDAY) {
    return modulo(6 + weekOffsetBetween(weekStart, BASELINE_MONDAY), WOMEN_LEGACY_LENGTH);
  }

  return modulo(
    WOMEN_EFFECTIVE_INDEX + weekOffsetBetween(weekStart, WOMEN_ROSTER_EFFECTIVE_MONDAY),
    WOMEN_DUTY_ROSTER.length,
  );
}

function getMenAssignment(weekStart) {
  if (weekStart < MEN_ROSTER_EXPANDED_MONDAY) {
    const originalIndex = modulo(
      4 + weekOffsetBetween(weekStart, BASELINE_MONDAY),
      MEN_ORIGINAL_DUTY_ROSTER.length,
    );
    const name = MEN_ORIGINAL_DUTY_ROSTER[originalIndex];
    return { name, index: MEN_DUTY_ROSTER.indexOf(name) };
  }

  if (weekStart < MEN_ROSTER_REMOVAL_MONDAY) {
    const expandedIndex = modulo(
      weekOffsetBetween(weekStart, MEN_ROSTER_EXPANDED_MONDAY),
      MEN_EXPANDED_DUTY_ROSTER.length,
    );
    const name = MEN_EXPANDED_DUTY_ROSTER[expandedIndex];
    return { name, index: MEN_DUTY_ROSTER.indexOf(name) };
  }

  const index = modulo(
    MEN_REMOVAL_INDEX + weekOffsetBetween(weekStart, MEN_ROSTER_REMOVAL_MONDAY),
    MEN_DUTY_ROSTER.length,
  );
  return { name: MEN_DUTY_ROSTER[index], index };
}

export function getWeeklyDutyRoster(date = new Date()) {
  const weekStart = getMonday(date);
  const nextWeekStart = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 7,
  );
  const womenIndex = getWomenIndex(weekStart);
  const nextWomenIndex = getWomenIndex(nextWeekStart);
  const menAssignment = getMenAssignment(weekStart);
  const nextMenAssignment = getMenAssignment(nextWeekStart);

  return {
    weekStart,
    weekEnd: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 4),
    current: { women: WOMEN_DUTY_ROSTER[womenIndex], men: menAssignment.name },
    next: {
      women: WOMEN_DUTY_ROSTER[nextWomenIndex],
      men: nextMenAssignment.name,
    },
    womenIndex,
    menIndex: menAssignment.index,
  };
}
