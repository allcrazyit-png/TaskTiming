import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';

export default function Home() {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        carModel: '',
        partNumber: ''
    });

    // Fetch and parse CSV data
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch(import.meta.env.BASE_URL + 'products.csv');
                const csvText = await response.text();

                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        // Filter out empty or invalid rows if necessary
                        const validData = results.data.filter(item => item['車型'] && item['品番']);
                        setProducts(validData);
                        setLoading(false);
                    },
                    error: (error) => {
                        console.error('Error parsing CSV:', error);
                        setLoading(false);
                    }
                });
            } catch (error) {
                console.error('Error fetching CSV:', error);
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    const handleStartWork = (productName, partNumber) => {
        navigate('/input', { state: { productName, partNumber } });
    };

    // Extract unique filter options
    const uniqueCarModels = useMemo(() => {
        return [...new Set(products.map(p => p['車型']).filter(Boolean))].sort();
    }, [products]);

    const uniquePartNumbers = useMemo(() => {
        let filtered = products;
        if (filters.carModel) {
            filtered = filtered.filter(p => p['車型'] === filters.carModel);
        }
        return [...new Set(filtered.map(p => p['品番']).filter(Boolean))].sort();
    }, [products, filters.carModel]);

    // Filter products based on selection
    const filteredProducts = useMemo(() => {
        return products.filter(item => {
            const matchCar = !filters.carModel || item['車型'] === filters.carModel;
            const matchPart = !filters.partNumber || item['品番'] === filters.partNumber;
            return matchCar && matchPart;
        });
    }, [products, filters]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => {
            const newFilters = { ...prev, [key]: value };
            // Reset part number if car model changes
            if (key === 'carModel') {
                newFilters.partNumber = '';
            }
            return newFilters;
        });
    };

    // Helper to get image URL
    const getImageUrl = (filename) => {
        if (!filename) return null;
        return import.meta.env.BASE_URL + filename;
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
                            <select
                                value={filters.carModel}
                                onChange={(e) => handleFilterChange('carModel', e.target.value)}
                                className="block w-full h-12 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base font-medium focus:border-primary focus:ring-primary appearance-none disabled:opacity-50"
                                disabled={loading}
                            >
                                <option value="">{loading ? '載入中...' : '請點擊選擇車型'}</option>
                                {uniqueCarModels.map(model => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
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
                            <select
                                value={filters.partNumber}
                                onChange={(e) => handleFilterChange('partNumber', e.target.value)}
                                className="block w-full h-12 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base font-medium focus:border-primary focus:ring-primary appearance-none disabled:opacity-50"
                                disabled={loading || !filters.carModel}
                            >
                                <option value="">請點擊選擇品番</option>
                                {uniquePartNumbers.map(part => (
                                    <option key={part} value={part}>{part}</option>
                                ))}
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

                    {loading ? (
                        <div className="text-center py-12 text-slate-500">
                            <span className="material-symbols-outlined text-4xl animate-spin mb-2">progress_activity</span>
                            <p>資料讀取中...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                            <p>沒有找到符合的產品</p>
                        </div>
                    ) : (
                        filteredProducts.map((product, index) => (
                            <div key={`${product['品番']}-${index}`} className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg transition-transform active:scale-[0.98]">
                                <div className="aspect-video w-full bg-slate-200 relative overflow-hidden">
                                    {product['產品圖片'] ? (
                                        <img
                                            alt={product['品名']}
                                            className="h-full w-full object-cover"
                                            src={getImageUrl(product['產品圖片'])}
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = 'https://placehold.co/600x400?text=No+Image';
                                            }}
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                                            <span className="material-symbols-outlined text-4xl">image_not_supported</span>
                                        </div>
                                    )}
                                    <div className="absolute top-3 right-3 bg-primary text-white px-3 py-1 rounded-full font-bold text-xs shadow-md">
                                        在庫: {product['收容數'] || '-'}
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-50 mb-1">{product['品名']}</h3>
                                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4">品番: {product['品番']}</p>
                                    <button
                                        onClick={() => handleStartWork(product['品名'], product['品番'])}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-lg font-black text-white shadow-md hover:bg-primary/90 active:bg-primary/80 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-2xl">play_circle</span>
                                        開始作業
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
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
