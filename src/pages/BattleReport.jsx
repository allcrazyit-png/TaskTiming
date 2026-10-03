import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    MEN_DUTY_ROSTER,
    WOMEN_DUTY_ROSTER,
    getDutyRosterDisplayName,
    getDutyRosterEmployeeId,
    getWeeklyDutyRoster,
} from '../utils/dutyRoster';
import { getTaskTimingAccessToken } from '../services/taskTimingEmployees';
import { fetchTaskTimingBattleReport, fetchTaskTimingNotices, getTaskTimingNoticeContent } from '../services/taskTimingRecords';

const MILESTONES = [10000, 50000, 100000, 500000, 1000000];


function getLocalDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Semi-circle gauge
function EfficiencyGauge({ value }) {
    const clamped = Math.max(0, Math.min(150, value));
    const angle = (clamped / 150) * 180 - 90;
    const rad = (angle * Math.PI) / 180;
    const cx = 90, cy = 88, r = 72;
    const nx = cx + r * Math.cos(rad);
    const ny = cy + r * Math.sin(rad);
    let color = '#ef4444';
    if (value >= 90) color = '#f59e0b';
    if (value >= 100) color = '#22c55e';
    if (value >= 110) color = '#0d9488';

    return (
        <svg viewBox="0 0 180 100" className="w-52 mx-auto">
            <defs>
                <linearGradient id="gr" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="45%" stopColor="#f59e0b" />
                    <stop offset="75%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
            </defs>
            <path d="M 18 88 A 72 72 0 0 1 162 88" fill="none" stroke="#e2e8f0" className="dark:stroke-slate-700" strokeWidth="12" strokeLinecap="round" />
            <path d="M 18 88 A 72 72 0 0 1 162 88" fill="none" stroke="url(#gr)" strokeWidth="10" strokeLinecap="round" />
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="3" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="5" fill={color} />
        </svg>
    );
}

function EmployeeBadgeIcon({ className = 'h-5 w-5' }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <rect x="2.5" y="4" width="19" height="16" rx="3" />
            <circle cx="8.5" cy="10" r="2" />
            <path d="M5.5 16c.5-2 1.5-3 3-3s2.5 1 3 3M14 9h4.5M14 13h4.5" />
        </svg>
    );
}

