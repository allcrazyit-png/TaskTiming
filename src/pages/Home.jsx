import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchTaskTimingEmployees, verifyTaskTimingEmployeePassword } from '../services/taskTimingEmployees';
import { fetchTaskTimingProducts } from '../services/taskTimingProducts';
import { formatLatestLocalUpload } from '../utils/localUploadStatus';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHcmD5yIdsLeDjE9b3O5zTW-Uygh_RdM6LdFG4gRdgqawouUNQJeq-La8zUJbltpHHYA/exec";

// GAS 實測：員工清單只有 684 bytes，卻要 1.7～62 秒，而且五次裡會失敗三次。
// 所以永遠不讓畫面等網路 —— 只要本機存過資料就直接畫出來，網路在背景慢慢更新。
// 刻意不設過期時間：員工名單幾個月才變一次，讓作業員每天早上重等一次 60 秒是最糟的選擇。
const CACHE_KEY_PRODUCTS = 'cache_products_v1';
const CACHE_KEY_EMPLOYEES = 'cache_employees_v1';

function readCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { data } = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) return null;
        return data;
    } catch {
        return null;
    }
}

function writeCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
    } catch (err) {
        // localStorage 滿了或無痕模式，忽略即可
        console.warn('Cache write failed:', key, err);
    }
}

function WeatherSvgIcon({ code }) {
    if (code === 0) {
        return (
            <svg className="home-weather-icon" viewBox="0 0 64 64" aria-hidden="true">
                <circle className="weather-sun" cx="32" cy="32" r="13" fill="#fbbf24" />
                <g stroke="#f59e0b" strokeWidth="4" strokeLinecap="round">
                    <path d="M32 8v8" />
                    <path d="M32 48v8" />
                    <path d="M8 32h8" />
                    <path d="M48 32h8" />
                    <path d="M15 15l6 6" />
                    <path d="M43 43l6 6" />
                    <path d="M49 15l-6 6" />
                    <path d="M21 43l-6 6" />
                </g>
            </svg>
        );
    }

    if (code <= 3) {
        return (
            <svg className="home-weather-icon" viewBox="0 0 64 64" aria-hidden="true">
                <circle className="weather-sun" cx="24" cy="24" r="11" fill="#fbbf24" />
                <path className="weather-cloud" d="M22 49h25c8 0 13-5 13-12s-6-12-13-12c-4-9-18-10-24-1-8 0-14 6-14 13s6 12 13 12z" fill="#dbeafe" stroke="#93c5fd" strokeWidth="3" />
            </svg>
        );
    }

    if (code <= 48) {
        return (
            <svg className="home-weather-icon" viewBox="0 0 64 64" aria-hidden="true">
                <path d="M15 23h35M9 34h47M16 45h37" fill="none" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
                <path className="weather-fog" d="M8 28h46M14 39h42M8 50h34" fill="none" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
            </svg>
        );
    }

    if (code >= 95) {
        return (
            <svg className="home-weather-icon" viewBox="0 0 64 64" aria-hidden="true">
                <path className="weather-cloud" d="M18 36h28c8 0 13-5 13-12s-6-12-13-12c-4-9-18-10-24-1-8 0-14 6-14 13s6 12 10 12z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="3" />
                <path className="weather-bolt" d="M35 35l-9 17h9l-5 10 16-20h-9l5-7z" fill="#facc15" />
                <path className="weather-rain" d="M20 47l-4 8" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                <path className="weather-rain weather-rain-delay" d="M49 47l-4 8" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
            </svg>
        );
    }

    if (code <= 67 || (code >= 80 && code <= 82)) {
        return (
            <svg className="home-weather-icon" viewBox="0 0 64 64" aria-hidden="true">
                <path className="weather-cloud" d="M18 38h28c8 0 13-5 13-12s-6-12-13-12c-4-9-18-10-24-1-8 0-14 6-14 13s6 12 10 12z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="3" />
                <path className="weather-rain" d="M22 46l-5 9" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                <path className="weather-rain weather-rain-delay" d="M34 46l-5 9" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                <path className="weather-rain weather-rain-delay-2" d="M46 46l-5 9" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
            </svg>
        );
    }

    return (
        <svg className="home-weather-icon" viewBox="0 0 64 64" aria-hidden="true">
            <path className="weather-cloud" d="M18 43h28c8 0 13-5 13-12s-6-12-13-12c-4-9-18-10-24-1-8 0-14 6-14 13s6 12 10 12z" fill="#dbeafe" stroke="#93c5fd" strokeWidth="3" />
        </svg>
    );
}

