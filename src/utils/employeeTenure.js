export function employeeTenure(hireDate, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hireDate || '')) return null;
  const [year, month, day] = hireDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = type => Number(parts.find(part => part.type === type).value);
  const today = [value('year'), value('month'), value('day')];
  if (hireDate > today.map((n, i) => i ? String(n).padStart(2, '0') : n).join('-')) return null;
  // A 29 February anniversary falls on 28 February in a non-leap year.
  const anniversaryDay = Math.min(day, new Date(Date.UTC(today[0], month, 0)).getUTCDate());
  let years = today[0] - year;
  if (today[1] < month || (today[1] === month && today[2] < anniversaryDay)) years--;
  return { years, tier: years >= 20 ? 'legend' : years >= 15 ? 'diamond' : years >= 10 ? 'platinum' : years >= 5 ? 'gold' : years >= 3 ? 'silver' : years >= 1 ? 'bronze' : 'new' };
}
