import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
    const navigate = useNavigate();

    const handleStartWork = (productName, partNumber) => {
        // In a real app, you might pass these as state or params
        navigate('/input', { state: { productName, partNumber } });
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
            {/* Header Section */}
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold tracking-tight text-primary">瑞全企業股份有限公司</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="material-symbols-outlined text-slate-500 text-lg">person</span>
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">[001] 王大明</p>
                        </div>
                    </div>
                    <div className="bg-primary/10 p-2 rounded-full">
                        <span className="material-symbols-outlined text-primary text-2xl">factory</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 p-4 pb-24">
                {/* Filter Section */}
                <section className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-800 dark:text-slate-200">
                            1. 選擇車型 (Filter Car Model)
                        </label>
                        <div className="relative">
                            <select className="block w-full h-12 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base font-medium focus:border-primary focus:ring-primary appearance-none">
                                <option value="">請點擊選擇車型</option>
                                <option value="toyota">TOYOTA - ALTIS</option>
                                <option value="honda">HONDA - CR-V</option>
                                <option value="nissan">NISSAN - KICKS</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <span className="material-symbols-outlined text-2xl">expand_more</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-800 dark:text-slate-200">
                            2. 選擇產品品番 (Filter Part Number)
                        </label>
                        <div className="relative">
                            <select className="block w-full h-12 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base font-medium focus:border-primary focus:ring-primary appearance-none">
                                <option value="">請點擊選擇品番</option>
                                <option value="p001">A-12345-BT (引擎支架)</option>
                                <option value="p002">B-98765-XX (變速箱墊片)</option>
                                <option value="p003">C-44556-QR (排氣管接頭)</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <span className="material-symbols-outlined text-2xl">expand_more</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Product Grid */}
                <div className="grid grid-cols-1 gap-6">
                    <h2 className="text-lg font-bold border-l-4 border-primary pl-3">目前可作業產品</h2>

                    {/* Product Card 1 */}
                    <div className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg transition-transform active:scale-[0.98]">
                        <div className="aspect-video w-full bg-slate-200 relative overflow-hidden">
                            <img
                                alt="Engine Bracket"
                                className="h-full w-full object-cover"
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC0tnlwKVAP7otcncesRTdc-iezUN0uFSRs2BDZWT0Qj5KUDATL4G3mbaUgEUfWLXz-ffneUyfTpHx66OtuN-0eY0QoUw2pSagH7Hzw2heHhRG0ZUa05R0jgsOxDEEsCaSg4gLBuaY_Jt9FzD_gPMS2CjgfzEgTYTJq0E9Z2tLpzlkNRakTch9eJyBpB94OKT2WIvjmrHOlwH2WHNcSaBQhJgyRvaZUF2Ghu4i9KLakM7NhI_1OYs9Xmmkrm8zi3it1hXKI3uMCtLw"
                            />
                            <div className="absolute top-3 right-3 bg-primary text-white px-3 py-1 rounded-full font-bold text-xs shadow-md">
                                在庫: 120
                            </div>
                        </div>
                        <div className="p-4">
                            <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-50 mb-1">引擎支架 (Engine Bracket)</h3>
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4">品番: A-12345-BT</p>
                            <button
                                onClick={() => handleStartWork("引擎支架 (Engine Bracket)", "A-12345-BT")}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-lg font-black text-white shadow-md hover:bg-primary/90 active:bg-primary/80 transition-colors"
                            >
                                <span className="material-symbols-outlined text-2xl">play_circle</span>
                                開始作業
                            </button>
                        </div>
                    </div>

                    {/* Product Card 2 */}
                    <div className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg transition-transform active:scale-[0.98]">
                        <div className="aspect-video w-full bg-slate-200 relative overflow-hidden">
                            <img
                                alt="Transmission Gasket"
                                className="h-full w-full object-cover"
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCcxbuWPbzdmnwvMt3IxFPCOnAUs-32n9Hvgli8mb4LWu-211rMiw6oxq6ykylOaPyNTJChjTDR02Ua0ucFz_IkvTsMtP-xZ-BxzmDThl5ESwSqqIcfWhZ5iOlQF8V7Wn6aaPZ86dS5HcWZ-e4DSa86X_rwxK_LU1ItSxHZUxtl2CxzjMeMstyCx5VpM2ly-IywMqGAoYDPXRJHfSSagwf0y5Z_YpyUqIJ7PhAMJPXMRV1UwemMBbuYRQNvxOiIb_Ek9v-QWatPZN0"
                            />
                            <div className="absolute top-3 right-3 bg-primary text-white px-3 py-1 rounded-full font-bold text-xs shadow-md">
                                在庫: 45
                            </div>
                        </div>
                        <div className="p-4">
                            <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-50 mb-1">變速箱墊片 (Gasket)</h3>
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4">品番: B-98765-XX</p>
                            <button
                                onClick={() => handleStartWork("變速箱墊片 (Gasket)", "B-98765-XX")}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-lg font-black text-white shadow-md hover:bg-primary/90 active:bg-primary/80 transition-colors"
                            >
                                <span className="material-symbols-outlined text-2xl">play_circle</span>
                                開始作業
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-6 pt-2 px-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-around max-w-lg mx-auto">
                    <a href="#" className="flex flex-col items-center gap-1 group">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                            <span className="material-symbols-outlined text-2xl">home</span>
                        </div>
                        <span className="text-xs font-bold text-primary">首頁</span>
                    </a>
                    <a href="#" className="flex flex-col items-center gap-1 group opacity-60">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400">
                            <span className="material-symbols-outlined text-2xl">history</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">歷史紀錄</span>
                    </a>
                    <a href="#" className="flex flex-col items-center gap-1 group opacity-60">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400">
                            <span className="material-symbols-outlined text-2xl">settings</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">個人設定</span>
                    </a>
                </div>
            </nav>
        </div>
    );
}
