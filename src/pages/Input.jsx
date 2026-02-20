import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Input() {
    const navigate = useNavigate();
    const location = useLocation();
    // Default values for testing
    const { productName, partNumber, carModel, standardTime, operator } = location.state || {
        productName: "鋁合金散熱片 A-204",
        partNumber: "SAMPLE-001",
        carModel: "SAMPLE-CAR",
        standardTime: 0,
        operator: "[001] 王大明"
    };

    // Check if the part number matches the dual-cavity pattern (e.g., has _X before a dash, like 53827_8-02280-1, or CW785401_2XA)
    const originalIsDual = partNumber && /_(\d+)/.test(partNumber);
    const [activeMode, setActiveMode] = useState('both'); // 'both', 'r', 'l'

    // Derive single part numbers if needed
    const { partR, partL } = React.useMemo(() => {
        let pR = partNumber + "-R";
        let pL = partNumber + "-L";
        if (originalIsDual) {
            const match = partNumber.match(/^(.*?)_(\d+)(.*)$/);
            if (match) {
                const prefixBase = match[1];
                const suffix = match[3] || "";
                const prefixMatch = prefixBase.match(/^(.*?)(\d+)$/);
                if (prefixMatch) {
                    const baseStr = prefixMatch[1];
                    const numRStr = prefixMatch[2];
                    const numR = parseInt(numRStr, 10);
                    const numL = numR + 1;
                    pR = `${baseStr}${numR}${suffix}`;
                    pL = `${baseStr}${numL}${suffix}`;
                }
            }
        }
        return { partR: pR, partL: pL };
    }, [partNumber, originalIsDual]);

    const isDual = originalIsDual && activeMode === 'both';

    // Compute display names
    const displayProductName = activeMode === 'both' ? productName : activeMode === 'r' ? `${productName} (R邊)` : `${productName} (L邊)`;
    const displayPartNumber = activeMode === 'both' ? partNumber : activeMode === 'r' ? partR : partL;

    const [goodCount, setGoodCount] = useState(128);
    const [goodCountR, setGoodCountR] = useState(0);
    const [goodCountL, setGoodCountL] = useState(0);
    const [scraps, setScraps] = useState({
        missing: 0,
        damage: 0,
        appearance: 0,
        others: 0
    });

    // Time state
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [remarks, setRemarks] = useState("");

    // Initialize start time on mount
    useEffect(() => {
        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5); // HH:MM
        setStartTime(timeString);
        setEndTime(timeString); // Default end time to now as well
    }, []);

    const getCurrentTime = () => {
        return new Date().toTimeString().slice(0, 5);
    };

    // Calculate total scrap
    const totalScrap = Object.values(scraps).reduce((a, b) => a + b, 0);

    const handleScrapChange = (type, delta) => {
        setScraps(prev => ({
            ...prev,
            [type]: Math.max(0, prev[type] + delta)
        }));
    };

    const calculateDuration = (start, end) => {
        if (!start || !end) return "";
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        let diffMins = (endH * 60 + endM) - (startH * 60 + startM);
        if (diffMins < 0) diffMins += 24 * 60; // Handle overnight
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}小時${mins}分`;
    };

    const handleConfirm = () => {
        const totalTime = calculateDuration(startTime, endTime);

        navigate('/confirm', {
            state: {
                productName: displayProductName,
                partNumber: displayPartNumber,
                carModel,
                standardTime,
                operator,
                goodCount: isDual ? goodCountR + goodCountL : goodCount,
                goodCountR,
                goodCountL,
                isDual,
                totalScrap,
                scraps,
                startTime,
                endTime,
                totalTime,
                remarks
            }
        });
    };


    return (
        <div className="bg-background-light dark:bg-background-dark text-[#1e293b] dark:text-white min-h-screen flex flex-col pb-40">
            <div className="bg-corporate text-white py-2 px-4 text-center font-bold text-base shadow-lg z-30">
                瑞全企業股份有限公司
            </div>
            <div className="bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between z-20">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-primary">account_circle</span>
                    <div className="text-sm font-extrabold text-slate-800 dark:text-white">
                        作業者: <span className="text-primary">{operator}</span>
                    </div>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-sm font-bold text-slate-500">
                    早班
                </div>
            </div>
            <header className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b-2 border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center justify-center p-2 rounded-xl active:bg-slate-200 dark:active:bg-slate-700 transition-colors mr-2"
                >
                    <span className="material-symbols-outlined text-3xl font-black">arrow_back</span>
                </button>
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative">
                        <img alt="Product Image" className="w-[60px] h-[60px] rounded-xl border-2 border-primary object-cover shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC26HTULzZRNyK3aPJ85gkDbFl8fPJB61fnfsLFyZRrNHHPdXr-IL_yifmeiWvfV3ScKuapkpICys8PsiVmcL0eiwsGUCzPPsSZ-b6wovZ0j8nDNARKJ8931OOxp7aM7wAq7vfI1odbZHquiuyGs_R0KsaAoCvwqrP5MPr9j1YrOptsixABvY4_NCkFxq8g0MMrMVIjE3cHIXOU6oxnFKvMAcNXZ_rbSNbmQ_A9_kpSbZmcA6BzuhiRSwvrBgP6f_W2i9UK_GVksRw" />
                        <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold">產品照</div>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-black leading-tight">作業內容回報</h1>
                        <div className="mt-1">
                            <span className="product-name-badge">產品: {displayProductName}</span>
                            <span className="block text-xs font-bold text-slate-500 mt-0.5">品番: {displayPartNumber}</span>
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 space-y-6">
                {originalIsDual && (
                    <section className="space-y-3">
                        <h2 className="text-lg font-black flex items-center gap-2 px-1 text-slate-700 dark:text-slate-300">
                            <span className="material-symbols-outlined text-2xl">rule</span>
                            選擇作業模式
                        </h2>
                        <div className="bg-slate-100 dark:bg-slate-900 p-2 rounded-2xl flex gap-1 border-2 border-slate-200 dark:border-slate-800 shadow-sm">
                            <button
                                onClick={() => setActiveMode('both')}
                                className={`flex-1 py-3 px-2 rounded-xl text-sm font-black transition-all ${activeMode === 'both' ? 'bg-primary text-white shadow-md scale-100' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 scale-95'}`}
                            >
                                左右同時做
                            </button>
                            <button
                                onClick={() => setActiveMode('r')}
                                className={`flex-1 py-3 px-2 rounded-xl text-sm font-black transition-all ${activeMode === 'r' ? 'bg-blue-600 text-white shadow-md scale-100' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 scale-95'}`}
                            >
                                單做 R 邊
                            </button>
                            <button
                                onClick={() => setActiveMode('l')}
                                className={`flex-1 py-3 px-2 rounded-xl text-sm font-black transition-all ${activeMode === 'l' ? 'bg-purple-600 text-white shadow-md scale-100' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 scale-95'}`}
                            >
                                單做 L 邊
                            </button>
                        </div>
                    </section>
                )}

                <section className="space-y-3">
                    <h2 className="text-lg font-black flex items-center gap-2 px-1 text-primary">
                        <span className="material-symbols-outlined text-2xl">schedule</span>
                        作業時間
                    </h2>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border-t-4 border-primary space-y-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-black text-slate-500">開始時間</label>
                            <div className="flex items-center gap-2">
                                <input
                                    className="time-input"
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                                <button
                                    onClick={() => setStartTime(getCurrentTime())}
                                    className="flex-shrink-0 bg-primary text-white h-full px-4 py-2 rounded-xl font-bold text-sm active:scale-95 transition-transform border-b-2 border-blue-800 shadow-sm"
                                >
                                    填入現在時間
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-black text-slate-500">結束時間</label>
                            <div className="flex items-center gap-2">
                                <input
                                    className="time-input"
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                                <button
                                    onClick={() => setEndTime(getCurrentTime())}
                                    className="flex-shrink-0 bg-primary text-white h-full px-4 py-2 rounded-xl font-bold text-sm active:scale-95 transition-transform border-b-2 border-blue-800 shadow-sm"
                                >
                                    填入現在時間
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
                <section className="space-y-3">
                    <h2 className="text-lg font-black flex items-center gap-2 px-1 text-success">
                        <span className="material-symbols-outlined text-2xl">check_circle</span>
                        良品產量 (合格) {isDual && <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-full ml-2">左右雙穴模式</span>}
                    </h2>

                    {!isDual && (
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border-t-4 border-success">
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    onClick={() => setGoodCount(Math.max(0, goodCount - 1))}
                                    className="w-[50px] h-[50px] rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90 transition-transform border-2 border-slate-300 dark:border-slate-700"
                                >
                                    <span className="material-symbols-outlined text-3xl font-black text-slate-600 dark:text-slate-300">remove</span>
                                </button>
                                <div className="flex-1 text-center">
                                    <input
                                        className="counter-input text-success focus:outline-none"
                                        type="number"
                                        value={goodCount}
                                        onChange={(e) => setGoodCount(parseInt(e.target.value) || 0)}
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                    />
                                    <p className="text-xs font-black text-slate-400 mt-0 tracking-widest uppercase">Pcs</p>
                                </div>
                                <button
                                    onClick={() => setGoodCount(goodCount + 1)}
                                    className="w-[50px] h-[50px] rounded-xl bg-success text-white flex items-center justify-center active:scale-90 transition-transform border-2 border-success shadow-md"
                                >
                                    <span className="material-symbols-outlined text-3xl font-black">add</span>
                                </button>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <button onClick={() => setGoodCount(goodCount + 10)} className="huge-btn bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200">+ 10</button>
                                <button onClick={() => setGoodCount(goodCount + 50)} className="huge-btn bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200">+ 50</button>
                            </div>
                        </div>
                    )}

                    {isDual && (
                        <div className="space-y-4">
                            {/* R Side */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border-t-4 border-success border-l-4 border-l-blue-500 relative">
                                <div className="absolute top-0 right-0 bg-blue-500 text-white font-black px-3 py-1 rounded-bl-xl rounded-tr-xl text-sm shadow-sm">R 邊</div>
                                <div className="flex items-center justify-between gap-3 pt-2">
                                    <button
                                        onClick={() => setGoodCountR(Math.max(0, goodCountR - 1))}
                                        className="w-[45px] h-[45px] rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90 transition-transform border-2 border-slate-300 dark:border-slate-700"
                                    >
                                        <span className="material-symbols-outlined text-2xl font-black text-slate-600 dark:text-slate-300">remove</span>
                                    </button>
                                    <div className="flex-1 text-center">
                                        <input
                                            className="counter-input text-blue-600 focus:outline-none"
                                            type="number"
                                            value={goodCountR}
                                            onChange={(e) => setGoodCountR(parseInt(e.target.value) || 0)}
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                        />
                                        <p className="text-xs font-black text-slate-400 mt-0 tracking-widest uppercase">Pcs</p>
                                    </div>
                                    <button
                                        onClick={() => setGoodCountR(goodCountR + 1)}
                                        className="w-[45px] h-[45px] rounded-xl bg-blue-500 text-white flex items-center justify-center active:scale-90 transition-transform border-2 border-blue-600 shadow-md"
                                    >
                                        <span className="material-symbols-outlined text-2xl font-black">add</span>
                                    </button>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <button onClick={() => setGoodCountR(goodCountR + 10)} className="py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200 font-bold text-slate-700 dark:text-slate-300">+ 10</button>
                                    <button onClick={() => setGoodCountR(goodCountR + 50)} className="py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200 font-bold text-slate-700 dark:text-slate-300">+ 50</button>
                                </div>
                            </div>

                            {/* L Side */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border-t-4 border-success border-l-4 border-l-purple-500 relative">
                                <div className="absolute top-0 right-0 bg-purple-500 text-white font-black px-3 py-1 rounded-bl-xl rounded-tr-xl text-sm shadow-sm">L 邊</div>
                                <div className="flex items-center justify-between gap-3 pt-2">
                                    <button
                                        onClick={() => setGoodCountL(Math.max(0, goodCountL - 1))}
                                        className="w-[45px] h-[45px] rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90 transition-transform border-2 border-slate-300 dark:border-slate-700"
                                    >
                                        <span className="material-symbols-outlined text-2xl font-black text-slate-600 dark:text-slate-300">remove</span>
                                    </button>
                                    <div className="flex-1 text-center">
                                        <input
                                            className="counter-input text-purple-600 focus:outline-none"
                                            type="number"
                                            value={goodCountL}
                                            onChange={(e) => setGoodCountL(parseInt(e.target.value) || 0)}
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                        />
                                        <p className="text-xs font-black text-slate-400 mt-0 tracking-widest uppercase">Pcs</p>
                                    </div>
                                    <button
                                        onClick={() => setGoodCountL(goodCountL + 1)}
                                        className="w-[45px] h-[45px] rounded-xl bg-purple-500 text-white flex items-center justify-center active:scale-90 transition-transform border-2 border-purple-600 shadow-md"
                                    >
                                        <span className="material-symbols-outlined text-2xl font-black">add</span>
                                    </button>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <button onClick={() => setGoodCountL(goodCountL + 10)} className="py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200 font-bold text-slate-700 dark:text-slate-300">+ 10</button>
                                    <button onClick={() => setGoodCountL(goodCountL + 50)} className="py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200 font-bold text-slate-700 dark:text-slate-300">+ 50</button>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
                <section className="space-y-3">
                    <h2 className="text-lg font-black flex items-center gap-2 px-1 text-danger">
                        <span className="material-symbols-outlined text-2xl">cancel</span>
                        不良品報廢 (原因分類)
                    </h2>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border-t-4 border-danger">
                        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-200 dark:border-red-800 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-black text-danger uppercase tracking-wider">總不良數量</p>
                                <p className="text-xs text-slate-500 font-bold">Total Scrap</p>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-danger">{totalScrap}</span>
                                <span className="text-base font-bold text-danger/60">Pcs</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {/* 1. Missing Material */}
                            <div className="scrap-row">
                                <div className="flex-1">
                                    <p className="text-base font-black text-orange-600">1. 缺料</p>
                                    <p className="text-xs font-bold text-slate-400">Missing Mat.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleScrapChange('missing', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                    </button>
                                    <input className="reason-input text-orange-600" inputMode="numeric" type="number" value={scraps.missing} readOnly />
                                    <button onClick={() => handleScrapChange('missing', 1)} className="circle-btn bg-orange-500 text-white">
                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                    </button>
                                </div>
                            </div>

                            {/* 2. Dent/Scratch */}
                            <div className="scrap-row">
                                <div className="flex-1">
                                    <p className="text-base font-black text-blue-600">2. 撞(刮)傷</p>
                                    <p className="text-xs font-bold text-slate-400">Dent / Scratch</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleScrapChange('damage', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                    </button>
                                    <input className="reason-input text-blue-600" inputMode="numeric" type="number" value={scraps.damage} readOnly />
                                    <button onClick={() => handleScrapChange('damage', 1)} className="circle-btn bg-blue-500 text-white">
                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                    </button>
                                </div>
                            </div>

                            {/* 3. Appearance Defect */}
                            <div className="scrap-row">
                                <div className="flex-1">
                                    <p className="text-base font-black text-purple-600">3. 外觀不良</p>
                                    <p className="text-xs font-bold text-slate-400">(無法修噴)</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleScrapChange('appearance', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                    </button>
                                    <input className="reason-input text-purple-600" inputMode="numeric" type="number" value={scraps.appearance} readOnly />
                                    <button onClick={() => handleScrapChange('appearance', 1)} className="circle-btn bg-purple-500 text-white">
                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                    </button>
                                </div>
                            </div>

                            {/* 4. Others */}
                            <div className="scrap-row">
                                <div className="flex-1">
                                    <p className="text-base font-black text-slate-600 dark:text-slate-300">4. 其他</p>
                                    <p className="text-xs font-bold text-slate-400">Others</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleScrapChange('others', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                    </button>
                                    <input className="reason-input text-slate-600 dark:text-slate-300" inputMode="numeric" type="number" value={scraps.others} readOnly />
                                    <button onClick={() => handleScrapChange('others', 1)} className="circle-btn bg-slate-500 text-white">
                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <section className="space-y-3">
                    <h2 className="text-lg font-black flex items-center gap-2 px-1">
                        <span className="material-symbols-outlined text-2xl">edit_note</span>
                        備註說明
                    </h2>
                    <textarea
                        className="w-full h-32 p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-lg font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none resize-none shadow-sm"
                        placeholder="如有其他異常狀況請在此輸入..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                    ></textarea>
                </section>
            </main>
            <footer className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-t-2 border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] z-40">
                <button
                    onClick={handleConfirm}
                    className="w-full h-14 bg-success text-white rounded-xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-transform border-b-4 border-green-800"
                >
                    <span className="text-xl font-black">完成並輸入下一筆</span>
                    <span className="material-symbols-outlined text-3xl font-black">arrow_forward</span>
                </button>
                <button
                    onClick={() => navigate('/')}
                    className="w-full h-12 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform border-2 border-slate-300 dark:border-slate-600"
                >
                    <span className="material-symbols-outlined text-2xl font-black">check_circle</span>
                    <span className="text-lg font-bold">結束今日作業</span>
                </button>
            </footer>
        </div>
    );
}
