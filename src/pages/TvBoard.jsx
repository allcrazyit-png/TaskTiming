import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import usePublicBoard from '../hooks/usePublicBoard';
import useScreenWakeLock from '../hooks/useScreenWakeLock';
import { getDutyRosterEmployeeId, getWeeklyDutyRoster } from '../utils/dutyRoster';
import { formatClock, getNoticeDisplayMs, nextNoticeIndex, TV_NOTICE_HOLD_MS } from '../utils/tvBoard';
import TvNews from '../components/TvNews';
import './tv-board.css';

const fmt = n => Number(n).toLocaleString('en-US');
const hhmm = d => (d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '--:--');
const GAP = '\u3000';

// Development-only fixtures (#/tv?preview=two|long|none|stale|key|connecting), mirroring tv-board-preview.html.
const PREVIEW_NOTICES = {
    two: [
        { zh: '組裝前請確認卡扣完整。\n發現缺料請先隔離，並通知領班。', vi: 'Trước khi lắp ráp, hãy kiểm tra ngàm cài còn nguyên vẹn.\nNếu thiếu liệu, hãy tách riêng và báo tổ trưởng.', id: 'Sebelum perakitan, periksa keutuhan kait pengunci.\nJika kurang bahan, pisahkan dan laporkan ke kepala regu.' },
        { zh: '下班前請清潔工作桌，並將工具歸位。', vi: '', id: 'Sebelum pulang, bersihkan meja kerja dan kembalikan alat ke tempatnya.' },
    ],
    long: [
        { zh: '本週五（11/27）下午 3 點全廠消防演練。\n聽到警報後請放下手邊工作，依疏散路線至停車場集合。\n請勿搭乘電梯，並協助身旁同事。\n各組組長請於集合後清點人數並回報。\n演練約 30 分鐘，結束後依廣播返回工作崗位。', vi: 'Thứ Sáu (27/11) lúc 3 giờ chiều có diễn tập phòng cháy toàn nhà máy.\nKhi nghe chuông báo, hãy dừng công việc và đi theo lối thoát hiểm đến bãi đỗ xe.\nKhông sử dụng thang máy, hãy giúp đỡ đồng nghiệp bên cạnh.\nTổ trưởng điểm danh và báo cáo sau khi tập trung.', id: 'Jumat (27/11) pukul 15.00 ada latihan kebakaran di seluruh pabrik.\nSaat mendengar alarm, hentikan pekerjaan dan ikuti jalur evakuasi ke tempat parkir.\nJangan gunakan lift, bantu rekan di sebelah Anda.\nKepala regu menghitung anggota dan melapor setelah berkumpul.' },
    ],
};
function previewState(mode) {
    if (mode === 'key') return { status: 'keyError', data: null, lastSuccessAt: null, stale: false };
    if (mode === 'connecting') return { status: 'connecting', data: null, lastSuccessAt: null, stale: false };
    const data = {
        today: '', todayGoodCount: 1240, todayOperators: 5, avgEfficiency: 102, todayRecordCount: 8,
        todayDefects: { missing: 6, deform: 3, appearance: 12, other: 2 },
        notices: PREVIEW_NOTICES[mode] ?? (mode === 'none' ? [] : PREVIEW_NOTICES.two),
    };
    return { status: 'ready', data, lastSuccessAt: new Date(Date.now() - 4 * 60_000), stale: mode === 'stale' };
}

const MISSING_FLASH_MS = 10_000;

// Flashes when the missing count rises (including the first time it appears), then stays solid.
function MissingAlert({ count, zh, vi, id }) {
    const barRef = useRef(null);
    const previous = useRef(0);
    const flashUntil = useRef(0);
    useEffect(() => {
        if (count > previous.current) flashUntil.current = Date.now() + MISSING_FLASH_MS;
        previous.current = count;
        const bar = barRef.current;
        const remaining = flashUntil.current - Date.now();
        if (!bar || remaining <= 0) return undefined;
        bar.classList.add('flash');
        const timer = setTimeout(() => bar.classList.remove('flash'), remaining);
        return () => { clearTimeout(timer); bar.classList.remove('flash'); };
    }, [count]);
    if (count <= 0) return null;
    return (
        <div className="missing-alert" role="alert" ref={barRef}>
            <span className="mark">!</span>
            <div>
                <p className="zh-line">{zh('tv_missing_alert', { count })}</p>
                <p className="tr-line">{vi('tv_missing_alert', { count })}</p>
                <p className="tr-line">{id('tv_missing_alert', { count })}</p>
            </div>
        </div>
    );
}

