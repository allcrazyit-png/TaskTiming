import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// TODO: Replace with your actual Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHcmD5yIdsLeDjE9b3O5zTW-Uygh_RdM6LdFG4gRdgqawouUNQJeq-La8zUJbltpHHYA/exec";

export default function Confirm() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isUploaded, setIsUploaded] = useState(false);

    const {
        productName,
        partNumber,
        carModel,
        standardTime,
        operator,
        goodCount,
        goodCountR,
        goodCountL,
        isDual,
        totalScrap,
        scraps,
        startTime,
        endTime,
        totalTime,
        remarks
    } = location.state || {
        productName: "零件 A",
        partNumber: "SAMPLE",
        carModel: "SAMPLE",
        standardTime: 100,
        operator: "[001] 王大明",
        goodCount: 500,
        goodCountR: 0,
        goodCountL: 0,
        isDual: false,
        totalScrap: 5,
        scraps: { missing: 2, damage: 3, appearance: 0, others: 0 },
        startTime: "08:00",
        endTime: "10:00",
        totalTime: "2小時0分",
        remarks: "無"
    };

    const getScrapLabel = (key) => {
        const labels = {
            missing: t('scrap_missing'),
            damage: t('scrap_damage'),
            appearance: t('scrap_appearance'),
            others: t('scrap_others')
        };
        return labels[key] || key;
    };

    // Calculate Metrics
    const calculateMetrics = () => {
        // Convert Total Time to Seconds
        const timeParts = totalTime.match(/(\d+)小時(\d+)分/);
        let totalSeconds = 0;
        if (timeParts) {
            const hours = parseInt(timeParts[1]) || 0;
            const mins = parseInt(timeParts[2]) || 0;
            totalSeconds = hours * 3600 + mins * 60;
        }

        // Avoid division by zero
        if (totalSeconds === 0) return { avgTime: 0, efficiency: 0, scrapRate: 0 };

        // 1. Avg Assembly Time = Actual Total Time / Good Count
        const avgTime = goodCount > 0 ? (totalSeconds / goodCount).toFixed(1) : 0;

        // 2. Efficiency = (Standard Time * Good Count) / Actual Total Time
        // Standard Time is in seconds
        const efficiency = ((standardTime * goodCount) / totalSeconds * 100).toFixed(1);

        // 3. Scrap Rate & Yield Rate
        const totalOutput = goodCount + totalScrap;
        const scrapRate = totalOutput > 0 ? ((totalScrap / totalOutput) * 100).toFixed(1) : 0;
        const yieldRate = totalOutput > 0 ? ((goodCount / totalOutput) * 100).toFixed(1) : 0;

        return { avgTime, efficiency, scrapRate, yieldRate };
    };

    const metrics = calculateMetrics();

    const deriveDualPartNumbers = (pn) => {
        // Match a pattern like "53827_8-02280-1" or "CW785401_2XA" where "\_8" or "\_2" is present
        if (pn) {
            // Group 1: prefixBase (e.g. "53827", "CW785401")
            // Group 2: underscoreDigit (e.g. "8", "2")
            // Group 3: optional remaining suffix (e.g. "-02280-1", "XA")
            const match = pn.match(/^(.*?)_(\d+)(.*)$/);
            if (match) {
                const prefixBase = match[1];
                const underscoreDigit = match[2];
                const suffix = match[3] || "";

                // Extract the trailing numbers of prefixBase
                const prefixMatch = prefixBase.match(/^(.*?)(\d+)$/);

                if (prefixMatch) {
                    const baseStr = prefixMatch[1]; // e.g. "5382", "CW78540"
                    const numRStr = prefixMatch[2]; // e.g. "7", "1"
                    const numR = parseInt(numRStr, 10);
                    const numL = numR + 1;

                    return {
                        partR: `${baseStr}${numR}${suffix}`,
                        partL: `${baseStr}${numL}${suffix}`
                    };
                }
            }
        }
        return { partR: pn + "-R", partL: pn + "-L" };
    };

    const formatTimeHelper = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}小時${m}分`;
    };

    const handleSubmit = () => {
        if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("YOUR_GOOGLE_SCRIPT_URL")) {
            alert("錯誤: Google Script URL 未設定!");
            return;
        }

        setIsSubmitting(true);

        const submitPayload = (payload) => {
            fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                keepalive: true,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }).catch(err => console.error(err));

            // Save to LocalStorage History
            try {
                // Extract Operator ID from "[ID] Name" format
                const match = payload.operator.match(/\[(.*?)\]/);
                const opId = match ? match[1] : 'unknown';
                const historyKey = `uploadHistory_${opId}`;

                const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');

                // Add timestamp to the payload copy
                const historyRecord = {
                    ...payload,
                    submitDate: new Date().toLocaleDateString(),
                    submitTimestamp: new Date().getTime()
                };

                // Keep only today's records to save space and keep it relevant
                const todayStr = new Date().toLocaleDateString();
                const updatedHistory = [
                    historyRecord,
                    ...existingHistory.filter(record => record.submitDate === todayStr)
                ].slice(0, 50); // Keep max 50 records per day

                localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
            } catch (e) {
                console.error("Failed to save history to localStorage", e);
            }
        };

        if (isDual) {
            // Logic A: Use actual R/L scraps if available, otherwise fallback to proportion (for backwards compatibility/safety)
            const timeParts = totalTime.match(/(\d+)小時(\d+)分/);
            let totalSeconds = 0;
            if (timeParts) {
                const hours = parseInt(timeParts[1]) || 0;
                const mins = parseInt(timeParts[2]) || 0;
                totalSeconds = hours * 3600 + mins * 60;
            }

            const totalOutput = goodCount + totalScrap;
            const totalGood = goodCountR + goodCountL;
            const ratioR = totalGood > 0 ? (goodCountR / totalGood) : 0.5;
            const ratioL = totalGood > 0 ? (goodCountL / totalGood) : 0.5;

            const secondsR = Math.round(totalSeconds * ratioR);
            const secondsL = totalSeconds - secondsR;

            const { partR, partL } = deriveDualPartNumbers(partNumber);

            // Fetch real scraps from state, or fallback to proportional split if not present for some reason
            let finalScrapsR = location.state.scrapsR;
            let finalScrapsL = location.state.scrapsL;

            if (!finalScrapsR || !finalScrapsL) {
                const sRatioR = totalOutput > 0 ? ((goodCountR + (totalScrap * ratioR)) / totalOutput) : 0.5;
                const getPropScrap = (val, ratio) => Math.round((val || 0) * ratio);
                finalScrapsR = {
                    missing: getPropScrap(scraps?.missing, sRatioR),
                    damage: getPropScrap(scraps?.damage, sRatioR),
                    appearance: getPropScrap(scraps?.appearance, sRatioR),
                    others: getPropScrap(scraps?.others, sRatioR)
                };
                finalScrapsL = {
                    missing: (scraps?.missing || 0) - finalScrapsR.missing,
                    damage: (scraps?.damage || 0) - finalScrapsR.damage,
                    appearance: (scraps?.appearance || 0) - finalScrapsR.appearance,
                    others: (scraps?.others || 0) - finalScrapsR.others
                };
            }

            const scrapR = Object.values(finalScrapsR).reduce((a, b) => a + b, 0);
            const scrapL = Object.values(finalScrapsL).reduce((a, b) => a + b, 0);

            const calcMetrics = (seconds, gCount, tScrap) => {
                const avg = gCount > 0 ? (seconds / gCount).toFixed(1) : 0;
                const eff = seconds > 0 ? ((standardTime * gCount) / seconds * 100).toFixed(1) : 0;
                const out = gCount + tScrap;
                const sr = out > 0 ? ((tScrap / out) * 100).toFixed(1) : 0;
                const yr = out > 0 ? ((gCount / out) * 100).toFixed(1) : 0;
                return { avgTime: avg, efficiency: eff, scrapRate: sr, yieldRate: yr };
            };

            const metricsR = calcMetrics(secondsR, goodCountR, scrapR);
            const metricsL = calcMetrics(secondsL, goodCountL, scrapL);

            const payloadR = {
                operator: operator,
                carModel: carModel,
                partNumber: partR,
                carName: carModel,
                productName: `${productName} (R邊)`,
                date: new Date().toLocaleDateString('zh-TW'),
                startTime: startTime,
                endTime: endTime,
                totalTime: formatTimeHelper(secondsR),
                avgTime: metricsR.avgTime,
                standardTime: standardTime,
                goodCount: goodCountR,
                missing: finalScrapsR.missing,
                damage: finalScrapsR.damage,
                appearance: finalScrapsR.appearance,
                others: finalScrapsR.others,
                totalScrap: scrapR,
                remarks: remarks,
                scrapRate: metricsR.scrapRate + "%",
                yieldRate: metricsR.yieldRate + "%",
                efficiency: metricsR.efficiency + "%"
            };

            const payloadL = {
                operator: operator,
                carModel: carModel,
                partNumber: partL,
                carName: carModel,
                productName: `${productName} (L邊)`,
                date: new Date().toLocaleDateString('zh-TW'),
                startTime: startTime,
                endTime: endTime,
                totalTime: formatTimeHelper(secondsL),
                avgTime: metricsL.avgTime,
                standardTime: standardTime,
                goodCount: goodCountL,
                missing: finalScrapsL.missing,
                damage: finalScrapsL.damage,
                appearance: finalScrapsL.appearance,
                others: finalScrapsL.others,
                totalScrap: scrapL,
                remarks: remarks,
                scrapRate: metricsL.scrapRate + "%",
                yieldRate: metricsL.yieldRate + "%",
                efficiency: metricsL.efficiency + "%"
            };

            submitPayload(payloadR);
            submitPayload(payloadL);
        } else {
            const payload = {
                operator: operator,
                carModel: carModel,
                partNumber: partNumber,
                carName: carModel, // Chinese Name mapped to Car Model
                productName: productName,
                date: new Date().toLocaleDateString('zh-TW'),
                startTime: startTime,
                endTime: endTime,
                totalTime: totalTime,
                avgTime: metrics.avgTime,
                standardTime: standardTime,
                goodCount: goodCount,
                missing: scraps?.missing || 0,
                damage: scraps?.damage || 0,
                appearance: scraps?.appearance || 0,
                others: scraps?.others || 0,
                totalScrap: totalScrap,
                remarks: remarks,
                scrapRate: metrics.scrapRate + "%",
                yieldRate: metrics.yieldRate + "%",
                efficiency: metrics.efficiency + "%"
            };
            submitPayload(payload);
        }

        // Simulate UX delay for "Uploading..." feel
        setTimeout(() => {
            setIsSubmitting(false);
            setShowSuccess(true);
            setIsUploaded(true);

            // STAY on the page, just hide the success overlay after animation
            setTimeout(() => {
                setShowSuccess(false);
            }, 2000);
        }, 800);
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col relative">
            {/* Success Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center transform transition-all scale-100 animate-bounceScale">
                        <div className="w-24 h-24 bg-success rounded-full flex items-center justify-center mb-4 shadow-lg shadow-success/30">
                            <span className="material-symbols-outlined text-6xl text-white font-black animate-check">check</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white">{t('upload_success_msg')}</h2>
                        <p className="text-slate-500 font-bold mt-2">Uploading Success</p>
                    </div>
                </div>
            )}

            {/* Company Banner */}
            <div className="bg-black text-white py-2 px-4 text-center font-black text-base shadow-md z-[60] relative tracking-widest">
                瑞全企業股份有限公司
            </div>
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col items-center justify-center px-4 py-2">
                    <div className="flex items-center justify-between w-full h-8">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center justify-center size-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
                        </button>
                        <h2 className="text-base font-bold tracking-tight">{t('confirm_title')}</h2>
                        <div className="size-8"></div>
                    </div>
                </div>
            </div>
            <main className="flex-1 flex flex-col px-4 py-4 max-w-md mx-auto w-full space-y-4">
                <div className="flex justify-center">
                    <div className="bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-full border-2 border-slate-300 dark:border-slate-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg text-slate-600 dark:text-slate-400">account_circle</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">作業者: <span className="text-blue-600 dark:text-blue-400">{operator}</span></span>
                    </div>
                </div>
                <header className="text-center">
                    <h1 className="text-2xl font-extrabold leading-tight text-slate-900 dark:text-white">
                        {t('confirm_desc')}
                    </h1>
                </header>
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-100 dark:border-slate-800 p-4 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-xl">schedule</span>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('work_time')}</p>
                            <p className="text-xl font-bold">{startTime} - {endTime} <span className="text-sm text-slate-400 font-normal">({totalTime})</span></p>
                        </div>
                    </div>
                    <hr className="border-slate-100 dark:border-slate-800" />
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-xl">inventory_2</span>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('product_name_label')}</p>
                            <p className="text-xl font-bold">{productName}</p>
                            <p className="text-sm font-medium text-slate-500">{carModel} / {partNumber}</p>
                        </div>
                    </div>
                    <hr className="border-slate-100 dark:border-slate-800" />
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-primary/10 dark:bg-primary/5 p-3 rounded-xl border border-primary/20 flex flex-col justify-center gap-1">
                            <p className="text-xs font-bold text-emerald-800 dark:text-primary uppercase tracking-wider">{t('good_qty_label')}</p>
                            {isDual ? (
                                <div>
                                    <p className="text-2xl font-extrabold text-emerald-600 dark:text-primary tracking-tight">
                                        <span className="text-blue-600 text-lg">R:</span>{goodCountR} <span className="text-purple-600 text-lg ml-1">L:</span>{goodCountL}
                                    </p>
                                    <p className="text-xs font-bold text-slate-500 mt-0.5">{t('total')}: {goodCount} Pcs</p>
                                </div>
                            ) : (
                                <p className="text-3xl font-extrabold text-emerald-600 dark:text-primary">{goodCount}</p>
                            )}
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 flex flex-col justify-center gap-1">
                            <p className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-wider">{t('scrap_qty_label')}</p>
                            <p className="text-3xl font-extrabold text-red-600 dark:text-red-500">{totalScrap}</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-slate-400 text-sm">report_problem</span>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('scrap_reason_label')}</p>
                        </div>
                        <div className="space-y-1">
                            {scraps && Object.entries(scraps).map(([key, value]) => {
                                if (value <= 0) return null;
                                return (
                                    <div key={key} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-base font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 last:border-0 pb-1 last:pb-0">
                                        <span>{getScrapLabel(key)}</span>
                                        <div className="flex items-center gap-2 text-sm">
                                            {isDual && location.state.scrapsR && location.state.scrapsL ? (
                                                <>
                                                    <span className="text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">R: {location.state.scrapsR[key]}</span>
                                                    <span className="text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">L: {location.state.scrapsL[key]}</span>
                                                    <span className="font-extrabold text-red-500 ml-1">{t('total')} {value}</span>
                                                </>
                                            ) : (
                                                <span className="font-extrabold text-red-500">{value}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {(!scraps || Object.values(scraps).every(v => v === 0)) && (
                                <p className="text-base font-bold text-slate-400">{t('remarks_none')}</p>
                            )}
                        </div>
                    </div>
                    <div className="bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-xl border-l-4 border-blue-500">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-blue-500 text-sm">sticky_note_2</span>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('remarks_content_label')}</p>
                        </div>
                        <p className="text-base font-bold text-slate-800 dark:text-slate-100 leading-relaxed min-h-[1.5em]">
                            {remarks || t('remarks_none')}
                        </p>
                    </div>
                </div>
                <div className="text-center mb-2">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('is_correct')}</h3>
                </div>
                <div className="flex flex-col gap-3 mt-auto mb-4">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || isUploaded}
                        className={`w-full bg-primary hover:bg-primary/90 text-slate-900 h-14 rounded-xl font-black text-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-md shadow-primary/30 border-b-4 border-emerald-600 ${isSubmitting || isUploaded ? 'opacity-50 cursor-not-allowed bg-slate-400 border-slate-500 shadow-none' : ''}`}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                                <span className="text-xl font-bold">{t('uploading')}</span>
                            </>
                        ) : isUploaded ? (
                            <>
                                <span className="material-symbols-outlined text-2xl font-bold">check_circle</span>
                                <span className="text-xl font-bold">{t('upload_success_btn')}</span>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-2xl font-bold">check_circle</span>
                                {t('upload_btn')}
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => isUploaded ? navigate('/') : navigate(-1)}
                        className="w-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 h-12 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors active:scale-95 border-b-4 border-slate-300 dark:border-slate-950"
                    >
                        <span className="material-symbols-outlined text-xl">{isUploaded ? 'home' : 'edit'}</span>
                        {isUploaded ? t('back_home') : t('back_edit')}
                    </button>
                </div>
            </main>
        </div >
    );
}
