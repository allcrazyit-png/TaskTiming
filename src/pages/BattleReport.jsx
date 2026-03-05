import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Same URL as Home.jsx
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHcmD5yIdsLeDjE9b3O5zTW-Uygh_RdM6LdFG4gRdgqawouUNQJeq-La8zUJbltpHHYA/exec";

const MILESTONES = [10000, 50000, 100000, 500000, 1000000];

function formatNumber(n) {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}萬`;
    return n.toLocaleString();
}

function parseTotalSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
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

export default function BattleReport() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        const load = async () => {
            try {
                setLoading(true);
                // 戰報讀「組裝紀錄表」，GAS 內部知道要去哪裡讀，前端不需要知道 ID
                const sheetParam = encodeURIComponent('紀錄');
                const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=records&sheet=${sheetParam}`);

                if (!res.ok) throw new Error('HTTP error ' + res.status);
                let data = await res.json();
                console.log('[BattleReport] Raw data from Records sheet:', data);

                if (!Array.isArray(data)) {
                    console.warn('[BattleReport] Sheet name "紀錄" not found, trying index=0...');
                    const res2 = await fetch(`${GOOGLE_SCRIPT_URL}?action=records&index=0`);
                    data = await res2.json();
                }

                if (Array.isArray(data)) {
                    setRecords(data);
                } else {
                    setError('無法讀取紀錄，請確認組裝紀錄表中有「紀錄」分頁');
                }
            } catch (e) {
                setError('資料讀取失敗：' + e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Cumulative total across ALL records
    const cumulativeTotal = records.reduce((sum, r) => {
        return sum + (parseInt(r['良品數量'] ?? 0) || 0);
    }, 0);

    // Today's date in TWN timezone (UTC+8)
    // GAS stores dates as ISO UTC, e.g. "2026-03-05T16:00:00.000Z" = 2026-03-06 00:00 TWN
    // We compare by parsing the date from sheet and converting to local date
    const todayStr = (() => {
        const now = new Date();
        // Use local date string in YYYY-MM-DD format for comparison
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();

    const todayRecords = records.filter(r => {
        const raw = String(r['日期'] ?? '');
        if (!raw) return false;
        // Parse the date from sheet (ISO or any format) and compare as local date
        const d = new Date(raw);
        const localStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return localStr === todayStr;
    });

    const todayGoodCount = todayRecords.reduce((s, r) => s + (parseInt(r['良品數量'] ?? 0) || 0), 0);

    // 效率計算：用試算表已計算好的「效率值」欄位 (ratio, e.g. 1.188 = 118.8%)
    // 加權平均：依良品數量×標準秒加權，避免短工單過度影響結果
    let earnedTotal = 0, actualTotal = 0;
    todayRecords.forEach(r => {
        const gc = parseInt(r['良品數量'] ?? 0) || 0;
        const st = parseFloat(r['標準組裝秒數'] ?? 0) || 0;
        const eff = parseFloat(r['效率值'] ?? 0) || 0;
        // 只計入有設定標準秒數、且效率值有效的紀錄
        if (st > 0 && eff > 0 && gc > 0) {
            earnedTotal += gc * st;           // 標準應花秒數
            actualTotal += (gc * st) / eff;  // 實際花秒數 = 應花 / 效率
        }
    });
    const avgEfficiency = actualTotal > 0 ? (earnedTotal / actualTotal) * 100 : 0;

    const todayOperators = new Set(todayRecords.map(r => r['作業者'] ?? '')).size;

    // Milestone logic
    const nextMilestone = MILESTONES.find(m => m > cumulativeTotal) ?? MILESTONES[MILESTONES.length - 1];
    const prevMilestone = [...MILESTONES].reverse().find(m => m <= cumulativeTotal) ?? 0;
    const progressPct = nextMilestone > prevMilestone
        ? Math.min(100, ((cumulativeTotal - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
        : 100;

    // Live feed - last 20 records with a name
    const liveFeed = [...records]
        .filter(r => r['作業者'])
        .slice(-30)
        .reverse()
        .slice(0, 15);

    const avatarColors = ['bg-primary', 'bg-blue-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500'];

    let gaugeColor = '#ef4444';
    if (avgEfficiency >= 90) gaugeColor = '#f59e0b';
    if (avgEfficiency >= 100) gaugeColor = '#22c55e';
    if (avgEfficiency >= 110) gaugeColor = '#0d9488';

    return (
        <div className="bg-background-light dark:bg-background-dark text-[#1e293b] dark:text-white min-h-screen flex flex-col pb-36">
            {/* Company Banner */}
            <div className="bg-slate-50 dark:bg-black text-slate-500 dark:text-slate-400 py-2 px-4 text-center font-bold text-[11px] border-b border-slate-200 dark:border-slate-800 z-[60] relative tracking-[0.3em] uppercase">
                瑞全企業股份有限公司
            </div>

            {/* Header */}
            <header className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b-2 border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="flex items-center gap-2 flex-1">
                    <span className="material-symbols-outlined text-3xl text-primary">bar_chart</span>
                    <div>
                        <h1 className="text-lg font-black leading-tight">今日戰報</h1>
                        <p className="text-xs text-slate-400 font-medium">{todayStr.replace(/\//g, ' / ')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">即時</span>
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 text-sm font-bold">正在載入戰報資料⋯</p>
                </div>
            ) : error ? (
                <div className="m-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
                    <span className="material-symbols-outlined text-4xl text-danger mb-2 block">error_outline</span>
                    <p className="text-danger font-bold text-sm">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-transform"
                    >
                        重新載入
                    </button>
                </div>
            ) : (
                <main className="p-4 space-y-4 flex-1">

                    {/* === SECTION 1: Cumulative Milestone === */}
                    <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border-t-4 border-primary p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-white">
                                    <span className="material-symbols-outlined text-xl text-primary">emoji_events</span>
                                    全廠累計成就
                                </h2>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">共同達成里程碑</p>
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
                            <span className="text-base font-bold text-slate-400">件</span>
                            <span className="text-xs text-slate-400 ml-auto font-medium">↗ 目標 {nextMilestone.toLocaleString()} 件</span>
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
                                        {formatNumber(m)}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* === SECTION 2: Today's Efficiency === */}
                    <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border-t-4 border-blue-500 p-4 space-y-3">
                        <h2 className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-white">
                            <span className="material-symbols-outlined text-xl text-blue-500">speed</span>
                            今日平均效率
                        </h2>

                        <EfficiencyGauge value={avgEfficiency} />

                        <div className="text-center -mt-2">
                            <span className="text-4xl font-black" style={{ color: gaugeColor }}>
                                {todayRecords.length > 0 ? avgEfficiency.toFixed(1) : '--'}%
                            </span>
                            {todayRecords.length === 0 && (
                                <p className="text-xs text-slate-400 font-medium mt-1">今日尚無上傳紀錄</p>
                            )}
                        </div>

                        {/* 3 stat cards */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center">
                                <span className="material-symbols-outlined text-xl text-blue-500 block">groups</span>
                                <span className="text-sm font-black text-slate-800 dark:text-white">{todayOperators}人</span>
                                <span className="text-[10px] text-slate-400 block font-medium">今日在線</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center">
                                <span className="material-symbols-outlined text-xl text-success block">inventory_2</span>
                                <span className="text-sm font-black text-slate-800 dark:text-white">{todayGoodCount.toLocaleString()}件</span>
                                <span className="text-[10px] text-slate-400 block font-medium">今日產出</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center">
                                <span className="material-symbols-outlined text-xl text-amber-500 block">fact_check</span>
                                <span className="text-sm font-black text-slate-800 dark:text-white">{todayRecords.length}筆</span>
                                <span className="text-[10px] text-slate-400 block font-medium">上傳紀錄</span>
                            </div>
                        </div>
                    </section>

                    {/* === SECTION 3: Live Feed === */}
                    <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border-t-4 border-amber-500 p-4 space-y-3">
                        <h2 className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-white">
                            <span className="material-symbols-outlined text-xl text-amber-500">bolt</span>
                            最新捷報
                        </h2>

                        {liveFeed.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2 block">pending</span>
                                <p className="text-slate-400 font-bold">目前尚無紀錄</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {liveFeed.map((r, i) => {
                                    const gc = parseInt(r['良品數量'] ?? 0) || 0;
                                    const opRaw = String(r['作業者'] ?? '');
                                    const opName = opRaw.replace(/\[.*?\]/g, "").trim();
                                    const isToday = todayRecords.some(tr => tr === r);

                                    return (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-xs ${avatarColors[i % avatarColors.length]}`}>
                                                {opName.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-black text-slate-800 dark:text-white truncate">{opName}</p>
                                                    {isToday && (
                                                        <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-md font-black">今日</span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-400 font-medium truncate">{r['品番']} / {r['產品中文名稱']}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-primary">+{gc.toLocaleString()}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">良品</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </main>
            )}

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
                            <span className="material-symbols-outlined text-2xl">bar_chart</span>
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
