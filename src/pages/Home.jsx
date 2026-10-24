import BuddyPicker from '../components/BuddyPicker';
import HeaderThemePicker from '../components/HeaderThemePicker';
import useHeaderTheme from '../hooks/useHeaderTheme';
import HalloweenAccent, { PumpkinAccent } from '../components/HalloweenAccent';
import TenureHonor from '../components/TenureHonor';
import useEmployeeProfile from '../hooks/useEmployeeProfile';
import FactoryBuddy from '../components/FactoryBuddy';
import ProductImagePreview from '../components/ProductImagePreview';
import useNoticeInbox from '../hooks/useNoticeInbox';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    clearTaskTimingSession,
    fetchTaskTimingEmployees,
    getTaskTimingAccessToken,
    readTaskTimingSession,
    saveTaskTimingSession,
    verifyTaskTimingEmployeePassword,
} from '../services/taskTimingEmployees';
import { fetchTaskTimingProducts } from '../services/taskTimingProducts';
import { formatLatestLocalUpload } from '../utils/localUploadStatus';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHcmD5yIdsLeDjE9b3O5zTW-Uygh_RdM6LdFG4gRdgqawouUNQJeq-La8zUJbltpHHYA/exec";

const CACHE_KEY_PRODUCTS = 'cache_products_v1';
const CACHE_KEY_EMPLOYEES = 'cache_employees_v1';
const MASTER_CACHE_TTL = 10 * 60 * 1000;

function isCacheFresh(key) {
    try {
        const { at, data } = JSON.parse(localStorage.getItem(key) || 'null') || {};
        const age = Date.now() - at;
        return Array.isArray(data) && Number.isFinite(at) && age >= 0 && age < MASTER_CACHE_TTL;
    } catch { return false; }
}

function readCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { data } = JSON.parse(raw);
        if (!Array.isArray(data)) return null;
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

