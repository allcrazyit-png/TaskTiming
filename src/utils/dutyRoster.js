export const WOMEN_DUTY_ROSTER = [
  '林祐香', '何淑如', '陳玉薇', '楊淑婷', '黃舒嬪', '陳麗如', '何佩函', '潘麗芳', '杜氏美蓮', '阮金霞',
];

export const MEN_DUTY_ROSTER = ['毆吉 🇮🇩', '阿里 🇮🇩', '施聖浩', '阿杜 🇮🇩', '楊子賢', '志丹 🇮🇩'];

const DAY_MS = 24 * 60 * 60 * 1000;
const BASELINE_MONDAY = new Date(2026, 7, 17);
const WOMEN_ROSTER_EFFECTIVE_MONDAY = new Date(2026, 8, 28);
const WOMEN_LEGACY_LENGTH = WOMEN_DUTY_ROSTER.length - 1;
const WOMEN_EFFECTIVE_INDEX = WOMEN_DUTY_ROSTER.indexOf('楊淑婷');

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

export function getWeeklyDutyRoster(date = new Date()) {
  const weekStart = getMonday(date);
  const weekOffset = weekOffsetBetween(weekStart, BASELINE_MONDAY);
  const nextWeekStart = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 7,
  );
  const womenIndex = getWomenIndex(weekStart);
  const nextWomenIndex = getWomenIndex(nextWeekStart);
  const menIndex = modulo(5 + weekOffset, MEN_DUTY_ROSTER.length);

  return {
    weekStart,
    weekEnd: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 4),
    current: { women: WOMEN_DUTY_ROSTER[womenIndex], men: MEN_DUTY_ROSTER[menIndex] },
    next: {
      women: WOMEN_DUTY_ROSTER[nextWomenIndex],
      men: MEN_DUTY_ROSTER[(menIndex + 1) % MEN_DUTY_ROSTER.length],
    },
    womenIndex,
    menIndex,
  };
}
