import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Input() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    // Default values for testing
    const { productName, partNumber, carModel, standardTime, operator, productImage } = location.state || {
        productName: "鋁合金散熱片 A-204",
        partNumber: "SAMPLE-001",
        carModel: "SAMPLE-CAR",
        standardTime: 0,
        operator: "[001] 王大明",
        productImage: null
    };

    // Helper to format image URL from GitHub Pages or use default
    const getImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return import.meta.env.BASE_URL + url.replace(/^\/+/, '');
    };

    const displayProductImage = getImageUrl(productImage);

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Check if the part number matches the dual-cavity pattern (e.g., has _X before a dash, like 53827_8-02280-1, or CW785401_2XA)
    const originalIsDual = partNumber && /_(\d+)/.test(partNumber);
    const [activeMode, setActiveMode] = useState(''); // '', 'both', 'r', 'l'

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
    const displayProductName = activeMode === 'both' ? productName : activeMode === 'r' ? `${productName} (R邊)` : activeMode === 'l' ? `${productName} (L邊)` : productName;
    const displayPartNumber = activeMode === 'both' ? partNumber : activeMode === 'r' ? partR : activeMode === 'l' ? partL : partNumber;

    const [goodCount, setGoodCount] = useState(0);
    const [goodCountR, setGoodCountR] = useState(0);
    const [goodCountL, setGoodCountL] = useState(0);
    const [scraps, setScraps] = useState({
        missing: 0, damage: 0, appearance: 0, others: 0
    });
    const [scrapsR, setScrapsR] = useState({
        missing: 0, damage: 0, appearance: 0, others: 0
    });
    const [scrapsL, setScrapsL] = useState({
        missing: 0, damage: 0, appearance: 0, others: 0
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

    const getTodayDateString = () => {
        const now = new Date();
        return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    };

    // Calculate total scrap
    const totalScrapR = Object.values(scrapsR).reduce((a, b) => a + b, 0);
    const totalScrapL = Object.values(scrapsL).reduce((a, b) => a + b, 0);
    const totalScrapSingle = Object.values(scraps).reduce((a, b) => a + b, 0);
    const totalScrap = isDual ? totalScrapR + totalScrapL : totalScrapSingle;

    const handleScrapChange = (type, delta) => {
        setScraps(prev => ({ ...prev, [type]: Math.max(0, prev[type] + delta) }));
    };

    const handleScrapChangeR = (type, delta) => {
        setScrapsR(prev => ({ ...prev, [type]: Math.max(0, prev[type] + delta) }));
    };

    const handleScrapChangeL = (type, delta) => {
        setScrapsL(prev => ({ ...prev, [type]: Math.max(0, prev[type] + delta) }));
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
        if (originalIsDual && !activeMode) {
            alert("請先選擇作業模式！\nPlease select a work mode first.");
            return;
        }

        const totalTime = calculateDuration(startTime, endTime);

        // Calculate combined scrap just in case they revert to a single mode mid-way or something, 
        // but normally we'd separate them immediately in confirm page if isDual
        const combinedScraps = isDual ? {
            missing: scrapsR.missing + scrapsL.missing,
            damage: scrapsR.damage + scrapsL.damage,
            appearance: scrapsR.appearance + scrapsL.appearance,
            others: scrapsR.others + scrapsL.others
        } : scraps;

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
                scraps: combinedScraps,
                scrapsR: isDual ? scrapsR : null,
                scrapsL: isDual ? scrapsL : null,
                startTime,
                endTime,
                totalTime,
                remarks
            }
        });
    };


    return (
        <div className="bg-background-light dark:bg-background-dark text-[#1e293b] dark:text-white min-h-screen flex flex-col pb-40">
            {/* Company Banner */}
            <div className="bg-black text-white py-2 px-4 text-center font-black text-base shadow-md z-[60] relative tracking-widest">
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
                        {displayProductImage ? (
                            <img alt="Product Image" className="w-[60px] h-[60px] rounded-xl border-2 border-primary object-cover shadow-sm bg-white"
                                src={displayProductImage}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://placehold.co/100x100?text=No+Photo';
                                }}
                            />
                        ) : (
                            <div className="w-[60px] h-[60px] rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-2xl">image_not_supported</span>
                            </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold">產品照</div>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-black leading-tight">{t('work_report')}</h1>
                        <div className="mt-1">
                            <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                                {t('car_model_label')} <span className="text-primary">{carModel}</span>
                            </span>
                            <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                                {t('part_number_input_label')} <span className="text-primary">{displayPartNumber}</span>
                            </span>
                            <span className="product-name-badge mt-0.5 inline-block">
                                {displayProductName}
                            </span>
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 space-y-6">
                {originalIsDual && (
                    <section className="space-y-3">
                        <h2 className="text-lg font-black flex items-center gap-2 px-1 text-slate-700 dark:text-slate-300">
                            <span className="material-symbols-outlined text-2xl">rule</span>
                            {t('select_work_mode')}
                        </h2>
                        <div className="bg-slate-100 dark:bg-slate-900 p-2 rounded-2xl flex gap-1 border-2 border-slate-200 dark:border-slate-800 shadow-sm">
                            <button
                                onClick={() => setActiveMode('r')}
                                className={`flex-1 py-3 px-2 rounded-xl text-sm font-black transition-all ${activeMode === 'r' ? 'bg-blue-600 text-white shadow-md scale-100' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 scale-95'}`}
                            >
                                {t('mode_r')}
                            </button>
                            <button
                                onClick={() => setActiveMode('l')}
                                className={`flex-1 py-3 px-2 rounded-xl text-sm font-black transition-all ${activeMode === 'l' ? 'bg-purple-600 text-white shadow-md scale-100' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 scale-95'}`}
                            >
                                {t('mode_l')}
                            </button>
                            <button
                                onClick={() => setActiveMode('both')}
                                className={`flex-1 py-3 px-2 rounded-xl text-sm font-black transition-all ${activeMode === 'both' ? 'bg-primary text-white shadow-md scale-100' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 scale-95'}`}
                            >
                                {t('mode_both')}
                            </button>
                        </div>
                    </section>
                )}

                {(!originalIsDual || activeMode) ? (
                    <>
                        <section className="space-y-3">
                            <div className="flex justify-between items-end px-1">
                                <h2 className="text-lg font-black flex items-center gap-2 text-primary">
                                    <span className="material-symbols-outlined text-2xl">schedule</span>
                                    {t('work_time')}
                                </h2>
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                    {getTodayDateString()}
                                </span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border-t-4 border-primary space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-black text-slate-500">{t('start_time')}</label>
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
                                            {t('fill_now')}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-black text-slate-500">{t('end_time')}</label>
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
                                            {t('fill_now')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>
                        <section className="space-y-3">
                            <h2 className="text-lg font-black flex items-center gap-2 px-1 text-success">
                                <span className="material-symbols-outlined text-2xl">check_circle</span>
                                {t('good_yield')} {isDual && <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-full ml-2">{t('dual_mode_tag')}</span>}
                            </h2>

                            {!isDual && (
                                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border-t-4 border-success">
                                    <div className="flex items-center justify-between gap-3">
                                        <button
                                            onClick={() => setGoodCount(Math.max(0, (parseInt(goodCount) || 0) - 1))}
                                            className="w-[50px] h-[50px] rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90 transition-transform border-2 border-slate-300 dark:border-slate-700"
                                        >
                                            <span className="material-symbols-outlined text-3xl font-black text-slate-600 dark:text-slate-300">remove</span>
                                        </button>
                                        <div className="flex-1 text-center">
                                            <input
                                                className="counter-input text-success focus:outline-none"
                                                type="number"
                                                value={goodCount}
                                                onChange={(e) => setGoodCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                            />
                                            <p className="text-xs font-black text-slate-400 mt-1 tracking-widest uppercase">Pcs</p>
                                        </div>
                                        <button
                                            onClick={() => setGoodCount((parseInt(goodCount) || 0) + 1)}
                                            className="w-[50px] h-[50px] rounded-xl bg-success text-white flex items-center justify-center active:scale-90 transition-transform border-2 border-emerald-600 shadow-md"
                                        >
                                            <span className="material-symbols-outlined text-3xl font-black">add</span>
                                        </button>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <button onClick={() => setGoodCount((parseInt(goodCount) || 0) + 10)} className="huge-btn bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200">+ 10</button>
                                        <button onClick={() => setGoodCount((parseInt(goodCount) || 0) + 50)} className="huge-btn bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200">+ 50</button>
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
                                                onClick={() => setGoodCountR(Math.max(0, (parseInt(goodCountR) || 0) - 1))}
                                                className="w-[45px] h-[45px] rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90 transition-transform border-2 border-slate-300 dark:border-slate-700"
                                            >
                                                <span className="material-symbols-outlined text-2xl font-black text-slate-600 dark:text-slate-300">remove</span>
                                            </button>
                                            <div className="flex-1 text-center">
                                                <input
                                                    className="counter-input text-blue-600 focus:outline-none"
                                                    type="number"
                                                    value={goodCountR}
                                                    onChange={(e) => setGoodCountR(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                />
                                                <p className="text-xs font-black text-slate-400 mt-0 tracking-widest uppercase">Pcs</p>
                                            </div>
                                            <button
                                                onClick={() => setGoodCountR((parseInt(goodCountR) || 0) + 1)}
                                                className="w-[45px] h-[45px] rounded-xl bg-blue-500 text-white flex items-center justify-center active:scale-90 transition-transform border-2 border-blue-600 shadow-md"
                                            >
                                                <span className="material-symbols-outlined text-2xl font-black">add</span>
                                            </button>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <button onClick={() => setGoodCountR((parseInt(goodCountR) || 0) + 10)} className="py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200 font-bold text-slate-700 dark:text-slate-300">+ 10</button>
                                            <button onClick={() => setGoodCountR((parseInt(goodCountR) || 0) + 50)} className="py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200 font-bold text-slate-700 dark:text-slate-300">+ 50</button>
                                        </div>
                                    </div>

                                    {/* L Side */}
                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border-t-4 border-success border-l-4 border-l-purple-500 relative">
                                        <div className="absolute top-0 right-0 bg-purple-500 text-white font-black px-3 py-1 rounded-bl-xl rounded-tr-xl text-sm shadow-sm">L 邊</div>
                                        <div className="flex items-center justify-between gap-3 pt-2">
                                            <button
                                                onClick={() => setGoodCountL(Math.max(0, (parseInt(goodCountL) || 0) - 1))}
                                                className="w-[45px] h-[45px] rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-90 transition-transform border-2 border-slate-300 dark:border-slate-700"
                                            >
                                                <span className="material-symbols-outlined text-2xl font-black text-slate-600 dark:text-slate-300">remove</span>
                                            </button>
                                            <div className="flex-1 text-center">
                                                <input
                                                    className="counter-input text-purple-600 focus:outline-none"
                                                    type="number"
                                                    value={goodCountL}
                                                    onChange={(e) => setGoodCountL(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                />
                                                <p className="text-xs font-black text-slate-400 mt-0 tracking-widest uppercase">Pcs</p>
                                            </div>
                                            <button
                                                onClick={() => setGoodCountL((parseInt(goodCountL) || 0) + 1)}
                                                className="w-[45px] h-[45px] rounded-xl bg-purple-500 text-white flex items-center justify-center active:scale-90 transition-transform border-2 border-purple-600 shadow-md"
                                            >
                                                <span className="material-symbols-outlined text-2xl font-black">add</span>
                                            </button>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <button onClick={() => setGoodCountL((parseInt(goodCountL) || 0) + 10)} className="py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200 font-bold text-slate-700 dark:text-slate-300">+ 10</button>
                                            <button onClick={() => setGoodCountL((parseInt(goodCountL) || 0) + 50)} className="py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 active:bg-slate-200 font-bold text-slate-700 dark:text-slate-300">+ 50</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                        <section className="space-y-3">
                            <h2 className="text-lg font-black flex items-center gap-2 px-1 text-danger">
                                <span className="material-symbols-outlined text-2xl">cancel</span>
                                {t('scrap_report')}
                            </h2>
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border-t-4 border-danger">
                                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-200 dark:border-red-800 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-black text-danger uppercase tracking-wider">{t('total_scrap')}</p>
                                        <p className="text-xs text-slate-500 font-bold">Total Scrap</p>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black text-danger">{totalScrap}</span>
                                        <span className="text-base font-bold text-danger/60">Pcs</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {/* 1. Missing Material */}
                                    <div className="scrap-row flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <div className="flex-1">
                                            <p className="text-base font-black text-orange-600">{t('scrap_missing')}</p>
                                            <p className="text-xs font-bold text-slate-400">Missing Mat.</p>
                                        </div>
                                        {isDual ? (
                                            <div className="flex flex-col items-center justify-center gap-3 w-full mt-2 sm:mt-0 xl:flex-row xl:justify-end">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-blue-600 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg whitespace-nowrap min-w-[3rem] text-center">R 邊</span>
                                                    <button onClick={() => handleScrapChangeR('missing', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                    </button>
                                                    <input className="reason-input text-blue-600" inputMode="numeric" type="number" value={scrapsR.missing} readOnly />
                                                    <button onClick={() => handleScrapChangeR('missing', 1)} className="circle-btn bg-blue-500 text-white">
                                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-purple-600 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-lg whitespace-nowrap min-w-[3rem] text-center">L 邊</span>
                                                    <button onClick={() => handleScrapChangeL('missing', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                    </button>
                                                    <input className="reason-input text-purple-600" inputMode="numeric" type="number" value={scrapsL.missing} readOnly />
                                                    <button onClick={() => handleScrapChangeL('missing', 1)} className="circle-btn bg-purple-500 text-white">
                                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleScrapChange('missing', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                </button>
                                                <input className="reason-input text-orange-600" inputMode="numeric" type="number" value={scraps.missing} readOnly />
                                                <button onClick={() => handleScrapChange('missing', 1)} className="circle-btn bg-orange-500 text-white">
                                                    <span className="material-symbols-outlined text-xl font-black">add</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Dent/Scratch */}
                                    <div className="scrap-row flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <div className="flex-1">
                                            <p className="text-base font-black text-blue-600">{t('scrap_damage')}</p>
                                            <p className="text-xs font-bold text-slate-400">Dent / Scratch</p>
                                        </div>
                                        {isDual ? (
                                            <div className="flex flex-col items-center justify-center gap-3 w-full mt-2 sm:mt-0 xl:flex-row xl:justify-end">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-blue-600 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg whitespace-nowrap min-w-[3rem] text-center">R 邊</span>
                                                    <button onClick={() => handleScrapChangeR('damage', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                    </button>
                                                    <input className="reason-input text-blue-600" inputMode="numeric" type="number" value={scrapsR.damage} readOnly />
                                                    <button onClick={() => handleScrapChangeR('damage', 1)} className="circle-btn bg-blue-500 text-white">
                                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-purple-600 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-lg whitespace-nowrap min-w-[3rem] text-center">L 邊</span>
                                                    <button onClick={() => handleScrapChangeL('damage', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                    </button>
                                                    <input className="reason-input text-purple-600" inputMode="numeric" type="number" value={scrapsL.damage} readOnly />
                                                    <button onClick={() => handleScrapChangeL('damage', 1)} className="circle-btn bg-purple-500 text-white">
                                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleScrapChange('damage', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                </button>
                                                <input className="reason-input text-blue-600" inputMode="numeric" type="number" value={scraps.damage} readOnly />
                                                <button onClick={() => handleScrapChange('damage', 1)} className="circle-btn bg-blue-500 text-white">
                                                    <span className="material-symbols-outlined text-xl font-black">add</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Appearance Defect */}
                                    <div className="scrap-row flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <div className="flex-1">
                                            <p className="text-base font-black text-purple-600">{t('scrap_appearance')}</p>
                                            <p className="text-xs font-bold text-slate-400">{t('scrap_appearance_desc')}</p>
                                        </div>
                                        {isDual ? (
                                            <div className="flex flex-col items-center justify-center gap-3 w-full mt-2 sm:mt-0 xl:flex-row xl:justify-end">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-blue-600 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg whitespace-nowrap min-w-[3rem] text-center">R 邊</span>
                                                    <button onClick={() => handleScrapChangeR('appearance', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                    </button>
                                                    <input className="reason-input text-blue-600" inputMode="numeric" type="number" value={scrapsR.appearance} readOnly />
                                                    <button onClick={() => handleScrapChangeR('appearance', 1)} className="circle-btn bg-blue-500 text-white">
                                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-purple-600 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-lg whitespace-nowrap min-w-[3rem] text-center">L 邊</span>
                                                    <button onClick={() => handleScrapChangeL('appearance', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                    </button>
                                                    <input className="reason-input text-purple-600" inputMode="numeric" type="number" value={scrapsL.appearance} readOnly />
                                                    <button onClick={() => handleScrapChangeL('appearance', 1)} className="circle-btn bg-purple-500 text-white">
                                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleScrapChange('appearance', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                </button>
                                                <input className="reason-input text-purple-600" inputMode="numeric" type="number" value={scraps.appearance} readOnly />
                                                <button onClick={() => handleScrapChange('appearance', 1)} className="circle-btn bg-purple-500 text-white">
                                                    <span className="material-symbols-outlined text-xl font-black">add</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 4. Others */}
                                    <div className="scrap-row flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <div className="flex-1">
                                            <p className="text-base font-black text-slate-600 dark:text-slate-300">{t('scrap_others')}</p>
                                            <p className="text-xs font-bold text-slate-400">Others</p>
                                        </div>
                                        {isDual ? (
                                            <div className="flex flex-col items-center justify-center gap-3 w-full mt-2 sm:mt-0 xl:flex-row xl:justify-end">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-blue-600 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg whitespace-nowrap min-w-[3rem] text-center">R 邊</span>
                                                    <button onClick={() => handleScrapChangeR('others', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                    </button>
                                                    <input className="reason-input text-blue-600" inputMode="numeric" type="number" value={scrapsR.others} readOnly />
                                                    <button onClick={() => handleScrapChangeR('others', 1)} className="circle-btn bg-blue-500 text-white">
                                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-purple-600 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-lg whitespace-nowrap min-w-[3rem] text-center">L 邊</span>
                                                    <button onClick={() => handleScrapChangeL('others', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                    </button>
                                                    <input className="reason-input text-purple-600" inputMode="numeric" type="number" value={scrapsL.others} readOnly />
                                                    <button onClick={() => handleScrapChangeL('others', 1)} className="circle-btn bg-purple-500 text-white">
                                                        <span className="material-symbols-outlined text-xl font-black">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleScrapChange('others', -1)} className="circle-btn bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    <span className="material-symbols-outlined text-xl font-black">remove</span>
                                                </button>
                                                <input className="reason-input text-slate-600 dark:text-slate-300" inputMode="numeric" type="number" value={scraps.others} readOnly />
                                                <button onClick={() => handleScrapChange('others', 1)} className="circle-btn bg-slate-500 text-white">
                                                    <span className="material-symbols-outlined text-xl font-black">add</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                        <section className="space-y-3">
                            <h2 className="text-lg font-black flex items-center gap-2 px-1">
                                <span className="material-symbols-outlined text-2xl">edit_note</span>
                                {t('remarks_title')}
                            </h2>
                            <textarea
                                className="w-full h-32 p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-lg font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none resize-none shadow-sm"
                                placeholder={t('remarks_placeholder')}
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                            ></textarea>
                        </section>
                    </>
                ) : (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 mx-1 mt-6">
                        <span className="material-symbols-outlined text-5xl text-slate-400 mb-3 block">touch_app</span>
                        <p className="text-xl font-black text-slate-600 dark:text-slate-300 mb-2">{t('please_select_mode')}</p>
                        <p className="text-sm font-bold text-slate-400">{t('select_mode_desc')}</p>
                    </div>
                )}
            </main>
            <footer className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-t-2 border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] z-40">
                <button
                    onClick={handleConfirm}
                    disabled={originalIsDual && !activeMode}
                    className={`w-full h-14 rounded-xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-transform border-b-4 ${originalIsDual && !activeMode ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 border-slate-400 cursor-not-allowed' : 'bg-success text-white border-green-800'}`}
                >
                    <span className="text-xl font-black">{t('finish_next')}</span>
                    <span className="material-symbols-outlined text-3xl font-black">arrow_forward</span>
                </button>
                <button
                    onClick={() => navigate('/')}
                    className="w-full h-12 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform border-2 border-slate-300 dark:border-slate-600"
                >
                    <span className="material-symbols-outlined text-2xl font-black">check_circle</span>
                    <span className="text-lg font-bold">{t('finish_today')}</span>
                </button>
            </footer>
        </div>
    );
}
