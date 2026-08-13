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

  // 只回傳資料，不組字串：文字交給 i18n，切換語言時畫面才會跟著變。
  return {
    isToday,
    time,
    month: latest.getMonth() + 1,
    day: latest.getDate(),
  };
}
