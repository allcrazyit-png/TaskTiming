import { useEffect, useMemo, useState } from 'react';
import { sortNotices } from '../utils/noticePresentation';
import { getTaskTimingAccessToken } from '../services/taskTimingEmployees';
import { fetchTaskTimingNotices, getActiveTaskTimingNotices } from '../services/taskTimingRecords';

const TTL = 10 * 60 * 1000;
const cacheKey = id => `noticeInbox_v1_${id}`;
const readKey = id => `noticeRead_v1_${id}`;
const memory = new Map();
function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Session still works when storage is unavailable. */ }
}
function stored(key, fallback) { return memory.get(key) ?? read(key, fallback); }
export function noticeIdentity(notice) {
    return JSON.stringify([notice.start_date, notice.end_date ?? '', notice.content, notice.content_vi ?? '', notice.content_id ?? '']);
}
function today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export default function useNoticeInbox(employeeId, { force = false, disabled = false } = {}) {
    const [, setRevision] = useState(0);
    const [error, setError] = useState(false);
    const cache = stored(cacheKey(employeeId), null);
    const notices = getActiveTaskTimingNotices(cache?.notices, today());
    const rawRead = stored(readKey(employeeId), []);
    const readIds = Array.isArray(rawRead) ? rawRead : [];
    // Capture read status on entry so marking a notice read does not move it.
    const entryReadIds = useMemo(() => {
        const ids = stored(readKey(employeeId), []);
        return Array.isArray(ids) ? ids : [];
    }, [employeeId]);
    const orderedNotices = sortNotices(notices, notice => !entryReadIds.includes(noticeIdentity(notice)));
    const isUnread = notice => !readIds.includes(noticeIdentity(notice));
    useEffect(() => {
        if (!employeeId || disabled) return;
        const controller = new AbortController();
        let pending = false;
        let loginExpired = false;
        const refresh = async (mustRefresh = false) => {
            const previous = stored(cacheKey(employeeId), null);
            if (loginExpired || pending || (!mustRefresh && Date.now() - (previous?.fetchedAt ?? 0) < TTL)) return;
            pending = true;
            try {
                const accessToken = await getTaskTimingAccessToken({ signal: controller.signal });
                const data = await fetchTaskTimingNotices({ accessToken, today: today(), signal: controller.signal });
                if (controller.signal.aborted) return;
                write(cacheKey(employeeId), { notices: data, fetchedAt: Date.now() });
                const activeIds = data.map(noticeIdentity);
                const previousRead = stored(readKey(employeeId), []);
                write(readKey(employeeId), (Array.isArray(previousRead) ? previousRead : []).filter(id => activeIds.includes(id)));
                setError(false);
                setRevision(value => value + 1);
            } catch (failure) {
                if (failure.message === 'Employee login expired' || failure.message === 'Employee login required') loginExpired = true;
                if (failure.name !== 'AbortError') setError(true);
            } finally { pending = false; }
        };
        refresh(force);
        const timer = setInterval(() => { setRevision(value => value + 1); refresh(); }, 60000);
        const onFocus = () => refresh();
        window.addEventListener('focus', onFocus);
        return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', onFocus); };
    }, [employeeId, force, disabled]);
    const markRead = notice => {
        if (!employeeId) return;
        write(readKey(employeeId), [...new Set([...readIds, noticeIdentity(notice)])]);
        setRevision(value => value + 1);
    };
    return { notices: employeeId ? orderedNotices : [], error, isUnread, markRead, unreadCount: employeeId ? notices.filter(isUnread).length : 0 };
}
