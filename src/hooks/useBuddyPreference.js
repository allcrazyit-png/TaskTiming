import { useSyncExternalStore } from 'react';
export const BUDDY_TYPES = ['cat', 'none'];
export function readBuddyPreference(employeeId) {
    if (!employeeId) return 'cat';
    try {
        const value = localStorage.getItem(`factoryBuddy_${employeeId}`);
        return BUDDY_TYPES.includes(value) ? value : 'cat';
    } catch { return 'cat'; }
}
function subscribe(callback) {
    window.addEventListener('storage', callback);
    window.addEventListener('factory-buddy-change', callback);
    return () => {
        window.removeEventListener('storage', callback);
        window.removeEventListener('factory-buddy-change', callback);
    };
}
export default function useBuddyPreference(employeeId) {
    const value = useSyncExternalStore(subscribe, () => readBuddyPreference(employeeId), () => 'cat');
    const choose = type => {
        if (!employeeId || !BUDDY_TYPES.includes(type)) return;
        try { localStorage.setItem(`factoryBuddy_${employeeId}`, type); } catch { return; }
        window.dispatchEvent(new Event('factory-buddy-change'));
    };
    return [value, choose];
}