function HomeDate() {
    const { i18n } = useTranslation();
    const locale = { zh: 'zh-TW', vi: 'vi-VN', id: 'id-ID' }[i18n.resolvedLanguage] || 'zh-TW';
    const today = new Date();
    const dateText = today.toLocaleDateString(locale, { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', weekday: 'short' });
    return <time className="shrink-0 text-sm font-normal text-slate-500 dark:text-slate-400">{dateText}</time>;
}

export default function Home() {
    const { theme: headerTheme, animated: headerAnimated } = useHeaderTheme();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    console.log("VERSION 1.25.1 LOADED - Supabase production records and battle report");
    const [products, setProducts] = useState(() => readCache(CACHE_KEY_PRODUCTS) || []);
    const [loading, setLoading] = useState(() => !readCache(CACHE_KEY_PRODUCTS));
    const [filters, setFilters] = useState({
        category: '',
        carModel: '',
        partNumber: ''
    });

    const [employees, setEmployees] = useState(() => readCache(CACHE_KEY_EMPLOYEES) || []);
    const [selectedOperator, setSelectedOperator] = useState('');
    const noticeEmployeeId = selectedOperator.match(/\[(.*?)\]/)?.[1] || '';
    const { unreadCount } = useNoticeInbox(noticeEmployeeId);
    const [operatorHistory, setOperatorHistory] = useState([]); // Added state for today's history
    const [favoriteProducts, setFavoriteProducts] = useState([]); // Store array of favorite `品番`
    const [favoriteToRemove, setFavoriteToRemove] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

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
    const employeeProfile = useEmployeeProfile(noticeEmployeeId, showSettingsPopup);
    const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'system'); // 'system', 'light', 'dark'
    const [fontSize, setFontSize] = useState(() => localStorage.getItem('appFontSize') || 'large'); // 'normal', 'large'

    // Custom Modal State
    const [showCustomModal, setShowCustomModal] = useState(false);

    // Filter Display State
    const [showFilter, setShowFilter] = useState(false);

    const [latestUploadStatus, setLatestUploadStatus] = useState(null);
    const [masterRefresh, setMasterRefresh] = useState(0);
    const [masterBusy, setMasterBusy] = useState(false);
    const [masterStatus, setMasterStatus] = useState('');

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

    // Fresh local master data avoids a request on every return from reporting.
    useEffect(() => {
        let active = true;
        const employeeController = new AbortController();
        const productController = new AbortController();
        const refresh = (key, fetcher, setter, controller) => {
            if (!masterRefresh && isCacheFresh(key)) return Promise.resolve();
            return fetcher({ signal: controller.signal }).then(data => {
                if (!active) return;
                setter(data);
                writeCache(key, data);
            });
        };
        setMasterBusy(true);
        setMasterStatus('');
        Promise.allSettled([
            refresh(CACHE_KEY_EMPLOYEES, fetchTaskTimingEmployees, setEmployees, employeeController),
            refresh(CACHE_KEY_PRODUCTS, fetchTaskTimingProducts, setProducts, productController),
        ]).then(results => {
            if (!active) return;
            results.forEach(result => {
                if (result.status === 'rejected') console.warn('Master data refresh failed; retaining cache.', result.reason);
            });
            setMasterStatus(results.some(result => result.status === 'rejected') ? 'data_refresh_failed' : 'data_refresh_done');
            setMasterBusy(false);
            setLoading(false);
        });
        return () => {
            active = false;
            employeeController.abort();
            productController.abort();
        };
    }, [masterRefresh]);

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

    // Restore the selected employee immediately; a temporary refresh failure
    // must not erase the saved login or make the operator choose their name.
    useEffect(() => {
        let cancelled = false;
        const restoreOperator = () => {
            if (employees.length > 0) {
                const savedOperatorId = localStorage.getItem('savedOperatorId');
                console.log("Restoring session, saved ID:", savedOperatorId);

                if (savedOperatorId) {
                    const session = readTaskTimingSession();
                    if (!session || String(session.employeeId) !== String(savedOperatorId)) {
                        localStorage.removeItem('savedOperatorId');
                        clearTaskTimingSession();
                        return;
                    }
                    // Use String() to compare because GAS returns numbers, localStorage saves strings
                    const foundEmp = employees.find(emp => String(emp['員工編號']) === String(savedOperatorId));
                    if (foundEmp && !cancelled) {
                        const operatorStr = `[${foundEmp['員工編號']}] ${foundEmp['姓名']}`;
                        console.log("Found employee, restoring:", operatorStr);
                        setSelectedOperator(operatorStr);
                        loadOperatorHistory(foundEmp['員工編號']);
                        loadOperatorFavorites(foundEmp['員工編號']);
                        getTaskTimingAccessToken().catch(error => {
                            // Only a definitely rejected refresh needs another password.
                            // Keep the selected name and session on network/server errors.
                            if (error.message !== 'Employee login expired' || cancelled) return;
                            if (localStorage.getItem('savedOperatorId') !== String(savedOperatorId)) return;
                            const activeSession = readTaskTimingSession();
                            if (activeSession && activeSession.refreshToken !== session.refreshToken) return;
                            setSelectedOperator('');
                            setTempOperator(foundEmp);
                            setPasswordInput('');
                            setPasswordError(false);
                            setShowPasswordModal(true);
                        });
                    } else {
                        console.log("Saved ID not found in employee list");
                    }
                }
            }
        };
        restoreOperator();
        return () => { cancelled = true; };
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
        if (selectedOperator) return;
        const value = e.target.value;
        if (!value) {
            setSelectedOperator('');
            setOperatorHistory([]);
            setLatestUploadStatus(null);
            setFavoriteProducts([]);
            localStorage.removeItem('savedOperatorId');
            clearTaskTimingSession();
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

    const confirmFavoriteRemoval = (e) => {
        if (!favoriteToRemove) return;
        toggleFavorite(e, favoriteToRemove['品番'], favoriteToRemove['類別']);
        setFavoriteToRemove(null);
    };

    const verifyPassword = async () => {
        if (!tempOperator || isVerifyingPassword) return;

        setIsVerifyingPassword(true);
        setPasswordError(false);
        try {
            const session = await verifyTaskTimingEmployeePassword({
                employeeId: tempOperator['員工編號'],
                password: passwordInput,
            });
            saveTaskTimingSession(session);
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
            localStorage.removeItem('savedOperatorId');
            clearTaskTimingSession();
            setSelectedOperator('');
            setOperatorHistory([]);
            setLatestUploadStatus(null);
            setFavoriteProducts([]);
            setTempOperator(null);
            setPasswordInput('');
            setPasswordError(false);
            setShowPasswordModal(false);
            setShowSettingsPopup(false);
            navigate('/', { replace: true, state: null });
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
                className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-md active:scale-[0.98] transition-transform"
                onClick={() => handleStartWork(product)}
            >
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="shrink-0 w-28 h-24 sm:w-36 sm:h-28 rounded-xl overflow-hidden bg-white">
                        {product['產品圖片'] ? (
                            <button
                                type="button"
                                className="block h-full min-h-16 w-full cursor-zoom-in focus-visible:ring-4 focus-visible:ring-primary"
                                aria-label={t('enlarge_photo', { name: product['品名'] })}
                                onClick={(event) => { event.stopPropagation(); setImagePreview(product); }}
                                >
                                <img
                                alt={product['品名']}
                                className="w-full h-full object-contain"
                                loading="lazy"
                                src={getImageUrl(product['產品圖片'])}
                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/80x80?text=?'; }}
                            />
                                </button>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-3xl">image_not_supported</span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        {product['類別'] && (
                            <span className={`${getCategoryStyles(product['類別'])} text-white text-sm leading-none h-5 font-bold px-2 rounded-full mb-1 inline-flex items-center`}>
                                {t(`cat_${product['類別']}`, product['類別'])}
                            </span>
                        )}
                        <p className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight break-words">{product['品名']}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{product['車型']}</p>
                    </div>
                </div>
                <div className="mt-3 flex gap-3">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleStartWork(product); }}
                        className={`min-h-16 min-w-0 flex-1 rounded-2xl text-base font-black text-white shadow-md active:scale-[0.98] transition-transform focus-visible:ring-4 focus-visible:ring-primary ${getCategoryBtnStyles(product['類別'])}`}
                    >
                        {t('start_favorite')}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFavoriteToRemove(product); }}
                        aria-label={`${t('remove_favorite')}：${product['品名']}`}
                        className="flex min-h-16 min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl border-2 border-red-300 px-1 text-base font-black leading-tight text-red-700 dark:border-red-400 dark:text-red-300 active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-primary"
                    >
                        <span className="material-symbols-outlined text-xl font-variation-fill" aria-hidden="true">favorite</span>
                        <span>{t('remove_favorite')}</span>
                    </button>
                </div>
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
                        <button
                            type="button"
                            className="block h-full min-h-16 w-full cursor-zoom-in focus-visible:ring-4 focus-visible:ring-primary"
                            aria-label={t('enlarge_photo', { name: product['品名'] })}
                            onClick={(event) => { event.stopPropagation(); setImagePreview(product); }}
                            >
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
                            </button>
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
            {favoriteToRemove && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="remove-favorite-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-5 text-center">
                            <span className="material-symbols-outlined mb-2 text-4xl text-red-500" aria-hidden="true">heart_minus</span>
                            <h2 id="remove-favorite-title" className="text-xl font-black text-slate-900 dark:text-white">{t('remove_favorite_confirm_title')}</h2>
                            <p className="mt-3 break-words text-base font-bold text-slate-700 dark:text-slate-200">{favoriteToRemove['品名']}</p>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('remove_favorite_hint')}</p>
                        </div>
                        <div className="space-y-3">
                            <button type="button" onClick={() => setFavoriteToRemove(null)} className="min-h-16 w-full rounded-xl border-2 border-slate-300 text-base font-black text-slate-700 dark:border-slate-600 dark:text-slate-100">
                                {t('cancel')}
                            </button>
                            <button type="button" onClick={confirmFavoriteRemoval} className="min-h-16 w-full rounded-xl bg-red-600 text-base font-black text-white active:bg-red-700">
                                {t('remove_favorite')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
                                aria-label={t('close')} className="w-16 h-16 shrink-0 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
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

            {/* Header Section */}
            <header className={`${headerTheme !== 'classic' ? `halloween-header theme-${headerTheme}` : ''} bg-background-light dark:bg-background-dark border-b border-slate-200 dark:border-slate-800 relative z-40`}>
                {selectedOperator && headerTheme !== 'classic' && <HalloweenAccent theme={headerTheme} animated={headerAnimated} />}
                {/* Combined Operator Selector & Personalized Greeting Card */}
                <div className="home-header-content px-4 py-2">
                    <div className="flex flex-col">
                        {/* Row 1: Greeting & Operator Dropdown */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="home-greeting-group flex min-w-0 flex-1 items-center gap-1">
                                {selectedOperator && <div className="halloween-buddy"><FactoryBuddy align="start" employeeId={noticeEmployeeId} />{headerTheme !== 'classic' && <PumpkinAccent theme={headerTheme} />}</div>}
                                <div className="min-w-0">
                                    <p className="mb-1 text-[11px] font-medium leading-snug tracking-wide text-slate-500 dark:text-slate-400">瑞全企業股份有限公司</p>
                                    {(() => {
                                        if (!selectedOperator) {
                                            return <h2 className="text-lg font-black text-slate-400 dark:text-slate-500 tracking-wide">{t('login_operator')}</h2>;
                                        }
                                        const hour = new Date().getHours();
                                        const greetingKey = hour < 12 ? 'buddy_home_morning' : hour < 18 ? 'buddy_home_afternoon' : 'buddy_home_evening';
                                        return (
                                            <>
                                                <h2 className="home-greeting break-words text-sm font-bold text-slate-700 dark:text-slate-200">{t(greetingKey)}</h2>
                                                {latestUploadStatus && (
                                                    <p className="mt-0.5 break-words text-sm font-bold text-slate-500 dark:text-slate-400">
                                                        {t(latestUploadStatus.isToday ? 'latest_upload_today' : 'latest_upload_day', latestUploadStatus)}
                                                    </p>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Operator identity and logged-out employee selection */}
                            <div className="relative min-w-0 max-w-[48%] shrink-0">
                                {selectedOperator ? (
                                    <button type="button" onClick={() => setShowSettingsPopup(true)} className="flex min-h-16 items-center gap-2 rounded-xl px-1 text-base font-bold text-slate-800 dark:text-slate-100 focus-visible:ring-2 focus-visible:ring-primary" aria-label={`${selectedOperator} · ${t('settings_title')}`}>
                                        <TenureHonor compact hireDate={employeeProfile.data?.['到職日']} />
                                        <span className="min-w-0 break-words text-left text-base font-bold leading-snug">{selectedOperator.replace(/^\[[^\]]*\]\s*/, '')}</span>
                                    </button>
                                ) : <>
                                <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2"><TenureHonor compact hireDate={employeeProfile.data?.['到職日']} /></span>
                                <select
                                    aria-label={t('select_operator')}
                                    value={selectedOperator}
                                    onChange={handleOperatorChange}
                                    className={`min-h-16 min-w-0 w-full rounded-xl ${employeeProfile.data?.['到職日'] ? 'pl-8 pr-6' : 'pl-1 pr-6'} appearance-none text-base leading-normal font-bold bg-transparent border-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer outline-none ${selectedOperator ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}
                                >
                                    <option value="">{t('select_operator')}</option>
                                    {employees.map((emp, idx) => (
                                        <option key={idx} value={`[${emp['員工編號']}] ${emp['姓名']}`}>
                                            [{emp['員工編號']}] {emp['姓名']}
                                        </option>
                                    ))}
                                </select>
                                <svg className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </>}
                            </div>
                        </div>


                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 p-4 pb-24 space-y-6">

                {/* 常用產品（主要入口） */}
                {favoriteProducts.length > 0 ? (
                    <section className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-lg font-bold border-l-4 border-red-500 pl-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <span className="material-symbols-outlined text-red-500">favorite</span>
                            {t('favorites')}
                        </h2>
                        <HomeDate />
                        </div>
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
                        className="min-h-16 min-w-16 flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                    >
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-2xl">bar_chart</span>
                            {unreadCount > 0 && <span aria-label={t('br_unread_count', { count: unreadCount })} className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-sm font-black text-white ring-2 ring-white dark:ring-slate-900">{unreadCount > 9 ? '9+' : unreadCount}</span>}
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
                                aria-label={t('close')} className="w-16 h-16 shrink-0 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-5 flex flex-col gap-6 overflow-y-auto max-h-[70vh] [&>*]:shrink-0">

                            {/* Profile Section */}
                            <TenureHonor hireDate={employeeProfile.data?.['到職日']} name={selectedOperator} />

                            <BuddyPicker employeeId={noticeEmployeeId} />
                            <HeaderThemePicker />

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

                            <div className="space-y-2">
                                <button type="button" disabled={masterBusy || (masterRefresh > 0 && employeeProfile.status === 'loading')} onClick={() => { setMasterRefresh(value => value + 1); if (noticeEmployeeId) employeeProfile.refresh(); }} className="min-h-16 w-full rounded-xl border border-slate-300 px-4 text-base font-bold text-primary dark:border-slate-600 disabled:opacity-50">
                        {t(masterBusy || (masterRefresh > 0 && employeeProfile.status === 'loading') ? 'data_refreshing' : 'data_refresh')}
                    </button>
                                {masterRefresh > 0 && !masterBusy && employeeProfile.status !== 'loading' && <p role="status" className="text-sm text-slate-500">{t(employeeProfile.status === 'error' && noticeEmployeeId ? 'data_refresh_failed' : masterStatus || 'data_refresh_done')}</p>}
                            </div>

                            {/* Danger Zone */}
                            <div className="space-y-4 pt-4 mt-2 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                    {t('account_section')}
                                </h3>
                                <button
                                    onClick={handleLogoutAndClear}
                                    className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800/30 font-bold py-3 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-[0.98] transition-all"
                                >
                                    <span className="material-symbols-outlined" aria-hidden="true">logout</span>
                                    {t('logout')}
                                </button>
                                <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                                    {t('logout_help')}
                                </p>
                            </div>

                            {/* Version Info */}
                            <div className="mt-4 pb-2 text-center">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 tracking-widest uppercase">
                                    Version 1.25.1
                                </p>
                                <p className="text-[9px] text-slate-300 dark:text-slate-700 mt-1">
                                    Built by Antigravity
                                </p>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {imagePreview && <ProductImagePreview src={getImageUrl(imagePreview['產品圖片'])} name={imagePreview['品名']} onClose={() => setImagePreview(null)} />}

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
