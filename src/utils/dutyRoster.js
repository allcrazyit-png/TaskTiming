export const WOMEN_DUTY_ROSTER = [
  '林祐香', '何淑如', '陳玉薇', '楊淑婷', '黃舒嬪', '陳麗如', '何佩函', '潘麗芳', '杜氏美蓮',
];

export const MEN_DUTY_ROSTER = ['毆吉', '阿里', '施聖浩', '阿杜', '楊子賢'];

const DAY_MS = 24 * 60 * 60 * 1000;
const BASELINE_MONDAY = new Date(2026, 7, 17);

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

export function getWeeklyDutyRoster(date = new Date()) {
  const weekStart = getMonday(date);
  const weekOffset = Math.round((weekStart - BASELINE_MONDAY) / (7 * DAY_MS));
  const womenIndex = modulo(6 + weekOffset, WOMEN_DUTY_ROSTER.length);
  const menIndex = modulo(4 + weekOffset, MEN_DUTY_ROSTER.length);

  return {
    weekStart,
    weekEnd: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 4),
    current: { women: WOMEN_DUTY_ROSTER[womenIndex], men: MEN_DUTY_ROSTER[menIndex] },
    next: {
      women: WOMEN_DUTY_ROSTER[(womenIndex + 1) % WOMEN_DUTY_ROSTER.length],
      men: MEN_DUTY_ROSTER[(menIndex + 1) % MEN_DUTY_ROSTER.length],
    },
    womenIndex,
    menIndex,
  };
}