function DutyRoster({ t, roster, isExpanded, onToggle }) {
    const formatDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
    const weekLabel = `${formatDate(roster.weekStart)}（一）～${formatDate(roster.weekEnd)}（五）`;
    const renderEmployeeNumber = (number, className, iconClassName = 'h-5 w-5') => {
        if (!number) return null;
        return (
            <span className={`inline-flex items-center gap-1.5 tabular-nums ${className}`} aria-label={t('duty_roster_employee_number', { number })}>
                <EmployeeBadgeIcon className={iconClassName} />
                <span>{number}</span>
            </span>
        );
    };
    const renderCurrentPerson = (name) => {
        const number = getDutyRosterEmployeeId(name);
        return (
            <>
                <p className="mt-1 text-3xl font-black text-slate-900 dark:text-white">
                    {number ? renderEmployeeNumber(number, '', 'h-6 w-6 shrink-0') : getDutyRosterDisplayName(name)}
                </p>
                {number && <p className="mt-1 text-base font-bold text-slate-800 dark:text-slate-100">{getDutyRosterDisplayName(name)}</p>}
            </>
        );
    };
    const renderNextPerson = (name) => {
        const number = getDutyRosterEmployeeId(name);
        return (
            <>
                {number && <>{renderEmployeeNumber(number, 'font-black', 'h-4 w-4')} · </>}
                {getDutyRosterDisplayName(name)}
            </>
        );
    };
    const groups = [
        { label: t('duty_roster_women'), people: WOMEN_DUTY_ROSTER, currentIndex: roster.womenIndex, color: 'rose' },
        { label: t('duty_roster_men'), people: MEN_DUTY_ROSTER, currentIndex: roster.menIndex, color: 'sky' },
    ];

    return (
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border-t-4 border-emerald-500 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-white">
                        <span className="material-symbols-outlined text-2xl text-emerald-600">cleaning_services</span>
                        {t('duty_roster_title')}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{weekLabel}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                    <p className="text-sm font-black text-rose-700 dark:text-rose-300">{t('duty_roster_women')}</p>
                    {renderCurrentPerson(roster.current.women)}
                    <p className="mt-2 text-sm font-bold leading-snug text-slate-600 dark:text-slate-300">{t('duty_roster_next_week')}：{renderNextPerson(roster.next.women)}</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
                    <p className="text-sm font-black text-sky-700 dark:text-sky-300">{t('duty_roster_men')}</p>
                    {renderCurrentPerson(roster.current.men)}
                    <p className="mt-2 text-sm font-bold leading-snug text-slate-600 dark:text-slate-300">{t('duty_roster_next_week')}：{renderNextPerson(roster.next.men)}</p>
                </div>
            </div>

            <button
                type="button"
                aria-expanded={isExpanded}
                onClick={onToggle}
                className="min-h-16 w-full rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-black text-emerald-700 active:scale-[0.99] dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
                {isExpanded ? t('duty_roster_hide_full') : t('duty_roster_view_full')}
            </button>

            {isExpanded && (
                <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                    {groups.map(group => (
                        <div key={group.label}>
                            <h3 className="text-base font-black text-slate-800 dark:text-white">{group.label}</h3>
                            <ul className="mt-2 space-y-2">
                                {group.people.map((person, index) => {
                                    const isCurrent = index === group.currentIndex;
                                    const hasPassed = index < group.currentIndex;
                                    const employeeNumber = getDutyRosterEmployeeId(person);
                                    const tone = isCurrent
                                        ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-200'
                                        : hasPassed
                                            ? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                            : 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
                                    return (
                                        <li key={person} className={`flex min-h-14 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-base font-black ${tone}`}>
                                            <span className="flex min-w-0 items-center gap-2">
                                                {employeeNumber && renderEmployeeNumber(employeeNumber, 'w-16 shrink-0 text-lg font-black', 'h-5 w-5 shrink-0')}
                                                <span className="min-w-0 break-words">{getDutyRosterDisplayName(person)}</span>
                                            </span>
                                            {isCurrent && <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-1 text-xs text-white">{t('duty_roster_this_week')}</span>}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default function BattleReport() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);
    const [notices, setNotices] = useState([]);
    const [noticeError, setNoticeError] = useState(false);
    const [error, setError] = useState(null);
    const [isRosterExpanded, setIsRosterExpanded] = useState(false);
    const todayStr = getLocalDateString();
    const isPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'defects';

    useEffect(() => {
        window.scrollTo(0, 0);
        const controller = new AbortController();
        const load = async () => {
            try {
                setLoading(true);
                if (isPreview) {
                    setNotices([
                        { start_date: todayStr, end_date: null, content: '組裝前請確認卡扣完整。\n發現缺料請先隔離，並通知領班。', content_vi: 'Trước khi lắp ráp, hãy kiểm tra ngàm cài còn nguyên vẹn.\nNếu phát hiện thiếu liệu, hãy tách riêng sản phẩm và báo cho tổ trưởng.', content_id: 'Sebelum perakitan, periksa keutuhan kait pengunci.\nJika ditemukan bagian yang kurang bahan, pisahkan produk dan laporkan kepada kepala regu.' },
                        { start_date: todayStr, end_date: todayStr, content: '下班前請清潔工作桌，並將工具歸位。', content_vi: 'Trước khi tan ca, hãy vệ sinh bàn làm việc và cất dụng cụ đúng chỗ.', content_id: 'Sebelum pulang, bersihkan meja kerja dan kembalikan alat ke tempatnya.' },
                    ]);
                    setReport({ cumulativeTotal: 488221, todayGoodCount: 1240, todayRecordCount: 8, todayOperators: 5, avgEfficiency: 102, todayDefects: { missing: 6, deform: 3, appearance: 12, other: 2 } });
                    return;
                }
                const accessToken = await getTaskTimingAccessToken({ signal: controller.signal });
                const data = await fetchTaskTimingBattleReport({
                    accessToken,
                    today: todayStr,
                    signal: controller.signal,
                });
                setReport(data);
                try {
                    setNotices(await fetchTaskTimingNotices({ accessToken, today: todayStr, signal: controller.signal }));
                    setNoticeError(false);
                } catch (noticeFailure) {
                    if (noticeFailure.name !== 'AbortError') setNoticeError(true);
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    const needsLogin = /login|required|expired/i.test(e.message);
                    setError(needsLogin ? '請先返回首頁重新登入' : '資料讀取失敗：' + e.message);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        load();
        return () => controller.abort();
    }, [todayStr, isPreview]);

    const cumulativeTotal = report?.cumulativeTotal ?? 0;
    const todayGoodCount = report?.todayGoodCount ?? 0;
    const todayRecordCount = report?.todayRecordCount ?? 0;
    const todayOperators = report?.todayOperators ?? 0;
    const avgEfficiency = report?.avgEfficiency ?? 0;
    const defects = report?.todayDefects;
    const totalDefects = defects ? Object.values(defects).reduce((sum, count) => sum + count, 0) : null;

    // Language-aware number formatter
    const formatSmallNumber = (n) => {
        const lang = i18n.language;
        if (lang === 'zh') {
            if (n >= 10000) return `${(n / 10000).toFixed(1)}萬`;
            return n.toLocaleString();
        } else {
            if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
            if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
            return n.toLocaleString();
        }
    };

    // Milestone logic
    const nextMilestone = MILESTONES.find(m => m > cumulativeTotal) ?? MILESTONES[MILESTONES.length - 1];
    const prevMilestone = [...MILESTONES].reverse().find(m => m <= cumulativeTotal) ?? 0;
    const progressPct = nextMilestone > prevMilestone
        ? Math.min(100, ((cumulativeTotal - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
        : 100;

    let gaugeColor = '#ef4444';
    if (avgEfficiency >= 90) gaugeColor = '#f59e0b';
    if (avgEfficiency >= 100) gaugeColor = '#22c55e';
    if (avgEfficiency >= 110) gaugeColor = '#0d9488';
    const dutyRoster = getWeeklyDutyRoster();

    return (
        <div className="bg-background-light dark:bg-background-dark text-[#1e293b] dark:text-white min-h-screen flex flex-col pb-36">
            {/* Company Banner */}
            <div className="bg-slate-50 dark:bg-black text-slate-500 dark:text-slate-400 py-2 px-4 text-center font-bold text-[11px] border-b border-slate-200 dark:border-slate-800 z-[60] relative tracking-[0.3em] uppercase">
                {t('app_title')}
            </div>

            {/* Header */}
            <header className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b-2 border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="flex items-center gap-2 flex-1">
                    <span className="material-symbols-outlined text-3xl text-primary">campaign</span>
                    <div>
                        <h1 className="text-lg font-black leading-tight">{t('br_title')}</h1>
                        <p className="text-xs text-slate-400 font-medium">{todayStr.replace(/\//g, ' / ')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{t('br_live_indicator')}</span>
                </div>
            </header>

            <main className="p-4 space-y-4 flex-1">
                {isPreview && <p className="rounded-xl bg-amber-100 p-3 text-base font-bold text-amber-900">{t('br_defect_preview')}</p>}
                {notices.length > 0 && <section className="rounded-2xl border-t-4 border-amber-500 bg-white p-4 shadow-md dark:bg-slate-900">
                    <h2 className="flex items-center gap-2 text-lg font-black text-amber-700 dark:text-amber-300"><span className="material-symbols-outlined text-2xl" aria-hidden="true">sticky_note_2</span>{t('br_notice_title')}</h2>
                    <div className="mt-4 space-y-4">{notices.map((notice, index) => <article key={index} className="rounded-xl border border-amber-100 border-l-4 border-l-amber-400 bg-amber-50/70 px-4 py-5 dark:border-amber-900 dark:border-l-amber-500 dark:bg-amber-950/30">
                        <p className="whitespace-pre-wrap break-words text-lg font-bold leading-relaxed">{getTaskTimingNoticeContent(notice, i18n.language)}</p>
                    </article>)}</div>
                </section>}
                {noticeError && <p role="status" className="text-base text-slate-500">{t('br_notice_error')}</p>}
                <DutyRoster
                    t={t}
                    roster={dutyRoster}
                    isExpanded={isRosterExpanded}
                    onToggle={() => setIsRosterExpanded(value => !value)}
                />

            {loading ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 text-sm font-bold">{t('br_loading')}</p>
                </div>
            ) : error ? (
                <div className="m-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
                    <span className="material-symbols-outlined text-4xl text-danger mb-2 block">error_outline</span>
                    <p className="text-danger font-bold text-sm">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-transform"
                    >
                        {t('br_reload')}
                    </button>
                </div>
            ) : (
                <>

                    {/* === SECTION 2: Today's Efficiency === */}
                    <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border-t-4 border-blue-500 p-4 space-y-3">
                        <h2 className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-white">
                            <span className="material-symbols-outlined text-xl text-blue-500">speed</span>
                            {t('br_avg_efficiency')}
                        </h2>

                        <EfficiencyGauge value={avgEfficiency} />

                        <div className="text-center -mt-2">
                            <span className="text-4xl font-black" style={{ color: gaugeColor }}>
                                {todayRecordCount > 0 ? avgEfficiency.toFixed(1) : '--'}%
                            </span>
                            {todayRecordCount === 0 && (
                                <p className="text-xs text-slate-400 font-medium mt-1">{t('br_no_records')}</p>
                            )}
                        </div>

                        {/* 3 stat cards */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center">
                                <span className="material-symbols-outlined text-xl text-blue-500 block">groups</span>
                                <span className="text-sm font-black text-slate-800 dark:text-white">{todayOperators}人</span>
                                <span className="text-[10px] text-slate-400 block font-medium">{t('br_online_count')}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center">
                                <span className="material-symbols-outlined text-xl text-success block">inventory_2</span>
                                <span className="text-sm font-black text-slate-800 dark:text-white">{todayGoodCount.toLocaleString()}{t('br_unit_pcs')}</span>
                                <span className="text-[10px] text-slate-400 block font-medium">{t('br_total_output')}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center">
                                <span className="material-symbols-outlined text-xl text-amber-500 block">fact_check</span>
                                <span className="text-sm font-black text-slate-800 dark:text-white">{todayRecordCount}筆</span>
                                <span className="text-[10px] text-slate-400 block font-medium">{t('br_upload_count')}</span>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border-t-4 border-rose-500 p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-lg font-black flex items-center gap-2"><span className="material-symbols-outlined text-rose-500">report_problem</span>{t('br_defect_title')}</h2>
                            <div className="text-right"><p className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('br_defect_total')}</p><p className="text-3xl font-black text-rose-600 dark:text-rose-400">{totalDefects == null ? '—' : totalDefects.toLocaleString()} <span className="text-base">{t('br_defect_unit')}</span></p></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            {['missing', 'deform', 'appearance'].map(key => <div key={key} className="rounded-xl border border-rose-100 bg-rose-50 px-2 py-4 text-center dark:border-rose-900 dark:bg-rose-950/30"><p className="text-base font-bold text-slate-700 dark:text-slate-200">{t(`br_defect_${key}`)}</p><p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">{defects ? defects[key].toLocaleString() : '—'} <span className="text-sm">{t('br_defect_unit')}</span></p></div>)}
                        </div>
                        {defects?.other > 0 && <p className="rounded-xl bg-slate-50 p-3 text-base font-bold dark:bg-slate-800">{t('br_defect_other')}：{defects.other.toLocaleString()} {t('br_defect_unit')}</p>}
                        {(todayRecordCount === 0 || totalDefects === 0 || !defects) && <p className="text-base font-bold text-slate-500 dark:text-slate-400">{todayRecordCount === 0 ? t('br_no_records') : !defects ? t('br_defect_unavailable') : t('br_defect_none')}</p>}
                    </section>

                    {/* === SECTION 1: Cumulative Milestone === */}
                    <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border-t-4 border-primary p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-white">
                                    <span className="material-symbols-outlined text-xl text-primary">emoji_events</span>
                                    {t('br_total_achievement')}
                                </h2>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">{t('br_milestone_sub')}</p>
                            </div>
                            <div className="bg-primary/10 border border-primary/30 px-3 py-1 rounded-full">
                                <span className="text-primary font-black text-sm">{progressPct.toFixed(1)}%</span>
                            </div>
                        </div>

                        {/* Big count */}
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-primary leading-none">
                                {cumulativeTotal.toLocaleString()}
                            </span>
                            <span className="text-base font-bold text-slate-400">{t('br_unit_pcs')}</span>
                            <span className="text-xs text-slate-400 ml-auto font-medium">↗ {t('br_target_label')} {nextMilestone.toLocaleString()} {t('br_unit_pcs')}</span>
                        </div>

                        {/* Progress bar */}
                        <div className="relative h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-700"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>

                        {/* Milestone badges */}
                        <div className="flex gap-2 flex-wrap pt-1">
                            {MILESTONES.map(m => {
                                const done = cumulativeTotal >= m;
                                const isCurrent = m === nextMilestone;
                                return (
                                    <div key={m}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black border transition-all ${done
                                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-600 dark:text-yellow-400'
                                            : isCurrent
                                                ? 'bg-primary/10 border-primary/30 text-primary'
                                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                                            }`}>
                                        {done
                                            ? <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                            : isCurrent
                                                ? <span className="material-symbols-outlined text-[13px] animate-pulse">radio_button_unchecked</span>
                                                : <span className="material-symbols-outlined text-[13px]">lock</span>
                                        }
                                        {formatSmallNumber(m)}
                                    </div>
                                );
                            })}
                        </div>
                    </section>


                </>
            )}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-6 pt-2 px-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-around max-w-lg mx-auto">
                    <button
                        onClick={() => navigate('/')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-2xl">home</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('home_tab')}</span>
                    </button>
                    <button
                        onClick={() => navigate('/', { state: { openHistory: true } })}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-2xl">history</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('history_tab')}</span>
                    </button>
                    <button className="flex flex-col items-center gap-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                            <span className="material-symbols-outlined text-2xl">campaign</span>
                        </div>
                        <span className="text-xs font-bold text-primary">{t('battle_report_tab')}</span>
                    </button>
                    <button
                        onClick={() => navigate('/', { state: { openSettings: true } })}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-2xl">settings</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('settings_tab')}</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}
