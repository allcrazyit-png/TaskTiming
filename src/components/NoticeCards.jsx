import { useTranslation } from 'react-i18next';
import { noticeIdentity } from '../hooks/useNoticeInbox';
import { getTaskTimingNoticeContent } from '../services/taskTimingRecords';
import { formatNoticeDates } from '../utils/noticePresentation';

export default function NoticeCards({ notices, isUnread, markRead, canMarkRead = true }) {
    const { t, i18n } = useTranslation();
    if (!notices.length) return null;

    return (
        <section className="rounded-2xl border-t-4 border-amber-500 bg-white p-4 shadow-md dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-lg font-black text-amber-700 dark:text-amber-300"><span className="material-symbols-outlined text-2xl" aria-hidden="true">sticky_note_2</span>{t('br_notice_title')}</h2>
            <div className="mt-4 space-y-4">{notices.map((notice) => <article key={noticeIdentity(notice)} className="rounded-xl border border-amber-100 border-l-4 border-l-amber-400 bg-amber-50/70 px-4 py-5 dark:border-amber-900 dark:border-l-amber-500 dark:bg-amber-950/30">
                <span className={`mb-3 inline-block rounded-full px-3 py-1 text-sm font-bold ${isUnread(notice) ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100'}`}>{t(isUnread(notice) ? 'br_unread' : 'br_read')}</span>
                <p className="mb-2 text-base font-bold text-slate-600 dark:text-slate-300">{formatNoticeDates(notice, i18n.language)}</p>
                <p className="whitespace-pre-wrap break-words text-lg font-bold leading-relaxed">{getTaskTimingNoticeContent(notice, i18n.language)}</p>
                {isUnread(notice) && <button disabled={!canMarkRead} onClick={() => markRead(notice)} className="mt-4 min-h-16 w-full rounded-xl bg-primary px-4 text-lg font-bold text-white disabled:opacity-50">{t('br_mark_read')}</button>}
            </article>)}</div>
        </section>
    );
}
