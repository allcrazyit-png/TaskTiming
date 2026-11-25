import { useEffect, useState } from 'react';
import { NEWS_REFRESH_MS, validNews } from '../utils/tvNews';

const endpoint = import.meta.env.VITE_TV_NEWS_URL || '';
const cacheKey = `tvNews:v1:${endpoint}`;
const demo = () => ({ fetchedAt: new Date().toISOString(), items: [
    { title: '週末親子市集登場，多元手作活動邀民眾參與', source: '示意新聞・非真實報導', publishedAt: new Date().toISOString() },
    { title: '市區道路施工，出門前請先確認替代路線', source: '示意新聞・非真實報導', publishedAt: new Date().toISOString() },
    { title: '生活節能新提案，從日常小習慣開始', source: '示意新聞・非真實報導', publishedAt: new Date().toISOString() },
] });
function readCache() {
    try { return JSON.parse(localStorage.getItem(cacheKey)); } catch { return null; }
}

export default function TvNews({ preview = false }) {
    const [payload, setPayload] = useState(() => preview ? demo() : readCache());
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(n => n + 1), 20_000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        if (preview || !endpoint) return undefined;
        let stopped = false;
        let controller;
        async function refresh() {
            controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8_000);
            try {
                const response = await fetch(endpoint, { signal: controller.signal, credentials: 'omit' });
                if (!response.ok) throw new Error('News unavailable');
                const data = await response.json();
                if (!Array.isArray(data.items) || !Number.isFinite(Date.parse(data.fetchedAt))) throw new Error('Invalid news');
                if (!stopped) {
                    setPayload(data);
                    try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* Storage is optional. */ }
                }
            } catch { /* Keep only unexpired cached headlines; production data is independent. */ }
            finally { clearTimeout(timeout); }
        }
        refresh();
        const timer = setInterval(refresh, NEWS_REFRESH_MS);
        return () => { stopped = true; clearInterval(timer); controller?.abort(); };
    }, [preview]);
    const items = (preview || endpoint) ? validNews(payload) : [];
    if (!items.length) return null;
    const index = tick % items.length;
    const item = items[index];
    const time = new Date(item.publishedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    return <section className="tv-news" aria-label="新聞快訊">
        <div className="tv-news-label">{preview ? '新聞示意' : '新聞快訊'}<small>{index + 1} / {items.length}</small></div>
        <div className="tv-news-content"><div className="tv-news-title">{item.title}</div><div className="tv-news-source">{item.source} · {time}</div></div>
    </section>;
}