function useNow(intervalMs) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs]);
    return now;
}

// Ticks every second on its own so the rest of the board does not redraw each second.
function Clock({ zh }) {
    const now = useNow(1_000);
    return (
        <span className="clock">
            {now.getMonth() + 1} 月 {now.getDate()} 日{GAP}{zh('tv_weekday', { day: zh(`tv_day_${now.getDay()}`) })}{GAP}{formatClock(now)}
        </span>
    );
}

function Eyebrow({ label, children }) {
    return <div className="eyebrow"><span>{label.zh}<em>{label.sub}</em></span>{children}</div>;
}

function NoticePanel({ notices, label }) {
    const [index, setIndex] = useState(0);
    const [cycle, setCycle] = useState(0);
    const bodyRef = useRef(null);
    const scrollRef = useRef(null);
    const barRef = useRef(null);
    const current = index < notices.length ? index : 0;
    const contentKey = JSON.stringify(notices);

    useEffect(() => {
        const body = bodyRef.current, scroll = scrollRef.current, bar = barRef.current;
        if (!body || !scroll) return undefined;
        const viewportPx = body.clientHeight * 0.88;
        const overflowPx = Math.max(0, scroll.scrollHeight - viewportPx);
        const { scrollMs, totalMs } = getNoticeDisplayMs({ overflowPx, viewportPx: body.clientHeight });
        scroll.style.transition = 'none';
        scroll.style.transform = 'translateY(0)';
        if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; }
        const timers = [];
        const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
            if (bar) { bar.style.transition = `width ${totalMs}ms linear`; bar.style.width = '100%'; }
            if (overflowPx > 0) {
                timers.push(setTimeout(() => {
                    scroll.style.transition = `transform ${scrollMs}ms linear`;
                    scroll.style.transform = `translateY(-${overflowPx}px)`;
                }, TV_NOTICE_HOLD_MS));
            }
        }));
        timers.push(setTimeout(() => {
            setIndex(nextNoticeIndex(current, notices.length));
            setCycle(c => c + 1);
        }, totalMs));
        return () => { cancelAnimationFrame(frame); timers.forEach(clearTimeout); };
    }, [current, cycle, contentKey, notices.length]);

    const notice = notices[current];
    return (
        <section className="notice">
            <Eyebrow label={label}>{notices.length > 1 && <span className="pg">{current + 1} / {notices.length}</span>}</Eyebrow>
            <div className="notice-body" ref={bodyRef}>
                <div ref={scrollRef}>
                    <div className="zh">{notice.zh}</div>
                    {notice.vi && <div className="tr"><b>TIẾNG VIỆT</b>{notice.vi}</div>}
                    {notice.id && <div className="tr"><b>BAHASA INDONESIA</b>{notice.id}</div>}
                </div>
            </div>
            <div className="ticks">
                {notices.map((n, j) => (
                    // Keyed by cycle so every rotation starts from fresh ticks (no leftover inline width).
                    <span key={`${cycle}-${j}`} className={j < current ? 'done' : ''}><b ref={j === current ? barRef : undefined} /></span>
                ))}
            </div>
        </section>
    );
}

