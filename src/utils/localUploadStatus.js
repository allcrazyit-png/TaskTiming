function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatLatestLocalUpload(records, now = new Date()) {
  if (!Array.isArray(records)) return null;

  const timestamps = records
    .map(record => Number(record?.submitTimestamp))
    .filter(timestamp => Number.isFinite(timestamp) && timestamp > 0);
  if (timestamps.length === 0) return null;

  const latest = new Date(Math.max(...timestamps));
  const time = `${pad(latest.getHours())}:${pad(latest.getMinutes())}`;
  const isToday = latest.getFullYear() === now.getFullYear()
    && latest.getMonth() === now.getMonth()
    && latest.getDate() === now.getDate();

  return isToday
    ? `最近上傳：今天 ${time}`
    : `最近上傳：${latest.getMonth() + 1}/${latest.getDate()} ${time}`;
}
