import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { useTranslation } from 'react-i18next';

export default function Home() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    console.log("VERSION 1.6 LOADED - i18n");
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
    const [weather, setWeather] = useState(null); // Local weather state

    // Custom Product Entry State
    const [isCustomProduct, setIsCustomProduct] = useState(false);
    const [customProductName, setCustomProductName] = useState('');
    const [customPartNumber, setCustomPartNumber] = useState('');

    // Password Modal State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [tempOperator, setTempOperator] = useState(null);
    const [passwordError, setPasswordError] = useState(false);

    // History Modal State
    const [showHistoryPopup, setShowHistoryPopup] = useState(false);

    // Settings Modal State
    const [showSettingsPopup, setShowSettingsPopup] = useState(false);
    const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'system'); // 'system', 'light', 'dark'
    const [fontSize, setFontSize] = useState(() => localStorage.getItem('appFontSize') || 'normal'); // 'normal', 'large'

    // Apply Theme
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else if (theme === 'light') {
            root.classList.remove('dark');
        } else {
            // System
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        }
        localStorage.setItem('appTheme', theme);
    }, [theme]);

    // Apply Font Size
    useEffect(() => {
        const root = document.documentElement;
        if (fontSize === 'large') {
            root.classList.add('text-large');
        } else {
            root.classList.remove('text-large');
        }
        localStorage.setItem('appFontSize', fontSize);
    }, [fontSize]);

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

        const fetchWeather = async () => {
            try {
                // Open-Meteo free API for Puyan, Changhua
                const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=23.9972&longitude=120.4638&current=temperature_2m,weather_code&timezone=Asia%2FTaipei');
                const data = await res.json();
                if (data && data.current) {
                    const code = data.current.weather_code;
                    let icon = '☁️';
                    let desc = '多雲';
                    if (code === 0) { icon = '☀️'; desc = '晴天'; }
                    else if (code <= 3) { icon = '⛅️'; desc = '多雲時晴'; }
                    else if (code <= 48) { icon = '🌫️'; desc = '起霧'; }
                    else if (code <= 67 || (code >= 80 && code <= 82)) { icon = '🌧️'; desc = '下雨'; }
                    else if (code >= 95) { icon = '⚡️'; desc = '雷雨'; }

                    setWeather({
                        temp: Math.round(data.current.temperature_2m),
                        icon,
                        desc
                    });
                }
            } catch (e) {
                console.error('Weather fetch error:', e);
            }
        };

        fetchData();
        fetchWeather();
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
            alert(t('login_required_fav') + "\nPlease log in first to use favorites.");
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
            alert(t('login_required_work') + " (Please select an operator first)");
            return;
        }

        navigate('/input', {
            state: {
                productName: product['品名'],
                partNumber: product['品番'],
                carModel: product['車型'],
                standardTime: product['CT時間(秒)'] || 0, // Pass Standard Time (updated header)
                operator: selectedOperator, // Pass Operator
                productImage: product['產品圖片'] // Pass Product Image
            }
        });
    };

    const handleStartCustomWork = () => {
        if (!selectedOperator) {
            alert(t('login_required_work') + " (Please select an operator first)");
            return;
        }

        if (!customProductName.trim()) {
            alert(t('login_required_custom') + " (Custom product name is required)");
            return;
        }

        // Scroll to top before navigating
        window.scrollTo(0, 0);

        navigate('/input', {
            state: {
                productName: customProductName.trim(),
                partNumber: customPartNumber.trim(),
                carModel: filters.carModel || '未指定',
                standardTime: 0,
                operator: selectedOperator,
                productImage: null
            }
        });
    };

    const toggleCustomProduct = () => {
        setIsCustomProduct(prev => !prev);
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

        const partMap = new Map();
        filtered.forEach(p => {
            if (p['品番'] && !partMap.has(p['品番'])) {
                partMap.set(p['品番'], p['品名'] || '');
            }
        });

        return Array.from(partMap.entries())
            .map(([partNumber, productName]) => ({ partNumber, productName }))
            .sort((a, b) => a.partNumber.localeCompare(b.partNumber));
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

    const handleLogoutAndClear = () => {
        if (!selectedOperator) return;

        const confirmClear = window.confirm(t('confirm_logout'));
        if (confirmClear) {
            const match = selectedOperator.match(/\[(.*?)\]/);
            if (match) {
                const operatorId = match[1];
                localStorage.removeItem(`favoriteProducts_${operatorId}`);
            }
            localStorage.removeItem('savedOperatorId');
            setSelectedOperator('');
            setOperatorHistory([]);
            setFavoriteProducts([]);
            setShowSettingsPopup(false);
        }
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
                        {t('part_number_label')} {product['品番']}
                    </p>
                    <button
                        onClick={() => handleStartWork(product)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-lg font-black text-white shadow-md hover:bg-primary/90 active:bg-primary/80 transition-colors"
                    >
                        <span className="material-symbols-outlined text-2xl">play_circle</span>
                        {t('start_work')}
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
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('enter_password_title')}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {t('operator_label')} <span className="font-bold text-primary">{tempOperator?.['作業者名稱']}</span>
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className={`w-full h-12 text-center text-xl font-bold tracking-widest rounded-xl border-2 bg-slate-50 dark:bg-slate-900 focus:outline-none transition-colors ${passwordError ? 'border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700 focus:border-primary'}`}
                                    placeholder={t('password_placeholder')}
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
                                        {t('password_error')}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={verifyPassword}
                                className="w-full h-12 bg-primary text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
                            >
                                {t('confirm_login')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setTempOperator(null);
                                    setPasswordInput('');
                                }}
                                className="w-full h-10 text-slate-400 font-bold text-sm hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                {t('cancel')}
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
                                {t('today_history')} ({operatorHistory.length})
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
                                    <p className="text-sm font-bold">{t('no_history')}</p>
                                    <p className="text-xs mt-1">{t('no_history_sub')}</p>
                                </div>
                            ) : (
                                operatorHistory.map((record, index) => {
                                    const startStr = record.startTime || '--:--';
                                    const endStr = record.endTime || new Date(record.submitTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                    return (
                                        <div key={index} className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-3 rounded-xl shadow-sm flex items-start gap-3">
                                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 flex flex-col items-center justify-center min-w-[72px] border border-blue-100 dark:border-blue-800/30 gap-0.5">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">開始</span>
                                                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 tracking-tight">{startStr}</span>
                                                </div>
                                                <span className="material-symbols-outlined text-[12px] text-slate-300">arrow_downward</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">結束</span>
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 tracking-tight">{endStr}</span>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight mb-1">{record.productName}</p>
                                                <p className="text-xs font-bold text-slate-500 mb-2 bg-slate-100 dark:bg-slate-900 inline-block px-2 py-0.5 rounded-md">{record.partNumber}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded-md flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                        {t('good_count')} {record.goodCount}
                                                    </span>
                                                    {record.totalScrap > 0 && (
                                                        <span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-md flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                                                            {t('scrap_count')} {record.totalScrap}
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

            {/* Company Banner */}
            <div className="bg-slate-50 dark:bg-black text-slate-500 dark:text-slate-400 py-2 px-4 text-center font-bold text-[11px] border-b border-slate-200 dark:border-slate-800 z-[60] relative tracking-[0.3em] uppercase">
                瑞全企業股份有限公司
            </div>
            {/* Header Section */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm relative z-40">
                {/* Combined Operator Selector & Personalized Greeting Card */}
                <div className={`transition-all duration-300 ${selectedOperator ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-primary/20' : ''} px-4 py-3`}>
                    <div className="flex flex-col gap-3">
                        {/* Row 1: Greeting & Operator Dropdown */}
                        <div className="flex justify-between items-start">
                            <div className="flex-1 mt-1">
                                {(() => {
                                    if (!selectedOperator) {
                                        return <h2 className="text-lg font-black text-slate-400 dark:text-slate-500 mb-1 tracking-wide">{t('login_operator')}</h2>;
                                    }
                                    const hour = new Date().getHours();
                                    const match = selectedOperator.match(/\]\s*(.*)$/);
                                    const name = match ? match[1] : '';
                                    let greetingTitle = '';
                                    let greetingSub = '';
                                    if (hour < 12) {
                                        greetingTitle = t('good_morning', { name });
                                        greetingSub = t('good_morning_sub');
                                    } else if (hour < 18) {
                                        greetingTitle = t('good_afternoon', { name });
                                        greetingSub = t('good_afternoon_sub');
                                    } else {
                                        greetingTitle = t('good_evening', { name });
                                        greetingSub = t('good_evening_sub');
                                    }
                                    return (
                                        <>
                                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-0.5 tracking-wide">{greetingTitle}</h2>
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{greetingSub}</p>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Operator Selector Dropdown */}
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm shrink-0 transition-colors ${selectedOperator ? 'bg-white/80 dark:bg-slate-800/80 border-white/50 dark:border-slate-700/50' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                <span className={`material-symbols-outlined text-lg ${selectedOperator ? 'text-primary' : 'text-slate-500'}`}>person</span>
                                <select
                                    value={selectedOperator}
                                    onChange={handleOperatorChange}
                                    className={`text-sm font-bold bg-transparent border-none focus:ring-0 p-0 cursor-pointer outline-none ${selectedOperator ? 'text-primary' : 'text-slate-500'}`}
                                >
                                    <option value="">{t('select_operator')}</option>
                                    {employees.map((emp, idx) => (
                                        <option key={idx} value={`[${emp['作業者編號']}] ${emp['作業者名稱']}`}>
                                            [{emp['作業者編號']}] {emp['作業者名稱']}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Date and Weather info (Only show when operator is selected to maintain focus) */}
                        {selectedOperator && (
                            <div className="flex gap-2.5 mt-1 border-t border-slate-200/50 dark:border-slate-700/50 pt-3">
                                <div className="flex items-center gap-1.5 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-xl border border-white/50 dark:border-white/5 shadow-sm">
                                    <span className="material-symbols-outlined text-blue-500 text-lg">calendar_today</span>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {new Date().toLocaleDateString('zh-TW')} ({['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()]})
                                    </span>
                                </div>

                                <div className="flex items-center gap-1.5 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-xl border border-white/50 dark:border-white/5 shadow-sm">
                                    <span className="material-symbols-outlined text-orange-500 text-lg">location_on</span>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">彰化埔鹽</span>
                                    {weather ? (
                                        <span className="text-sm font-black text-slate-800 dark:text-slate-200 ml-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md shadow-sm">
                                            {weather.icon} {weather.temp}°C
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-400 ml-1">載入中</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 p-4 pb-24">
                {/* Favorite Products Grid (Moved to Top) */}
                {favoriteProducts.length > 0 && selectedOperator && (
                    <div className="grid grid-cols-1 gap-6 mb-8 mt-2">
                        <h2 className="text-lg font-bold border-l-4 border-red-500 pl-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <span className="material-symbols-outlined text-red-500 font-variation-fill">favorite</span>
                            {t('favorites')}
                        </h2>
                        {products
                            .filter(p => favoriteProducts.includes(p['品番']))
                            .map((product, index) => renderProductCard(product, index, true))}
                    </div>
                )}

                {/* Filter Section */}
                <section className="space-y-4 mb-6">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                                {t('filter_car_model')}
                            </label>
                            <button
                                onClick={toggleCustomProduct}
                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${isCustomProduct
                                    ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800'
                                    : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    {isCustomProduct ? 'close' : 'add'}
                                </span>
                                {isCustomProduct ? t('custom_btn_cancel') : t('custom_btn_add')}
                            </button>
                        </div>
                        <div className="relative">
                            <select
                                value={filters.carModel}
                                onChange={(e) => handleFilterChange('carModel', e.target.value)}
                                className="block w-full h-12 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base font-medium focus:border-primary focus:ring-primary appearance-none disabled:opacity-50"
                                disabled={loading}
                            >
                                <option value="">{loading ? t('select_car_model_loading') : t('select_car_model_placeholder')}</option>
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
                            {t('filter_part_number')}
                        </label>
                        <div className="relative">
                            <select
                                value={filters.partNumber}
                                onChange={(e) => handleFilterChange('partNumber', e.target.value)}
                                className="block w-full h-12 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base font-medium focus:border-primary focus:ring-primary appearance-none disabled:opacity-50"
                                disabled={loading || !filters.carModel}
                            >
                                <option value="">{t('select_part_number_placeholder')}</option>
                                {uniquePartNumbers.map(({ partNumber, productName }) => (
                                    <option key={partNumber} value={partNumber}>
                                        {partNumber}{productName ? ` - ${productName}` : ''}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <span className="material-symbols-outlined text-2xl">expand_more</span>
                            </div>
                        </div>
                    </div>

                    {/* Custom Product Entry Rendering */}
                    {isCustomProduct && (
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl space-y-4 animate-fade-in">
                            <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                <span className="material-symbols-outlined">edit_square</span>
                                {t('custom_input_title')}
                            </h3>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">
                                    {t('custom_part_number_label')}
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('custom_part_number_placeholder')}
                                    value={customPartNumber}
                                    onChange={(e) => setCustomPartNumber(e.target.value)}
                                    className="w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">
                                    {t('custom_product_name_label')} <span className="text-red-500">{t('custom_product_name_req')}</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('custom_product_name_placeholder')}
                                    value={customProductName}
                                    onChange={(e) => setCustomProductName(e.target.value)}
                                    className="w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <button
                                onClick={handleStartCustomWork}
                                className="w-full mt-2 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 font-black text-lg active:scale-95 transition-transform"
                            >
                                <span className="material-symbols-outlined">play_circle</span>
                                {t('start_custom_work')}
                            </button>
                        </div>
                    )}
                </section>

                {/* Product Grid */}
                <div className="grid grid-cols-1 gap-6">
                    <h2 className="text-lg font-bold border-l-4 border-primary pl-3 text-slate-800 dark:text-slate-100">{t('all_products')}</h2>

                    {loading ? (
                        <div className="text-center py-12 text-slate-500">
                            <span className="material-symbols-outlined text-4xl animate-spin mb-2">progress_activity</span>
                            <p>{t('loading_data')}</p>
                        </div>
                    ) : !filters.carModel ? (
                        <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            <span className="material-symbols-outlined text-5xl mb-3 opacity-30">directions_car</span>
                            <p className="font-bold">{t('select_car_model_placeholder')}</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            <span className="material-symbols-outlined text-4xl mb-2 flex justify-center opacity-50">search_off</span>
                            <p className="font-bold">{t('no_products_found')}</p>
                            <p className="text-xs mt-1">{t('clear_filters_hint')}</p>
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
                        <span className="text-xs font-bold text-red-500">{t('home_tab')} v1.5</span>
                    </a>
                    <button
                        onClick={() => {
                            if (!selectedOperator) {
                                alert(t('login_required_history'));
                                return;
                            }
                            setShowHistoryPopup(true);
                        }}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-2xl">history</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('history_tab')}</span>
                    </button>
                    <button
                        onClick={() => {
                            if (!selectedOperator) {
                                alert(t('login_required_history'));
                                return;
                            }
                            setShowSettingsPopup(true);
                        }}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-2xl">settings</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('settings_tab')}</span>
                    </button>
                </div>
            </nav>

            {/* Settings Popup */}
            {showSettingsPopup && selectedOperator && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
                    <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl flex flex-col transform transition-all animate-[slideUp_0.3s_ease-out]">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-500">settings</span>
                                {t('settings_title')}
                            </h2>
                            <button
                                onClick={() => setShowSettingsPopup(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-5 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">

                            {/* Profile Section */}
                            <div className="flex flex-col items-center bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                                    <span className="material-symbols-outlined text-4xl text-primary">account_circle</span>
                                </div>
                                <div className="text-lg font-black text-slate-800 dark:text-white">
                                    {selectedOperator}
                                </div>
                                <div className="text-xs font-bold text-slate-500 mt-1 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                                    當前登入身分
                                </div>
                            </div>

                            {/* Appearance Preferences */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 pb-2">
                                    <span className="material-symbols-outlined text-[16px]">palette</span>
                                    {t('appearance')}
                                </h3>

                                <div className="space-y-2">
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                        <button
                                            onClick={() => setTheme('light')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">light_mode</span>
                                            {t('theme_light')}
                                        </button>
                                        <button
                                            onClick={() => setTheme('dark')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${theme === 'dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">dark_mode</span>
                                            {t('theme_dark')}
                                        </button>
                                        <button
                                            onClick={() => setTheme('system')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${theme === 'system' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">devices</span>
                                            {t('theme_system')}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('font_size')}</label>
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                        <button
                                            onClick={() => setFontSize('normal')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${fontSize === 'normal' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            {t('font_normal')}
                                        </button>
                                        <button
                                            onClick={() => setFontSize('large')}
                                            className={`flex-1 py-2 text-lg font-bold rounded-lg transition-colors ${fontSize === 'large' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            {t('font_large')}
                                        </button>
                                    </div>
                                </div>

                                {/* Language Switcher */}
                                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('language')}</label>
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                                        <button
                                            onClick={() => { i18n.changeLanguage('zh'); localStorage.setItem('appLanguage', 'zh'); }}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${i18n.language === 'zh' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            中文
                                        </button>
                                        <button
                                            onClick={() => { i18n.changeLanguage('vi'); localStorage.setItem('appLanguage', 'vi'); }}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${i18n.language === 'vi' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            Tiếng Việt
                                        </button>
                                        <button
                                            onClick={() => { i18n.changeLanguage('id'); localStorage.setItem('appLanguage', 'id'); }}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${i18n.language === 'id' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            Bahasa
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="space-y-4 pt-4 mt-2 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold text-red-500 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">warning</span>
                                    {t('danger_zone')}
                                </h3>
                                <button
                                    onClick={handleLogoutAndClear}
                                    className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800/30 font-bold py-3 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-[0.98] transition-all"
                                >
                                    <span className="material-symbols-outlined">delete_forever</span>
                                    {t('logout')}
                                </button>
                                <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                                    如果您要更換崗位或是給其他人使用此裝置，請點擊上方按鈕。
                                </p>
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