export default function TvBoard() {
    const [params] = useSearchParams();
    const preview = import.meta.env.DEV ? params.get('preview') : null;
    const live = usePublicBoard(params.get('key') ?? '', { disabled: Boolean(preview) });
    const previewMissing = preview ? params.get('missing') : null;
    const state = useMemo(() => {
        if (!preview) return live;
        const s = previewState(preview);
        if (s.data && previewMissing != null) s.data.todayDefects.missing = Number(previewMissing) || 0;
        return s;
    }, [preview, previewMissing, live]);
    const now = useNow(10_000);
    useScreenWakeLock();

    const { i18n } = useTranslation();
    const zh = i18n.getFixedT('zh'), vi = i18n.getFixedT('vi'), id = i18n.getFixedT('id');
    const L = (key, opts) => ({ zh: zh(key, opts), sub: `${vi(key, opts)} · ${id(key, opts)}` });

    if (state.status === 'keyError' || !state.data) {
        const isKeyError = state.status === 'keyError';
        const key = isKeyError ? 'tv_key_error' : 'tv_connecting';
        return (
            <div className="tv-root"><div className="stage"><div className="message">
                <p className={`big ${isKeyError ? 'hot' : ''}`}>{zh(key)}</p>
                <p className="small">{vi(key)}</p>
                <p className="small">{id(key)}</p>
            </div></div></div>
        );
    }

    const { data, stale, lastSuccessAt } = state;
    const hasNotices = data.notices.length > 0;
    const d = data.todayDefects;
    const defectTotal = d.missing + d.deform + d.appearance + d.other;
    const roster = getWeeklyDutyRoster(now);
    const time = hhmm(lastSuccessAt);

    const person = (name, sideKey) => {
        const number = getDutyRosterEmployeeId(name);
        return (
            <div>
                <div className="n">{name}{number && <small>#{number}</small>}</div>
                <div className="k">{zh(sideKey)} · {zh('tv_duty_next')} {roster.next[sideKey === 'tv_duty_women' ? 'women' : 'men']}</div>
            </div>
        );
    };
    const cell = (value, key, hot = false, extra = '') => (
        <div className={`cell ${extra}`}><div className={`v ${hot ? 'hot' : ''}`}>{fmt(value)}</div><div className="k">{zh(key)}<em><span>{vi(key)}</span><span>{id(key)}</span></em></div></div>
    );
    const kpi = (value, unit, key) => (
        <div className="kpi"><div className="v">{value}<small>{unit}</small></div><div className="k">{zh(key)}<em>{vi(key)} · {id(key)}</em></div></div>
    );

    return (
        <div className="tv-root"><div className="stage">
            <div className={`screen ${hasNotices ? 'with-notice' : 'no-notice'}`}>
                <div className="head">
                <div className="top">
                    <span className="brand">{zh('tv_brand')}</span>
                    <Clock zh={zh} />
                    <span className={`live ${stale ? 'stale' : 'ok'}`}><i />{zh(stale ? 'tv_stale' : 'tv_live', { time })}</span>
                </div>
                <MissingAlert count={d.missing} zh={zh} vi={vi} id={id} />
                </div>

                <div className="main">
                    {hasNotices && <NoticePanel notices={data.notices} label={L('tv_notice')} />}
                    <section className="output">
                        <Eyebrow label={L('tv_today_output')} />
                        <div className="hero">{fmt(data.todayGoodCount)}<small>{zh('tv_unit_pcs')}</small></div>
                        <div className="kpis">
                            {kpi(fmt(data.todayOperators), zh('tv_unit_people'), 'tv_operators')}
                            {kpi(data.avgEfficiency, '%', 'tv_efficiency')}
                            {kpi(fmt(data.todayRecordCount), zh('tv_unit_records'), 'tv_uploads')}
                        </div>
                    </section>
                </div>

                <div className="strip">
                    <div>
                        <Eyebrow label={L('tv_defects')} />
                        <div className="row">
                            {cell(d.missing, 'tv_defect_missing', d.missing > 0, 'key-defect')}
                            <span className="divider" />
                            {cell(d.deform, 'tv_defect_deform')}
                            {cell(d.appearance, 'tv_defect_appearance')}
                            {cell(d.other, 'tv_defect_other')}
                            <span className="divider" />
                            {cell(defectTotal, 'tv_defect_total')}
                        </div>
                    </div>
                    <div className="duty">
                        <Eyebrow label={L('tv_duty')} />
                        <div className="row">
                            {person(roster.current.women, 'tv_duty_women')}
                            <span className="divider" />
                            {person(roster.current.men, 'tv_duty_men')}
                        </div>
                    </div>
                </div>
                <TvNews preview={Boolean(preview) && params.get('news') !== 'off'} />
            </div>
        </div></div>
    );
}
