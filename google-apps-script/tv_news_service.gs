// Deploy ONLY in a separate Apps Script project, never the reporting GAS project.
// Script Properties: NEWS_FEEDS = JSON array of {url, source} for approved RSS sources.
// No Sheet access, board key, employee data, or reporting URL is used here.
const TV_NEWS_CACHE = 'tv-news-v1';
const TV_NEWS_BACKUP = 'TV_NEWS_BACKUP';
const TV_NEWS_MAX_AGE = 24 * 60 * 60 * 1000;

function doGet() {
  const cache = CacheService.getScriptCache();
  const properties = PropertiesService.getScriptProperties();
  let value = cache.get(TV_NEWS_CACHE);
  if (!value) {
    const lock = LockService.getScriptLock();
    if (lock.tryLock(1000)) {
      try {
        value = cache.get(TV_NEWS_CACHE);
        if (!value) {
          value = updateNews_();
          cache.put(TV_NEWS_CACHE, value, 3600);
        }
      } finally { lock.releaseLock(); }
    }
  }
  value = value || properties.getProperty(TV_NEWS_BACKUP);
  let data;
  try { data = JSON.parse(value); } catch (_) { data = null; }
  if (!data || Date.now() - Date.parse(data.fetchedAt) > TV_NEWS_MAX_AGE) data = { fetchedAt: new Date().toISOString(), items: [] };
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function updateNews_() {
  const properties = PropertiesService.getScriptProperties();
  let feeds;
  try { feeds = JSON.parse(properties.getProperty('NEWS_FEEDS') || '[]'); } catch (_) { feeds = []; }
  const items = [];
  const now = Date.now();
  feeds.slice(0, 3).forEach(feed => {
    if (!/^https:\/\//.test(feed.url) || !feed.source || feed.source.length > 40) return;
    try {
      const response = UrlFetchApp.fetch(feed.url, { muteHttpExceptions: true });
      if (response.getResponseCode() !== 200) return;
      const channel = XmlService.parse(response.getContentText()).getRootElement().getChild('channel');
      if (!channel) return;
      channel.getChildren('item').forEach(node => {
        const title = (node.getChildText('title') || '').trim();
        const published = Date.parse(node.getChildText('pubDate'));
        if (!title || title.length > 80 || !Number.isFinite(published) || published > now + 60000 || now - published > TV_NEWS_MAX_AGE) return;
        items.push({ title, source: feed.source, publishedAt: new Date(published).toISOString() });
      });
    } catch (_) { /* One failing source must not break the remaining sources. */ }
  });
  const unique = items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((item, index, all) => all.findIndex(other => other.title === item.title) === index).slice(0, 6);
  if (!unique.length) {
    // Preserve original timestamps on upstream failure; never make old news look fresh.
    return properties.getProperty(TV_NEWS_BACKUP) || JSON.stringify({ fetchedAt: new Date(now).toISOString(), items: [] });
  }
  const value = JSON.stringify({ fetchedAt: new Date(now).toISOString(), items: unique });
  properties.setProperty(TV_NEWS_BACKUP, value);
  return value;
}
