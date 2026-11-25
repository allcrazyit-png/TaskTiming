export const NEWS_REFRESH_MS = 60 * 60_000;
export const NEWS_MAX_AGE_MS = 24 * 60 * 60_000;

// Never refresh publication dates when a cached response is read.
export function validNews(payload, now = Date.now()) {
    const fetched = Date.parse(payload?.fetchedAt);
    if (!Number.isFinite(fetched) || fetched > now + 60_000 || now - fetched > NEWS_MAX_AGE_MS) return [];
    const seen = new Set();
    return (Array.isArray(payload.items) ? payload.items : []).filter(item => {
        const published = Date.parse(item?.publishedAt);
        if (typeof item?.title !== 'string' || !item.title.trim() || item.title.length > 80 ||
            typeof item.source !== 'string' || !item.source.trim() || item.source.length > 40 ||
            !Number.isFinite(published) || published > now + 60_000 || now - published > NEWS_MAX_AGE_MS ||
            seen.has(item.title)) return false;
        seen.add(item.title);
        return true;
    }).slice(0, 6);
}
