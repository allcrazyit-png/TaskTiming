import React, { useState, useRef, useEffect } from 'react';
import { submitTaskTimingBatch } from '../services/submitTaskTimingRecord';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';

// TODO: Replace with your actual Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHcmD5yIdsLeDjE9b3O5zTW-Uygh_RdM6LdFG4gRdgqawouUNQJeq-La8zUJbltpHHYA/exec";

export default function Confirm() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isUploaded, setIsUploaded] = useState(false);
    const [uploadUnconfirmed, setUploadUnconfirmed] = useState(false);
    const submittingRef = useRef(false);
    const successTimer = useRef(null);
    useEffect(() => () => clearTimeout(successTimer.current), []);

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
        remarks,
        workDate,
        category
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
        scraps: { missing: 2, deform: 3, appearance: 0, others: 0 },
        startTime: "08:00",
        endTime: "10:00",
        totalTime: "02:00:00",
        remarks: "無",
        workDate: new Date().toLocaleDateString('en-ZA').replace(/-/g, '/'), // Default fallback YYYY/MM/DD
        category: ""
    };

    // 雙穴零件只做單邊時（另一邊良品與報廢皆為 0），只上傳有數量的那一邊
    const sumScraps = (s) => s ? Object.values(s).reduce((a, b) => a + b, 0) : 0;
    const hasR = goodCountR + sumScraps(location.state?.scrapsR) > 0;
    const hasL = goodCountL + sumScraps(location.state?.scrapsL) > 0;
    const onlySide = isDual && hasR !== hasL ? (hasR ? 'side_r' : 'side_l') : null;
    const durationParts = String(totalTime || '').split(':').map(Number);
    const readableDuration = durationParts.length === 3 && durationParts.every(Number.isFinite)
        ? [durationParts[0] > 0 && t('confirm_hours', { count: durationParts[0] }), durationParts[1] > 0 && t('confirm_minutes', { count: durationParts[1] }), (durationParts[2] > 0 || durationParts.every(value => value === 0)) && t('confirm_seconds', { count: durationParts[2] })].filter(Boolean).join(' ')
        : totalTime;
    const uploadCount = isDual ? Number(hasR) + Number(hasL) : 1;


    const getScrapLabel = (key) => {
        const labels = {
            missing: t('scrap_missing'),
            deform: t('scrap_deform'),
            appearance: t('scrap_appearance'),
            others: t('scrap_others')
        };
        return labels[key] || key;
    };

    // Calculate Metrics
    const calculateMetrics = () => {
        // Convert Total Time to Seconds (Format: HH:mm:ss)
        const timeParts = totalTime.match(/(\d{2}):(\d{2}):(\d{2})/);
        let totalSeconds = 0;
        if (timeParts) {
            const hours = parseInt(timeParts[1]) || 0;
            const mins = parseInt(timeParts[2]) || 0;
            const secs = parseInt(timeParts[3]) || 0;
            totalSeconds = hours * 3600 + mins * 60 + secs;
        }

        // Avoid division by zero
        if (totalSeconds === 0) return {
            avgTime: "0.0",
            efficiency: "0.0",
            scrapRate: "0.0",
            yieldRate: "0.0"
        };

        // 1. Avg Assembly Time = Actual Total Time / Good Count
        const avgTime = goodCount > 0 ? (totalSeconds / goodCount).toFixed(1) : "0.0";

        // 2. Efficiency = (Standard Time * Good Count) / Actual Total Time
        // Standard Time is in seconds
        const efficiency = ((standardTime * goodCount) / totalSeconds * 100).toFixed(1);

        // 3. Scrap Rate & Yield Rate
        const totalOutput = goodCount + totalScrap;
        const scrapRate = totalOutput > 0 ? ((totalScrap / totalOutput) * 100).toFixed(1) : "0.0";
        const yieldRate = totalOutput > 0 ? ((goodCount / totalOutput) * 100).toFixed(1) : "0.0";

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
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const handleSubmit = async () => {
        if (submittingRef.current || isUploaded || uploadUnconfirmed) return;
        if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("YOUR_GOOGLE_SCRIPT_URL")) {
            alert("錯誤: Google Script URL 未設定!");
            return;
        }

        submittingRef.current = true;
        setIsSubmitting(true);

        const payloads = [];
        const submitPayload = payload => payloads.push({ ...payload, recordId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}` });
        const saveConfirmedHistory = (payloadWithId) => {
            // Save to LocalStorage History
            try {
                // Extract Operator ID from "[ID] Name" format
                const match = payloadWithId.operator.match(/\[(.*?)\]/);
                const opId = match ? match[1] : 'unknown';
                const historyKey = `uploadHistory_${opId}`;

                const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');

                // Add timestamp to the payload copy
                const historyRecord = {
                    ...payloadWithId,
                    submitDate: new Date().toLocaleDateString(),
                    submitTimestamp: new Date().getTime()
                };

                // Keep only the latest 30 records to save space and keep it relevant
                const updatedHistory = [
                    historyRecord,
                    ...existingHistory
                ].slice(0, 30); // Keep max 30 records total

                localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
            } catch (e) {
                console.error("Failed to save history to localStorage", e);
            }
        };

        const getSubmitDate = () => {
            if (workDate) return workDate;
            const now = new Date();
            return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
        };

        if (isDual) {
            // Logic A: Use actual R/L scraps if available, otherwise fallback to proportion (for backwards compatibility/safety)
            const timeParts = totalTime.match(/(\d{2}):(\d{2}):(\d{2})/);
            let totalSeconds = 0;
            if (timeParts) {
                const hours = parseInt(timeParts[1]) || 0;
                const mins = parseInt(timeParts[2]) || 0;
                const secs = parseInt(timeParts[3]) || 0;
                totalSeconds = hours * 3600 + mins * 60 + secs;
            }

            const totalOutput = goodCount + totalScrap;
            const totalGood = goodCountR + goodCountL;
            const ratioR = totalGood > 0 ? (goodCountR / totalGood) : 0.5;

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
                    deform: getPropScrap(scraps?.deform, sRatioR),
                    appearance: getPropScrap(scraps?.appearance, sRatioR),
                    others: getPropScrap(scraps?.others, sRatioR)
                };
                finalScrapsL = {
                    missing: (scraps?.missing || 0) - finalScrapsR.missing,
                    deform: (scraps?.deform || 0) - finalScrapsR.deform,
                    appearance: (scraps?.appearance || 0) - finalScrapsR.appearance,
                    others: (scraps?.others || 0) - finalScrapsR.others
                };
            }

            const scrapR = Object.values(finalScrapsR).reduce((a, b) => a + b, 0);
            const scrapL = Object.values(finalScrapsL).reduce((a, b) => a + b, 0);

            const calcMetrics = (seconds, gCount, tScrap) => {
                const avg = gCount > 0 ? (seconds / gCount).toFixed(1) : "0.0";
                const eff = seconds > 0 ? ((standardTime * gCount) / seconds * 100).toFixed(1) : "0.0";
                const out = gCount + tScrap;
                const sr = out > 0 ? ((tScrap / out) * 100).toFixed(1) : "0.0";
                const yr = out > 0 ? ((gCount / out) * 100).toFixed(1) : "0.0";
                return { avgTime: avg, efficiency: eff, scrapRate: sr, yieldRate: yr };
            };

            const metricsR = calcMetrics(secondsR, goodCountR, scrapR);
            const metricsL = calcMetrics(secondsL, goodCountL, scrapL);

            const payloadR = {
                operator: operator,
                carModel: carModel,
                category: category || "", // 新增類別
                partNumber: partR,
                carName: carModel,
                productName: `${productName} (R邊)`,
                date: getSubmitDate(),
                startTime: startTime,
                endTime: endTime,
                totalTime: formatTimeHelper(secondsR),
                avgTime: metricsR.avgTime,
                standardTime: standardTime,
                goodCount: goodCountR,
                missing: finalScrapsR.missing,
                deform: finalScrapsR.deform,
                appearance: finalScrapsR.appearance,
                others: finalScrapsR.others,
                totalScrap: scrapR,
                remarks: remarks,
                satisfaction: 0,
                scrapRate: metricsR.scrapRate + "%",
                yieldRate: metricsR.yieldRate + "%",
                efficiency: metricsR.efficiency + "%"
            };

            const payloadL = {
                operator: operator,
                carModel: carModel,
                category: category || "", // 新增類別
                partNumber: partL,
                carName: carModel,
                productName: `${productName} (L邊)`,
                date: getSubmitDate(),
                startTime: startTime,
                endTime: endTime,
                totalTime: formatTimeHelper(secondsL),
                avgTime: metricsL.avgTime,
                standardTime: standardTime,
                goodCount: goodCountL,
                missing: finalScrapsL.missing,
                deform: finalScrapsL.deform,
                appearance: finalScrapsL.appearance,
                others: finalScrapsL.others,
                totalScrap: scrapL,
                remarks: remarks,
                satisfaction: 0,
                scrapRate: metricsL.scrapRate + "%",
                yieldRate: metricsL.yieldRate + "%",
                efficiency: metricsL.efficiency + "%"
            };

            if (goodCountR + scrapR > 0) submitPayload(payloadR);
            if (goodCountL + scrapL > 0) submitPayload(payloadL);
        } else {
            const payload = {
                operator: operator,
                carModel: carModel,
                category: category || "", // 新增類別
                partNumber: partNumber,
                carName: carModel, // Chinese Name mapped to Car Model
                productName: productName,
                date: getSubmitDate(),
                startTime: startTime,
                endTime: endTime,
                totalTime: totalTime,
                avgTime: metrics.avgTime,
                standardTime: standardTime,
                goodCount: goodCount,
                missing: scraps?.missing || 0,
                deform: scraps?.deform || 0,
                appearance: scraps?.appearance || 0,
                others: scraps?.others || 0,
                totalScrap: totalScrap,
                remarks: remarks,
                satisfaction: 0,
                scrapRate: metrics.scrapRate + "%",
                yieldRate: metrics.yieldRate + "%",
                efficiency: metrics.efficiency + "%"
            };
            submitPayload(payload);
        }

        try {
            // Sequentially acknowledge both sides. Save only confirmed records,
            // and never report full success when one side is still uncertain.
            await submitTaskTimingBatch(GOOGLE_SCRIPT_URL, payloads, { onConfirmed: saveConfirmedHistory });
            setIsUploaded(true);
            setShowSuccess(true);
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#137fec', '#2e7d32', '#f59e0b', '#ec4899'] });
            successTimer.current = setTimeout(() => setShowSuccess(false), 2000);
        } catch {
            // A missing response can mean the Sheet accepted the write but the
            // reply was lost. Do not retry automatically or label it as failed.
            setUploadUnconfirmed(true);
        } finally {
            setIsSubmitting(false);
            submittingRef.current = false;
        }
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
            <div className="bg-slate-50 dark:bg-black text-slate-500 dark:text-slate-400 py-2 px-4 text-center font-bold text-[11px] border-b border-slate-200 dark:border-slate-800 z-[60] relative tracking-[0.3em] uppercase">
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
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 space-y-4">
                    <p className="text-base font-bold text-slate-700 dark:text-slate-200">{t('operator_label')} {operator}</p>
                    <hr className="border-slate-100 dark:border-slate-800" />
                    <section className="min-w-0 space-y-2">
                        <h2 className="text-base font-bold text-slate-600 dark:text-slate-300">{t('product_name_label')}</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 break-words text-xl font-bold text-slate-900 dark:text-slate-100">{productName}</p>
                            {category && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{t(`cat_${category}`, category)}</span>}
                        </div>
                        <div className="space-y-1 text-base font-medium text-slate-600 dark:text-slate-300">
                            <p>{t('car_model_label')} {carModel}</p>
                            <p className="break-all">{t('part_number_input_label')} {partNumber}</p>
                        </div>
                    </section>
                    <hr className="border-slate-100 dark:border-slate-800" />
                    <section className="space-y-2">
                        <h2 className="text-base font-bold text-slate-600 dark:text-slate-300">{t('work_time')}</h2>
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{workDate}</p>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{startTime} – {endTime}</p>
                            <p className="text-base text-slate-600 dark:text-slate-300">{t('confirm_duration', { duration: readableDuration })}</p>
                        </div>
                    </section>
                    <hr className="border-slate-100 dark:border-slate-800" />
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-center gap-1">
                            <p className="text-xs font-bold text-emerald-800 dark:text-primary uppercase tracking-wider">{t('good_qty_label')}</p>
                            {isDual ? (
                                <div>
                                    <div className="space-y-2 text-xl font-bold text-slate-800 dark:text-slate-100">
                                        <p><span className="text-blue-700 dark:text-blue-300">{t('side_r')}</span>：{goodCountR}</p>
                                        <p><span className="text-purple-700 dark:text-purple-300">{t('side_l')}</span>：{goodCountL}</p>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 mt-0.5">{t('total')}: {goodCount} Pcs</p>
                                </div>
                            ) : (
                                <p className="text-3xl font-extrabold text-emerald-600 dark:text-primary">{goodCount}</p>
                            )}
                        </div>
                        <div className={`p-3 rounded-xl border flex flex-col justify-center gap-1 ${totalScrap > 0 ? "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"}`}>
                            <p className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-wider">{t('scrap_qty_label')}</p>
                            <p className={`text-3xl font-extrabold ${totalScrap > 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>{totalScrap}</p>
                        </div>
                    </div>
                {onlySide && (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-3">
                        <span className="material-symbols-outlined text-xl text-slate-600">info</span>
                        <p className="text-base font-bold text-slate-700 dark:text-slate-200">{t('only_upload_side', { side: t(onlySide) })}</p>
                    </div>
                )}
                    {totalScrap > 0 ? (<>
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
                    </>) : <p className="text-base text-slate-600 dark:text-slate-300">{t('scrap_reason_label')}：{t('remarks_none')}</p>}
                    {remarks?.trim() && !['無', t('remarks_none')].includes(remarks.trim()) ? (<>
                    <div className="bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-xl border-l-4 border-blue-500">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-blue-500 text-sm">sticky_note_2</span>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('remarks_content_label')}</p>
                        </div>
                        <p className="text-base font-bold text-slate-800 dark:text-slate-100 leading-relaxed min-h-[1.5em]">
                            {remarks || t('remarks_none')}
                        </p>
                    </div>

                    </>) : <p className="text-base text-slate-600 dark:text-slate-300">{t('remarks_content_label')}：{t('remarks_none')}</p>}

                </div>
                <div className="text-center mb-2">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('is_correct')}</h3>
                    {!isUploaded && <p className="mt-2 text-base font-bold text-slate-600 dark:text-slate-300">{t('confirm_upload_count', { count: uploadCount })}{isDual && ` (${[hasR && t('side_r'), hasL && t('side_l')].filter(Boolean).join(' / ')})`}</p>}
                </div>
                <div className="flex flex-col gap-3 mt-auto mb-4">
                    {uploadUnconfirmed && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-base font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t('upload_unconfirmed_hint')}</p>}
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || isUploaded || uploadUnconfirmed}
                        className={`w-full bg-success hover:bg-success/90 text-white min-h-16 rounded-xl font-black text-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-sm border-b-4 border-emerald-600 ${isSubmitting || isUploaded || uploadUnconfirmed ? 'opacity-50 cursor-not-allowed bg-slate-400 border-slate-500 shadow-none' : ''}`}
                    >
                        {uploadUnconfirmed ? t('upload_unconfirmed') : isSubmitting ? (
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
                        disabled={isSubmitting}
                        onClick={() => (isUploaded || uploadUnconfirmed) ? navigate('/') : navigate(-1)}
                        className="w-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 min-h-16 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors active:scale-95 border border-slate-300 dark:border-slate-700"
                    >
                        <span className="material-symbols-outlined text-xl">{isUploaded || uploadUnconfirmed ? 'home' : 'edit'}</span>
                        {isUploaded || uploadUnconfirmed ? t('back_home') : t('back_edit')}
                    </button>
                </div>
            </main>
        </div >
    );
}