function WeatherInfo({ weather }) {
    const today = new Date();
    const dateText = `${today.toLocaleDateString('zh-TW')} (${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]})`;

    return (
        <div className="home-weather-strip">
            <WeatherSvgIcon code={weather?.code} />
            <div className="min-w-0 flex-1">
                <div className="text-sm font-black leading-tight text-slate-800 dark:text-slate-100">彰化埔鹽</div>
                <div className="mt-0.5 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                    {weather ? `${weather.desc} · ${dateText}` : `天氣載入中 · ${dateText}`}
                </div>
            </div>
            <div className="shrink-0 rounded-2xl bg-white px-3 py-1.5 text-xl font-black tabular-nums text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50">
                {weather ? `${weather.temp}°C` : '--°C'}
            </div>
        </div>
    );
}

export default function Home() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    console.log("VERSION 1.14.2 LOADED - Manual work entry redesign and UI improvements");
    const [products, setProducts] = useState(() => readCache(CACHE_KEY_PRODUCTS) || []);
    const [loading, setLoading] = useState(() => !readCache(CACHE_KEY_PRODUCTS));
    const [filters, setFilters] = useState({
        category: '',
        carModel: '',
        partNumber: ''
    });

    const [employees, setEmployees] = useState(() => readCache(CACHE_KEY_EMPLOYEES) || []);
    const [selectedOperator, setSelectedOperator] = useState('');
    const [operatorHistory, setOperatorHistory] = useState([]); // Added state for today's history
    const [favoriteProducts, setFavoriteProducts] = useState([]); // Store array of favorite `品番`
    const [weather, setWeather] = useState(null); // Local weather state

    // Custom Product Entry State
    const [customProductName, setCustomProductName] = useState('');

    // Password Modal State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [tempOperator, setTempOperator] = useState(null);
    const [passwordError, setPasswordError] = useState(false);
    const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

    // History Modal State
    const [showHistoryPopup, setShowHistoryPopup] = useState(false);

    // Settings Modal State
    const [showSettingsPopup, setShowSettingsPopup] = useState(false);
    const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'system'); // 'system', 'light', 'dark'
    const [fontSize, setFontSize] = useState(() => localStorage.getItem('appFontSize') || 'large'); // 'normal', 'large'

    // Custom Modal State
    const [showCustomModal, setShowCustomModal] = useState(false);

    // Filter Display State
    const [showFilter, setShowFilter] = useState(false);

    const [latestUploadStatus, setLatestUploadStatus] = useState(null);

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

    // Fetch homepage data
    // 三個來源各自獨立更新畫面，不互相等待：
    // 員工清單只有幾百 bytes，但產品表在 GAS 上要 10～30 秒。
    // 先前用 Promise.all 一起等，導致「請選擇您的名字」被最慢的產品請求卡住。
    useEffect(() => {
        // 1. 員工清單：由 Supabase 鏡像讀取。失敗時保留目前的 localStorage 快取。
        const employeeController = new AbortController();
        fetchTaskTimingEmployees({ signal: employeeController.signal })
            .then(employeeData => {
                setEmployees(employeeData);
                writeCache(CACHE_KEY_EMPLOYEES, employeeData);
            })
            .catch(error => console.warn('Supabase employee load failed; retaining local cache.', error));

        // 2. 產品表：由 Supabase 鏡像讀取。失敗時保留目前的 localStorage 快取。
        const productController = new AbortController();
        fetchTaskTimingProducts({ signal: productController.signal })
            .then(productData => {
                setProducts(productData);
                writeCache(CACHE_KEY_PRODUCTS, productData);
                console.log('Products loaded from Supabase:', productData.length);
            })
            .catch(error => console.warn('Supabase product load failed; retaining local cache.', error))
            .finally(() => setLoading(false));

        // 3. 天氣（純裝飾，失敗也無所謂）
        const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=23.9972&longitude=120.4638&current=temperature_2m,weather_code&timezone=Asia%2FTaipei';
        fetch(weatherUrl)
            .then(res => res.ok ? res.json() : null)
            .then(weatherData => {
                if (weatherData && weatherData.current) {
                    const code = weatherData.current.weather_code;
                    let icon = '☁️';
                    let desc = '多雲';
                    if (code === 0) { icon = '☀️'; desc = '晴天'; }
                    else if (code <= 3) { icon = '⛅️'; desc = '多雲時晴'; }
                    else if (code <= 48) { icon = '🌫️'; desc = '起霧'; }
                    else if (code <= 67 || (code >= 80 && code <= 82)) { icon = '🌧️'; desc = '下雨'; }
                    else if (code >= 95) { icon = '⚡️'; desc = '雷雨'; }

                    setWeather({
                        temp: Math.round(weatherData.current.temperature_2m),
                        icon,
                        desc,
                        code
                    });
                }
            })
            .catch(err => console.error('Weather Fetch Error:', err));

        return () => {
            employeeController.abort();
            productController.abort();
        };
    }, []);

    // 必須宣告在下面的 useEffect 之前，否則會有 TDZ 問題
    const loadOperatorHistory = (id) => {
        try {
            const historyKey = `uploadHistory_${id}`;
            const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
            setOperatorHistory(existingHistory);
            setLatestUploadStatus(formatLatestLocalUpload(existingHistory));
        } catch (e) {
            console.error(e);
            setLatestUploadStatus(null);
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

    // Restore session when employees are loaded
    useEffect(() => {
        if (employees.length > 0) {
            const savedOperatorId = localStorage.getItem('savedOperatorId');
            console.log("Restoring session, saved ID:", savedOperatorId);

            if (savedOperatorId) {
                // Use String() to compare because GAS returns numbers, localStorage saves strings
                const foundEmp = employees.find(emp => String(emp['員工編號']) === String(savedOperatorId));
                if (foundEmp) {
                    const operatorStr = `[${foundEmp['員工編號']}] ${foundEmp['姓名']}`;
                    console.log("Found employee, restoring:", operatorStr);
                    setSelectedOperator(operatorStr);
                    loadOperatorHistory(foundEmp['員工編號']);
                    loadOperatorFavorites(foundEmp['員工編號']);
                } else {
                    console.log("Saved ID not found in employee list");
                }
            }
        }
    }, [employees]);

    // Handle navigation state (e.g., from Battle Report)
    useEffect(() => {
        if (location.state?.openHistory && selectedOperator) {
            setShowHistoryPopup(true);
            // Clear state to avoid reopening on refresh
            window.history.replaceState({}, document.title);
        }
        if (location.state?.openSettings && selectedOperator) {
            setShowSettingsPopup(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, selectedOperator]);

    const selectEmployee = (emp) => {
        setTempOperator(emp);
        setPasswordInput('');
        setPasswordError(false);
        setShowPasswordModal(true);
    };

    const handleOperatorChange = (e) => {
        const value = e.target.value;
        if (!value) {
            setSelectedOperator('');
            setOperatorHistory([]);
            setLatestUploadStatus(null);
            setFavoriteProducts([]);
            localStorage.removeItem('savedOperatorId');
            return;
        }

        // Parse ID from value "[ID] Name"
        const match = value.match(/\[(.*?)\]/);
        if (match) {
            const id = match[1];
            // Use String() to compare because GAS returns numbers, localStorage saves strings
            const emp = employees.find(e => String(e['員工編號']) === String(id));
            if (emp) {
                selectEmployee(emp);
            }
        }
    };

    const toggleFavorite = (e, partNumber, category) => {
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
        const favKey = `${partNumber}|${category || ''}`;

        setFavoriteProducts(prev => {
            let newFavorites;
            if (prev.includes(favKey)) {
                // Remove
                newFavorites = prev.filter(pn => pn !== favKey);
            } else {
                // Add
                newFavorites = [...prev, favKey];
            }

            // Save immediately to local storage
            localStorage.setItem(favoritesKey, JSON.stringify(newFavorites));
            return newFavorites;
        });
    };

    const verifyPassword = async () => {
        if (!tempOperator || isVerifyingPassword) return;

        setIsVerifyingPassword(true);
        setPasswordError(false);
        try {
            await verifyTaskTimingEmployeePassword({
                employeeId: tempOperator['員工編號'],
                password: passwordInput,
            });
            const operatorStr = `[${tempOperator['員工編號']}] ${tempOperator['姓名']}`;
            setSelectedOperator(operatorStr);
            localStorage.setItem('savedOperatorId', tempOperator['員工編號']); // Save just the ID
            loadOperatorHistory(tempOperator['員工編號']); // Load history
            loadOperatorFavorites(tempOperator['員工編號']); // Load favorites
            setShowPasswordModal(false);
            setTempOperator(null);
        } catch {
            setPasswordError(true);
        } finally {
            setIsVerifyingPassword(false);
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
                productImage: product['產品圖片'], // Pass Product Image
                category: product['類別'] // Pass Category
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
                partNumber: "",
                carModel: "未指定",
                standardTime: 0,
                operator: selectedOperator,
                productImage: null,
                category: null
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
            const matchCat = !filters.category || item['類別'] === filters.category;
            const matchCar = !filters.carModel || item['車型'] === filters.carModel;
            const matchPart = !filters.partNumber || item['品番'] === filters.partNumber;
            return matchCat && matchCar && matchPart;
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

        const confirmLogout = window.confirm(t('confirm_logout'));
        if (confirmLogout) {
            const match = selectedOperator.match(/\[(.*?)\]/);
            if (match) {
                const operatorId = match[1];
                localStorage.removeItem(`favoriteProducts_${operatorId}`);
            }
            localStorage.removeItem('savedOperatorId');
            setSelectedOperator('');
            setOperatorHistory([]);
            setLatestUploadStatus(null);
            setFavoriteProducts([]);
            setShowSettingsPopup(false);
        }
    };

    // Helper to get category-specific colors
    const getCategoryStyles = (cat) => {
        switch (cat) {
            case '組裝': return 'bg-blue-600';
            case '包裝': return 'bg-amber-500';
            case '研磨': return 'bg-slate-600';
            case '檢查': return 'bg-emerald-600';
            case '噴漆': return 'bg-purple-600';
            default: return 'bg-black/60';
        }
    };

    const getCategoryBtnStyles = (cat) => {
        switch (cat) {
            case '包裝': return 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 border-amber-700';
            case '研磨': return 'bg-slate-600 hover:bg-slate-700 active:bg-slate-800 border-slate-900';
            case '檢查': return 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 border-emerald-900';
            case '噴漆': return 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 border-purple-900';
            default: return 'bg-primary hover:bg-primary/90 active:bg-primary/80 border-blue-800';
        }
    };

    const renderFavoriteCard = (product, index) => {
        return (
            <div
                key={`fav-${product['品番']}-${index}`}
                className="flex items-center gap-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-md active:scale-[0.98] transition-transform"
                onClick={() => handleStartWork(product)}
            >
                <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {product['產品圖片'] ? (
                        <img
                            alt={product['品名']}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            src={getImageUrl(product['產品圖片'])}
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/80x80?text=?'; }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined text-3xl">image_not_supported</span>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    {product['類別'] && (
                        <span className={`${getCategoryStyles(product['類別'])} text-white text-xs font-black px-2 py-0.5 rounded-full mb-1 inline-block`}>
                            {t(`cat_${product['類別']}`, product['類別'])}
                        </span>
                    )}
                    <p className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight line-clamp-2">{product['品名']}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{product['車型']}</p>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); handleStartWork(product); }}
                    className={`shrink-0 w-16 h-16 flex flex-col items-center justify-center rounded-2xl text-white shadow-md active:scale-90 transition-transform ${getCategoryBtnStyles(product['類別'])}`}
                >
                    <span className="material-symbols-outlined text-3xl">play_circle</span>
                    <span className="text-xs font-black mt-0.5">開始</span>
                </button>
            </div>
        );
    };

    const renderProductCard = (product, index, showImage = true) => {
        const favKey = `${product['品番']}|${product['類別'] || ''}`;
        const isFav = favoriteProducts.includes(favKey);

        // 緊湊清單模式 (無圖片)：節省頻寬，適合大量結果
        if (!showImage) {
            return (
                <div key={`product-${product['品番']}-${index}`}
                    className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm active:scale-[0.99] transition-transform"
                >
                    <button
                        onClick={(e) => toggleFavorite(e, product['品番'], product['類別'])}
                        className="shrink-0 text-primary"
                    >
                        <span className={`material-symbols-outlined text-[22px] ${isFav ? 'font-variation-fill text-red-500' : 'text-slate-300'}`}>favorite</span>
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">{product['品名']}</p>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{product['品番']}</p>
                    </div>
                    <button
                        onClick={() => handleStartWork(product)}
                        className={`shrink-0 flex items-center gap-1 text-white text-xs font-black px-3 py-2 rounded-lg shadow active:scale-95 transition-transform ${getCategoryBtnStyles(product['類別'])}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">play_circle</span>
                        {product['類別'] ? t('start_work_cat', { cat: t(`cat_${product['類別']}`) }) : t('start_work')}
                    </button>
                </div>
            );
        }

        // 完整卡片模式 (含圖片)
        return (
            <div key={`product-${product['品番']}-${index}`} className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg transition-transform active:scale-[0.98]">
                <div className="aspect-video w-full bg-slate-200 relative overflow-hidden">
                    {product['產品圖片'] ? (
                        <img
                            alt={product['品名']}
                            className="h-full w-full object-cover"
                            loading="lazy"
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
                    {/* Category Badge - Color Coded */}
                    {product['類別'] && (
                        <div className="absolute top-3 left-3">
                            <span className={`${getCategoryStyles(product['類別'])} backdrop-blur-md text-white px-3 py-1 rounded-full text-[12px] font-black border border-white/20 shadow-md flex items-center gap-1`}>
                                {t(`cat_${product['類別']}`, product['類別'])}
                            </span>
                        </div>
                    )}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                        <button
                            onClick={(e) => toggleFavorite(e, product['品番'], product['類別'])}
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
                        className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-lg font-black text-white shadow-md transition-colors ${getCategoryBtnStyles(product['類別'])}`}
                    >
                        <span className="material-symbols-outlined text-2xl">play_circle</span>
                        {product['類別'] ? t('start_work_cat', { cat: t(`cat_${product['類別']}`) }) : t('start_work')}
                    </button>
                </div>
            </div>
        );
    };

    // 未登入：顯示全版員工選擇畫面
    if (!selectedOperator) {
        return (
            <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
                {/* Password Modal（保留，供名字按鈕觸發） */}
                {showPasswordModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100 animate-bounceScale">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="material-symbols-outlined text-3xl text-primary">lock</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('enter_password_title')}</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {t('operator_label')} <span className="font-bold text-primary">{tempOperator?.['姓名']}</span>
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        className={`w-full h-14 text-center text-2xl font-bold tracking-widest rounded-xl border-2 bg-slate-50 dark:bg-slate-900 focus:outline-none transition-colors ${passwordError ? 'border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700 focus:border-primary'}`}
                                        placeholder={t('password_placeholder')}
                                        value={passwordInput}
                                        onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                                        onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                                        autoFocus
                                    />
                                    {passwordError && (
                                        <p className="text-red-500 text-sm font-bold text-center mt-2 animate-shake">
                                            {t('password_error')}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={verifyPassword}
                                    disabled={isVerifyingPassword}
                                    className="w-full h-14 bg-primary text-white rounded-xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
                                >
                                    {t('confirm_login')}
                                </button>
                                <button
                                    onClick={() => { setShowPasswordModal(false); setTempOperator(null); setPasswordInput(''); }}
                                    className="w-full h-12 text-slate-400 font-bold text-base hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Company Banner */}
                <div className="bg-slate-50 dark:bg-black text-slate-500 dark:text-slate-400 py-2 px-4 text-center font-bold text-[11px] border-b border-slate-200 dark:border-slate-800 tracking-[0.3em] uppercase">
                    瑞全企業股份有限公司
                </div>

                {/* Full-screen login body */}
                <div className="flex-1 flex flex-col px-6 pt-10 pb-8">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-4xl text-primary">groups</span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">請選擇您的名字</h1>
                        <p className="text-sm text-slate-500 mt-1">Select your name</p>
                    </div>

                    {employees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <span className="material-symbols-outlined text-5xl animate-spin mb-3">progress_activity</span>
                            <p className="font-bold">{t('loading_data')}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {employees.map((emp, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => selectEmployee(emp)}
                                    className="w-full h-16 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-black text-slate-800 dark:text-slate-100 text-left px-6 flex items-center gap-4 shadow-sm active:scale-[0.98] active:bg-slate-50 dark:active:bg-slate-700 transition-all"
                                >
                                    <span className="material-symbols-outlined text-2xl text-primary shrink-0">person</span>
                                    <span>{emp['姓名']}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

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
                                {t('operator_label')} <span className="font-bold text-primary">{tempOperator?.['姓名']}</span>
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
                                disabled={isVerifyingPassword}
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
                                    const displayDate = record.workDate || record.date || record.submitDate;
                                    let durationStr = null;
                                    if (record.startTime && record.endTime && record.startTime !== '--:--') {
                                        const [sh, sm] = record.startTime.split(':').map(Number);
                                        const [eh, em] = record.endTime.split(':').map(Number);
                                        const diff = (eh * 60 + em) - (sh * 60 + sm);
                                        if (diff > 0) durationStr = `${diff}分`;
                                    }
                                    return (
                                        <div key={index} className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-3 rounded-xl shadow-sm flex items-start gap-3">
                                            {/* Time block */}
                                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 flex flex-col items-center justify-center min-w-[80px] border border-blue-100 dark:border-blue-800/30 shrink-0 gap-0.5">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">開始</span>
                                                <span className="text-base font-black text-blue-600 dark:text-blue-400 tabular-nums leading-tight">{startStr}</span>
                                                <span className="material-symbols-outlined text-slate-300 text-sm">arrow_downward</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">結束</span>
                                                <span className="text-base font-black text-slate-700 dark:text-slate-200 tabular-nums leading-tight">{endStr}</span>
                                                {durationStr && (
                                                    <span className="mt-1 text-[11px] font-black text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{durationStr}</span>
                                                )}
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                    {record.carModel && (
                                                        <span className="bg-primary/10 text-primary dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded text-[11px] font-black tracking-wider shrink-0">
                                                            {record.carModel}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800/50 shrink-0">
                                                        {displayDate}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight mb-1">{record.productName}</p>
                                                <p className="text-xs font-bold text-slate-500 mb-2 bg-slate-100 dark:bg-slate-900 inline-block px-2 py-0.5 rounded-md">{record.partNumber}</p>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded-md flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-base">check_circle</span>
                                                        {t('good_count')} {record.goodCount} pcs
                                                    </span>
                                                    {record.totalScrap > 0 && (
                                                        <span className="text-sm font-black text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-md flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-base">cancel</span>
                                                            {t('scrap_count')} {record.totalScrap} pcs
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
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{latestUploadStatus || greetingSub}</p>
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
                                        <option key={idx} value={`[${emp['員工編號']}] ${emp['姓名']}`}>
                                            [{emp['員工編號']}] {emp['姓名']}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Date and Weather info (Only show when operator is selected to maintain focus) */}
                        {selectedOperator && (
                            <div className="mt-1 border-t border-slate-200/50 pt-3 dark:border-slate-700/50">
                                <WeatherInfo weather={weather} />
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 p-4 pb-24 space-y-6">

                {/* 常用產品（主要入口） */}
                {favoriteProducts.length > 0 ? (
                    <section className="space-y-4">
                        <h2 className="text-lg font-bold border-l-4 border-red-500 pl-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <span className="material-symbols-outlined text-red-500">favorite</span>
                            {t('favorites')}
                        </h2>
                        <div className="flex flex-col gap-4">
                            {products
                                .filter(p => favoriteProducts.includes(`${p['品番']}|${p['類別'] || ''}`))
                                .map((product, index) => renderFavoriteCard(product, index))}
                            {/* Add Manual Work Card */}
                            <div
                                onClick={() => {
                                    if (!selectedOperator) {
                                        alert(t('login_required_work') + " (Please select an operator first)");
                                        return;
                                    }
                                    setShowCustomModal(true);
                                }}
                                className="flex items-center justify-center gap-3 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 shadow-md active:scale-[0.98] transition-transform cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[100px]"
                            >
                                <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-500">add</span>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-slate-700 dark:text-slate-200">手動輸入工作</p>
                                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">臨時任務</p>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50 block">favorite_border</span>
                        <p className="font-bold text-base">尚未有常用產品</p>
                        <p className="text-sm mt-1">點擊產品的 ♡ 可加入常用</p>
                    </div>
                )}

                {/* 找其他產品（展開/收起篩選器） */}
                <button
                    onClick={() => setShowFilter(prev => !prev)}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold text-base active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
                >
                    <span className="material-symbols-outlined text-xl">{showFilter ? 'expand_less' : 'search'}</span>
                    {showFilter ? '收起搜尋' : '找其他產品'}
                </button>

                {/* 篩選器（展開時才顯示） */}
                {showFilter && (
                    <section className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                                {t('filter_car_model')}
                            </label>
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

                        <div className="space-y-3">
                            <h2 className="text-base font-bold border-l-4 border-primary pl-3 text-slate-800 dark:text-slate-100">{t('all_products')}</h2>
                            {loading ? (
                                <div className="text-center py-8 text-slate-500">
                                    <span className="material-symbols-outlined text-4xl animate-spin mb-2">progress_activity</span>
                                    <p>{t('loading_data')}</p>
                                </div>
                            ) : !filters.carModel ? (
                                <div className="text-center py-8 text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                    <span className="material-symbols-outlined text-5xl mb-3 opacity-30">directions_car</span>
                                    <p className="font-bold">{t('select_car_model_placeholder')}</p>
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                    <span className="material-symbols-outlined text-4xl mb-2 flex justify-center opacity-50">search_off</span>
                                    <p className="font-bold">{t('no_products_found')}</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {filteredProducts.map((product, index) => renderProductCard(product, index, false))}
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-6 pt-2 px-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-around max-w-lg mx-auto">
                    <button
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                            <span className="material-symbols-outlined text-2xl">home</span>
                        </div>
                        <span className="text-xs font-bold text-primary">{t('home_tab')}</span>
                    </button>
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
                        onClick={() => navigate('/battle')}
                        className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-2xl">bar_chart</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('battle_report_tab')}</span>
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

                            {/* Version Info */}
                            <div className="mt-4 pb-2 text-center">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 tracking-widest uppercase">
                                    Version 1.14.2
                                </p>
                                <p className="text-[9px] text-slate-300 dark:text-slate-700 mt-1">
                                    Built by Antigravity
                                </p>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Custom Work Modal */}
            {showCustomModal && selectedOperator && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100 animate-bounceScale">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="material-symbols-outlined text-3xl text-blue-600 dark:text-blue-400">edit</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('custom_work_input_title') || '手動輸入工作'}</h3>
                            <p className="text-sm text-slate-500 mt-1">{t('custom_work_input_desc') || '記錄清單外的臨時工作'}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">
                                    {t('custom_work_name_label') || '工作內容'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('custom_work_name_placeholder') || '例如：掃廁所、整理材料、清潔設備'}
                                    value={customProductName}
                                    onChange={(e) => setCustomProductName(e.target.value)}
                                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <button
                                onClick={handleStartCustomWork}
                                className="w-full mt-2 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 font-bold transition-colors"
                            >
                                <span className="material-symbols-outlined">play_circle</span>
                                {t('start_custom_work') || '開始工作'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCustomModal(false);
                                    setCustomProductName('');
                                }}
                                className="w-full h-10 text-slate-400 font-bold text-sm hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                {t('cancel') || '取消'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
