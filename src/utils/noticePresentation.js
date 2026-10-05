export function sortNotices(notices, isUnread) {
    return [...notices].sort((a, b) =>
        Number(isUnread(b)) - Number(isUnread(a)) || b.start_date.localeCompare(a.start_date)
    );
}

export function formatNoticeDates(notice, language = 'zh') {
    const locale = { zh: 'zh-TW', vi: 'vi-VN', id: 'id-ID' }[language.split('-')[0]] || 'zh-TW';
    const showYear = Boolean(notice.end_date && notice.start_date.slice(0, 4) !== notice.end_date.slice(0, 4));
    const format = value => {
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).replace(/^週/, '');
        return `${showYear ? `${year}/` : ''}${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}（${weekday}）`;
    };
    const start = format(notice.start_date);
    return notice.end_date && notice.end_date !== notice.start_date
        ? `${start}～${format(notice.end_date)}` : start;
}
