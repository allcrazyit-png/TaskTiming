import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Confirm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { productName, goodCount, totalScrap, scraps } = location.state || {
        productName: "零件 A",
        goodCount: 500,
        totalScrap: 5,
        scraps: { missing: 2, damage: 3, appearance: 0, others: 0 }
    };

    const getScrapLabel = (key) => {
        const labels = {
            missing: "缺料",
            damage: "撞(刮)傷",
            appearance: "外觀不良",
            others: "其他"
        };
        return labels[key] || key;
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col items-center justify-center px-4 py-2">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest mb-1 uppercase">瑞全企業股份有限公司</span>
                    <div className="flex items-center justify-between w-full h-8">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center justify-center size-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
                        </button>
                        <h2 className="text-base font-bold tracking-tight">上傳前確認</h2>
                        <div className="size-8"></div>
                    </div>
                </div>
            </div>
            <main className="flex-1 flex flex-col px-4 py-4 max-w-md mx-auto w-full space-y-4">
                <div className="flex justify-center">
                    <div className="bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-full border-2 border-slate-300 dark:border-slate-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg text-slate-600 dark:text-slate-400">account_circle</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">作業者: <span className="text-blue-600 dark:text-blue-400">[A024] 王大明</span></span>
                    </div>
                </div>
                <header className="text-center">
                    <h1 className="text-2xl font-extrabold leading-tight text-slate-900 dark:text-white">
                        請確認回報內容
                    </h1>
                </header>
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-100 dark:border-slate-800 p-4 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-xl">schedule</span>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">作業時間</p>
                            <p className="text-xl font-bold">08:00 - 10:30</p>
                        </div>
                    </div>
                    <hr className="border-slate-100 dark:border-slate-800" />
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-xl">inventory_2</span>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">產品名稱</p>
                            <p className="text-xl font-bold">{productName}</p>
                        </div>
                    </div>
                    <hr className="border-slate-100 dark:border-slate-800" />
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-primary/10 dark:bg-primary/5 p-3 rounded-xl border border-primary/20">
                            <p className="text-xs font-bold text-emerald-800 dark:text-primary uppercase tracking-wider">良品數量</p>
                            <p className="text-3xl font-extrabold text-emerald-600 dark:text-primary">{goodCount}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                            <p className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-wider">報廢數量</p>
                            <p className="text-3xl font-extrabold text-red-600 dark:text-red-500">{totalScrap}</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-slate-400 text-sm">report_problem</span>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">報廢原因</p>
                        </div>
                        <div className="space-y-1">
                            {scraps && Object.entries(scraps).map(([key, value]) => {
                                if (value <= 0) return null;
                                return (
                                    <div key={key} className="flex justify-between items-center text-base font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 last:border-0 pb-1 last:pb-0">
                                        <span>{getScrapLabel(key)}</span>
                                        <span className="text-red-500">{value}</span>
                                    </div>
                                );
                            })}
                            {(!scraps || Object.values(scraps).every(v => v === 0)) && (
                                <p className="text-base font-bold text-slate-400">無</p>
                            )}
                        </div>
                    </div>
                    <div className="bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-xl border-l-4 border-blue-500">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-blue-500 text-sm">sticky_note_2</span>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">備註內容</p>
                        </div>
                        <p className="text-base font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                            模具今日稍有磨損，已通知維修班於下午進行更換，剩餘料件充足。
                        </p>
                    </div>
                </div>
                <div className="text-center mb-2">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">以上資料是否正確？</h3>
                </div>
                <div className="flex flex-col gap-3 mt-auto mb-4">
                    <button className="w-full bg-primary hover:bg-primary/90 text-slate-900 h-14 rounded-xl font-black text-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-md shadow-primary/30 border-b-4 border-emerald-600">
                        <span className="material-symbols-outlined text-2xl font-bold">check_circle</span>
                        確認上傳
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 h-12 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors active:scale-95 border-b-4 border-slate-300 dark:border-slate-950"
                    >
                        <span className="material-symbols-outlined text-xl">edit</span>
                        返回修改
                    </button>
                </div>
            </main>
            <nav className="bg-white dark:bg-background-dark border-t border-slate-200 dark:border-slate-800 pb-8 pt-2">
                <div className="flex justify-around items-center">
                    <a href="#" onClick={() => navigate('/')} className="flex flex-col items-center gap-1 text-primary">
                        <span className="material-symbols-outlined text-3xl font-variation-fill">home</span>
                        <span className="text-xs font-bold">首頁</span>
                    </a>
                    <a href="#" className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500">
                        <span className="material-symbols-outlined text-3xl">assignment</span>
                        <span className="text-xs font-medium">報表</span>
                    </a>
                    <a href="#" className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500">
                        <span className="material-symbols-outlined text-3xl">settings</span>
                        <span className="text-xs font-medium">設定</span>
                    </a>
                </div>
            </nav>
        </div>
    );
}
