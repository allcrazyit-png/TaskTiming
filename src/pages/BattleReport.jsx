import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyBm_UUlYpY0kX8I-kNlf32bBpJyJNj8U24j_B_Xb_9yBW1mWHGPqNGHN7u_r8MiivVQ/exec';

// Milestones in pieces
const MILESTONES = [100000, 500000, 1000000, 5000000];

function getNextMilestone(total) {
    return MILESTONES.find(m => m > total) || MILESTONES[MILESTONES.length - 1];
}

function getPreviousMilestone(total) {
    const reversed = [...MILESTONES].reverse();
    return reversed.find(m => m <= total) || 0;
}

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

// Efficiency gauge needle SVG
function EfficiencyGauge({ value }) {
    // value is 0-150 (%)
    const clampedValue = Math.min(150, Math.max(0, value));
    // Map 0-150% -> -90deg to +90deg (180deg arc)
    const angle = (clampedValue / 150) * 180 - 90;
    const radians = (angle * Math.PI) / 180;
    const needleLength = 68;
    const cx = 90, cy = 90;
    const needleX = cx + needleLength * Math.cos(radians);
    const needleY = cy + needleLength * Math.sin(radians);

    let color = '#ef4444'; // red
    if (value >= 90) color = '#eab308'; // yellow
    if (value >= 100) color = '#22c55e'; // green
    if (value >= 110) color = '#06d6a0'; // teal glow

    return (
        <svg viewBox="0 0 180 100" className="w-56 max-w-full mx-auto">
            <defs>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="80%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#06d6a0" />
                </linearGradient>
            </defs>
            {/* BG arc */}
            <path d="M 10 90 A 80 80 0 0 1 170 90" fill="none" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
            {/* Colored arc */}
            <path d="M 10 90 A 80 80 0 0 1 170 90" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" />
            {/* Needle */}
            <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth="3" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="5" fill={color} />
        </svg>
    );
}

