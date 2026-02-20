import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';

export default function Home() {
    const navigate = useNavigate();
    console.log("VERSION 1.4 LOADED");
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        carModel: '',
        partNumber: ''
    });

    const [employees, setEmployees] = useState([]);
    const [selectedOperator, setSelectedOperator] = useState('');
    const [operatorHistory, setOperatorHistory] = useState([]); // Added state for today's history
    const [favoriteProducts, setFavoriteProducts] = useState([]); // Store array of favorite `品番`

    // Password Modal State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [tempOperator, setTempOperator] = useState(null);
    const [passwordError, setPasswordError] = useState(false);

    // History Modal State
    const [showHistoryPopup, setShowHistoryPopup] = useState(false);

    // Fetch and parse CSV data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Products
                const productRes = await fetch(import.meta.env.BASE_URL + 'products.csv');
                const productText = await productRes.text();

                Papa.parse(productText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const validData = results.data.filter(item => item['車型'] && item['品番']);
                        setProducts(validData);
                    },
                    error: (err) => console.error('Product CSV Error:', err)
                });

                // Fetch Employees
                const employeeRes = await fetch(import.meta.env.BASE_URL + '員工代號及姓名.csv');
                const employeeText = await employeeRes.text();

                Papa.parse(employeeText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        // Assuming columns: 作業者編號, 作業者名稱, 密碼
                        const validEmployees = results.data.filter(item => item['作業者名稱']);
                        setEmployees(validEmployees);
                    },
                    error: (err) => console.error('Employee CSV Error:', err)
                });

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Restore session when employees are loaded
    useEffect(() => {
        if (employees.length > 0) {
            const savedOperatorId = localStorage.getItem('savedOperatorId');
            console.log("Restoring session, saved ID:", savedOperatorId);

            if (savedOperatorId) {
                const foundEmp = employees.find(emp => emp['作業者編號'] === savedOperatorId);
                if (foundEmp) {
                    const operatorStr = `[${foundEmp['作業者編號']}] ${foundEmp['作業者名稱']}`;
                    console.log("Found employee, restoring:", operatorStr);
                    setSelectedOperator(operatorStr);
                    loadOperatorHistory(foundEmp['作業者編號']); // Load history on startup
                    loadOperatorFavorites(foundEmp['作業者編號']); // Load favorites on startup
                } else {
                    console.log("Saved ID not found in employee list");
                }
            }
        }
    }, [employees]);

    const handleOperatorChange = (e) => {
        const value = e.target.value;
        if (!value) {
            setSelectedOperator('');
            setOperatorHistory([]); // Clear history displayed
            setFavoriteProducts([]); // Clear favorites displayed
            localStorage.removeItem('savedOperatorId'); // Clear saved session
            return;
        }

        // Parse ID from value "[ID] Name"
        const match = value.match(/\[(.*?)\]/);
        if (match) {
            const id = match[1];
            const emp = employees.find(e => e['作業者編號'] === id);
            if (emp) {
                setTempOperator(emp);
                setPasswordInput('');
                setPasswordError(false);
                setShowPasswordModal(true);
            }
        }
    };

    const loadOperatorHistory = (id) => {
        try {
            const historyKey = `uploadHistory_${id}`;
            const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
            const todayStr = new Date().toLocaleDateString();
            const todaysRecords = existingHistory.filter(record => record.submitDate === todayStr);
            setOperatorHistory(todaysRecords);
        } catch (e) {
            console.error(e);
        }
    };

    const loadOperatorFavorites = (id) => {
        try {
            const favoritesKey = `favoriteProducts_${id}`;
            const existingFavorites = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
            setFavoriteProducts(existingFavorites);
        } catch (e) {
            console.error(e);
        }
    };

    const toggleFavorite = (e, partNumber) => {
        e.stopPropagation(); // Prevent product card click if overlapping
        if (!selectedOperator) {
            alert("請先登入才能將產品加入我的最愛！\nPlease log in first to use favorites.");
            return;
        }

        // Get actual ID from current selected operator
        const match = selectedOperator.match(/\[(.*?)\]/);
        if (!match) return;
        const operatorId = match[1];
        const favoritesKey = `favoriteProducts_${operatorId}`;

        setFavoriteProducts(prev => {
            let newFavorites;
            if (prev.includes(partNumber)) {
                // Remove
                newFavorites = prev.filter(pn => pn !== partNumber);
            } else {
                // Add
                newFavorites = [...prev, partNumber];
            }

            // Save immediately to local storage
            localStorage.setItem(favoritesKey, JSON.stringify(newFavorites));
            return newFavorites;
        });
    };

    const verifyPassword = () => {
        if (!tempOperator) return;

        // Default to ID if no password set, otherwise compare
        const correctPassword = tempOperator['密碼'] || tempOperator['作業者編號'];

        if (passwordInput === correctPassword) {
            const operatorStr = `[${tempOperator['作業者編號']}] ${tempOperator['作業者名稱']}`;
            setSelectedOperator(operatorStr);
            localStorage.setItem('savedOperatorId', tempOperator['作業者編號']); // Save just the ID
            loadOperatorHistory(tempOperator['作業者編號']); // Load history
            loadOperatorFavorites(tempOperator['作業者編號']); // Load favorites
            setShowPasswordModal(false);
            setTempOperator(null);
        } else {
            setPasswordError(true);
        }
    };

    const handleStartWork = (product) => {
        if (!selectedOperator) {
            alert("請先選擇作業者！ (Please select an operator first)");
            return;
        }

        navigate('/input', {
            state: {
                productName: product['品名'],
                partNumber: product['品番'],
                carModel: product['車型'],
                standardTime: product['標準組裝秒數'] || 0, // Pass Standard Time
                operator: selectedOperator // Pass Operator
            }
        });
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

    const renderProductCard = (product, index, isFavoriteList = false) => {
        const isFav = favoriteProducts.includes(product['品番']);
        return (
            <div key={`product-${product['品番']}-${index}`} className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg transition-transform active:scale-[0.98]">
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
                        <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
                            <span className="material-symbols-outlined text-4xl">image_not_supported</span>
                        </div>
                    )}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                        <button
                            onClick={(e) => toggleFavorite(e, product['品番'])}
                            className="bg-white/90 dark:bg-slate-900/90 backdrop-blur text-primary p-1.5 rounded-full shadow-md hover:scale-110 active:scale-95 transition-transform"
                        >
                            <span className={`material-symbols-outlined text-[20px] ${isFav ? 'font-variation-fill text-red-500' : 'text-slate-400'}`}>favorite</span>
                        </button>
                    </div>
                </div>
                <div className="p-4">
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-50 mb-1">{product['品名']}</h3>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">label</span>
                        品番: {product['品番']}
                    </p>
                    <button
                        onClick={() => handleStartWork(product)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-lg font-black text-white shadow-md hover:bg-primary/90 active:bg-primary/80 transition-colors"
                    >
                        <span className="material-symbols-outlined text-2xl">play_circle</span>
                        開始作業
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100 animate-bounceScale">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="material-symbols-outlined text-3xl text-primary">lock</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">請輸入密碼</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                作業者: <span className="font-bold text-primary">{tempOperator?.['作業者名稱']}</span>
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className={`w-full h-12 text-center text-xl font-bold tracking-widest rounded-xl border-2 bg-slate-50 dark:bg-slate-900 focus:outline-none transition-colors ${passwordError ? 'border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700 focus:border-primary'}`}
                                    placeholder="請輸入密碼"
                                    value={passwordInput}
                                    onChange={(e) => {
                                        setPasswordInput(e.target.value);
                                        setPasswordError(false);
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                                    autoFocus
                                />
                                {passwordError && (
                                    <p className="text-red-500 text-xs font-bold text-center mt-2 animate-shake">
                                        密碼錯誤，請重新輸入
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={verifyPassword}
                                className="w-full h-12 bg-primary text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
                            >
                                確認登入
                            </button>
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setTempOperator(null);
                                    setPasswordInput('');
                                }}
                                className="w-full h-10 text-slate-400 font-bold text-sm hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Popup */}
            {showHistoryPopup && selectedOperator && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
                    <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl flex flex-col h-[80vh] sm:h-[600px] overflow-hidden transform transition-all animate-[slideUp_0.3s_ease-out]">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500">history</span>
                                本日上傳紀錄 ({operatorHistory.length})
                            </h2>
                            <button
                                onClick={() => setShowHistoryPopup(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                            {operatorHistory.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 m-auto w-full">
                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                                    <p className="text-sm font-bold">今日尚無上傳紀錄</p>
                                    <p className="text-xs mt-1">作業完成後，紀錄會顯示在這裡</p>
                                </div>
                            ) : (
                                operatorHistory.map((record, index) => {
                                    const timeStr = new Date(record.submitTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                    return (
                                        <div key={index} className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-3 rounded-xl shadow-sm flex items-start gap-3">
                                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 flex flex-col items-center justify-center min-w-[50px] border border-blue-100 dark:border-blue-800/30">
                                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Done</span>
                                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{timeStr.slice(0, 5)}</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight mb-1">{record.productName}</p>
                                                <p className="text-xs font-bold text-slate-500 mb-2 bg-slate-100 dark:bg-slate-900 inline-block px-2 py-0.5 rounded-md">{record.partNumber}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded-md flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                        良品 {record.goodCount}
                                                    </span>
                                                    {record.totalScrap > 0 && (
                                                        <span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-md flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                                                            報廢 {record.totalScrap}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold tracking-tight text-primary">瑞全企業股份有限公司</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="material-symbols-outlined text-slate-500 text-lg">person</span>
                            {/* Operator Selector in Header */}
                            <select
                                value={selectedOperator}
                                onChange={handleOperatorChange}
                                className="text-sm font-semibold text-slate-600 dark:text-slate-400 bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
                            >
                                <option value="">選擇作業者 (Select Operator)</option>
                                {employees.map((emp, idx) => (
                                    <option key={idx} value={`[${emp['作業者編號']}] ${emp['作業者名稱']}`}>
                                        [{emp['作業者編號']}] {emp['作業者名稱']}
                                    </option>
                                ))}
                            </select>
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

                {/* Favorite Products Grid */}
                {favoriteProducts.length > 0 && selectedOperator && (
                    <div className="grid grid-cols-1 gap-6 mb-8 mt-2">
                        <h2 className="text-lg font-bold border-l-4 border-red-500 pl-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <span className="material-symbols-outlined text-red-500 font-variation-fill">favorite</span>
                            我的最愛
                        </h2>
                        {products
                            .filter(p => favoriteProducts.includes(p['品番']))
                            .map((product, index) => renderProductCard(product, index, true))}
                    </div>
                )}

                {/* Product Grid */}
                <div className="grid grid-cols-1 gap-6">
                    <h2 className="text-lg font-bold border-l-4 border-primary pl-3 text-slate-800 dark:text-slate-100">全部產品目錄</h2>

                    {loading ? (
                        <div className="text-center py-12 text-slate-500">
                            <span className="material-symbols-outlined text-4xl animate-spin mb-2">progress_activity</span>
                            <p>資料讀取中...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            <span className="material-symbols-outlined text-4xl mb-2 flex justify-center opacity-50">search_off</span>
                            <p className="font-bold">沒有找到符合的產品</p>
                            <p className="text-xs mt-1">請嘗試清除篩選條件</p>
                        </div>
                    ) : (
                        filteredProducts.map((product, index) => renderProductCard(product, index))
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
                        <span className="text-xs font-bold text-red-500">首頁 v1.4 (歷史版)</span>
                    </a>
                    <button
                        onClick={() => {
                            if (!selectedOperator) {
                                alert("請先選擇並登入作業員！\nPlease log in first to view your history.");
                                return;
                            }
                            setShowHistoryPopup(true);
                        }}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-2xl">history</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">歷史紀錄</span>
                    </button>
                    <a href="#" className="flex flex-col items-center gap-1 group opacity-60">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400">
                            <span className="material-symbols-outlined text-2xl">settings</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">個人設定</span>
                    </a>
                </div>
            </nav >
        </div >
    );
}
