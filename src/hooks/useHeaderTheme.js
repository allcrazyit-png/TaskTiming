import { useSyncExternalStore } from 'react';
const subscribe = callback => {
    window.addEventListener('storage', callback);
    window.addEventListener('header-theme-change', callback);
    return () => { window.removeEventListener('storage', callback); window.removeEventListener('header-theme-change', callback); };
};
function read(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
export default function useHeaderTheme() {
    const saved = useSyncExternalStore(subscribe, () => read('headerTheme', 'classic'), () => 'classic');
    const motion = useSyncExternalStore(subscribe, () => read('headerThemeMotion', 'on'), () => 'on');
    const save = (key, value) => { try { localStorage.setItem(key, value); window.dispatchEvent(new Event('header-theme-change')); } catch { /* Keep the current preference if storage is unavailable. */ } };
    return { theme: ['classic', 'autumn', 'halloween'].includes(saved) ? saved : 'classic', animated: motion !== 'off', chooseTheme: value => save('headerTheme', value), chooseMotion: value => save('headerThemeMotion', value ? 'on' : 'off') };
}