export default function BattleReport() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState([]);
    const [error, setError] = useState(null);
    const feedRef = useRef(null);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${GAS_URL}?sheet=紀錄`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setRecords(data);
                } else {
                    setError('無法讀取資料');
                }
            } catch (e) {
                setError('網路錯誤，請稍後再試');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Computed values
    const cumulativeTotal = records.reduce((sum, r) => {
        const count = parseInt(r['良品數量'] ?? r['goodCount'] ?? 0) || 0;
        return sum + count;
    }, 0);

    const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    const todayStr = (() => {
        const now = new Date();
        return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    })();

    const todayRecords = records.filter(r => {
        const d = r['日期'] ?? '';
        return typeof d === 'string' ? d.startsWith(todayStr) : false;
    });

    const todayGoodCount = todayRecords.reduce((s, r) => s + (parseInt(r['良品數量'] ?? 0) || 0), 0);

    // Efficiency = Σ(goodCount * standardTime) / Σ(totalSeconds) * 100
    let totalEarnedSeconds = 0, totalActualSeconds = 0;
    todayRecords.forEach(r => {
        const gc = parseInt(r['良品數量'] ?? 0) || 0;
        const st = parseFloat(r['標準組裝秒數'] ?? r['standardTime'] ?? 0) || 0;
        const ts = parseTotalSeconds(r['總時間'] ?? r['totalTime'] ?? '');
        totalEarnedSeconds += gc * st;
        totalActualSeconds += ts;
    });
    const avgEfficiency = totalActualSeconds > 0 ? (totalEarnedSeconds / totalActualSeconds) * 100 : 0;

    const nextMilestone = getNextMilestone(cumulativeTotal);
    const prevMilestone = getPreviousMilestone(cumulativeTotal);
    const progressPct = nextMilestone > prevMilestone
        ? ((cumulativeTotal - prevMilestone) / (nextMilestone - prevMilestone)) * 100
        : 100;

    // Unique online operators today
    const todayOperators = new Set(todayRecords.map(r => r['作業者'] ?? '')).size;

    // Live feed - latest 20 records sorted by date desc
    const liveFeed = [...records]
        .filter(r => r['作業者'] && (parseInt(r['良品數量'] ?? 0) || 0) > 0)
        .slice(-30)
        .reverse()
        .slice(0, 20);

    // Milestone done list
    const doneMilestones = MILESTONES.filter(m => m <= cumulativeTotal);
    const pendingMilestones = MILESTONES.filter(m => m > cumulativeTotal);

    let gaugeColor = '#ef4444';
    if (avgEfficiency >= 90) gaugeColor = '#eab308';
    if (avgEfficiency >= 100) gaugeColor = '#22c55e';
    if (avgEfficiency >= 110) gaugeColor = '#06d6a0';

    return (
        <div className="min-h-screen bg-[#0f172a] text-white pb-24 select-none">
            {/* Company Banner */}
            <div className="bg-black text-slate-500 py-1.5 px-4 text-center font-bold text-[11px] border-b border-slate-800 tracking-[0.3em] uppercase">
                瑞全企業股份有限公司
            </div>

            {/* Header */}
            <header className="px-4 pt-5 pb-3 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white">今日戰報</h1>
                    <p className="text-xs text-slate-400 mt-0.5">{todayStr.replace(/\//g, ' / ')}</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="text-xs font-bold text-emerald-400">即時</span>
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm font-bold">正在載入戰報資料⋯</p>
                </div>
            ) : error ? (
                <div className="mx-4 mt-10 bg-red-900/30 border border-red-700 rounded-2xl p-6 text-center">
                    <span className="material-symbols-outlined text-4xl text-red-400 mb-2 block">error</span>
                    <p className="text-red-300 font-bold">{error}</p>
                </div>
            ) : (
                <main className="px-4 space-y-4">

                    {/* === SECTION 1: Cumulative Milestone Progress === */}
                    <section className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">全廠累計成就</h2>
                                <p className="text-[11px] text-slate-500 mt-0.5">共同達成里程碑</p>
                            </div>
                            <div className="bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 rounded-full">
                                <span className="text-emerald-400 font-black text-sm">{progressPct.toFixed(1)}%</span>
                            </div>
                        </div>

                        {/* Big number */}
                        <div className="mb-3">
                            <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 leading-none">
                                {cumulativeTotal.toLocaleString()}
                            </span>
                            <span className="text-sm text-slate-400 ml-2 font-bold">件</span>
                        </div>

                        {/* Progress bar */}
                        <div className="relative h-4 bg-slate-700/60 rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${Math.min(100, progressPct)}%`,
                                    background: 'linear-gradient(90deg, #06b6d4, #22c55e)',
                                    boxShadow: '0 0 12px rgba(34, 197, 94, 0.5)'
                                }}
                            />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 font-bold mb-3">
                            <span>{formatNumber(prevMilestone)}</span>
                            <span>下一個目標：{nextMilestone.toLocaleString()} 件</span>
                        </div>

                        {/* Milestone badges */}
                        <div className="flex gap-2 flex-wrap">
                            {MILESTONES.map(m => {
                                const done = cumulativeTotal >= m;
                                const isCurrent = m === nextMilestone;
                                return (
                                    <div key={m}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black border transition-all ${done
                                                ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                                                : isCurrent
                                                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-400'
                                                    : 'bg-slate-800 border-slate-700 text-slate-500'
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

                    {/* === SECTION 2: Today's Efficiency Gauge === */}
                    <section className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-4 shadow-lg">
                        <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-1">今日平均效率</h2>
                        <p className="text-[11px] text-slate-500 mb-3">全廠今日綜合效率值</p>

                        <EfficiencyGauge value={avgEfficiency} />

                        <div className="text-center -mt-2 mb-3">
                            <span className="text-4xl font-black" style={{ color: gaugeColor }}>
                                {avgEfficiency.toFixed(1)}%
                            </span>
                        </div>

                        {/* 3 stat pills */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-2 text-center">
                                <span className="material-symbols-outlined text-lg text-blue-400 block">groups</span>
                                <span className="text-xs font-black text-slate-200">{todayOperators}人</span>
                                <span className="text-[10px] text-slate-500 block">今日在線</span>
                            </div>
                            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-2 text-center">
                                <span className="material-symbols-outlined text-lg text-emerald-400 block">inventory_2</span>
                                <span className="text-xs font-black text-slate-200">{todayGoodCount.toLocaleString()}件</span>
                                <span className="text-[10px] text-slate-500 block">今日產出</span>
                            </div>
                            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-2 text-center">
                                <span className="material-symbols-outlined text-lg text-yellow-400 block">fact_check</span>
                                <span className="text-xs font-black text-slate-200">{todayRecords.length}筆</span>
                                <span className="text-[10px] text-slate-500 block">上傳紀錄</span>
                            </div>
                        </div>
                    </section>

                    {/* === SECTION 3: Live Feed === */}
                    <section className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-yellow-400 text-xl">bolt</span>
                            <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">最新捷報</h2>
                        </div>

                        {liveFeed.length === 0 ? (
                            <div className="text-center py-6 text-slate-500 text-sm font-bold">
                                <span className="material-symbols-outlined text-3xl block mb-2 opacity-40">inbox</span>
                                今日尚無生產紀錄
                            </div>
                        ) : (
                            <div ref={feedRef} className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                {liveFeed.map((r, i) => {
                                    const name = r['作業者'] ?? '未知';
                                    const product = r['產品中文名稱'] ?? r['品番'] ?? '未知產品';
                                    const count = parseInt(r['良品數量'] ?? 0) || 0;
                                    const dateStr = r['日期'] ?? '';
                                    const initial = (name.match(/[\u4e00-\u9fa5]/) ?? [name[0]])[0] ?? '?';
                                    const colors = ['bg-teal-500', 'bg-blue-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500'];
                                    const colorClass = colors[name.charCodeAt(0) % colors.length];
                                    return (
                                        <div key={i} className="flex items-center gap-3 bg-slate-900/50 rounded-xl p-2.5 border border-slate-700/30">
                                            <div className={`w-9 h-9 rounded-full ${colorClass} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>
                                                {initial}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">
                                                    {name} <span className="text-slate-400 font-normal">完成了</span>
                                                    {' '}<span className="text-emerald-400 font-black">{count}件</span>
                                                </p>
                                                <p className="text-[11px] text-teal-400/80 font-medium truncate mt-0.5">
                                                    {product}
                                                </p>
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex-shrink-0 text-right">
                                                {dateStr ? dateStr.slice(5) : ''}
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
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a]/95 backdrop-blur border-t border-slate-800 pb-6 pt-2 px-4 shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
                <div className="flex items-center justify-around max-w-lg mx-auto">
                    <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 group active:scale-95 transition-transform">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 bg-slate-800 border border-slate-700">
                            <span className="material-symbols-outlined text-2xl">home</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500">首頁</span>
                    </button>
                    <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 group active:scale-95 transition-transform">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 bg-slate-800 border border-slate-700">
                            <span className="material-symbols-outlined text-2xl">history</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500">歷史</span>
                    </button>
                    <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white border border-emerald-500"
                            style={{ background: 'linear-gradient(135deg, #059669, #0d9488)', boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)' }}>
                            <span className="material-symbols-outlined text-2xl">bar_chart</span>
                        </div>
                        <span className="text-xs font-black text-emerald-400">戰報</span>
                    </button>
                    <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 group active:scale-95 transition-transform">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 bg-slate-800 border border-slate-700">
                            <span className="material-symbols-outlined text-2xl">settings</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500">設定</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}
