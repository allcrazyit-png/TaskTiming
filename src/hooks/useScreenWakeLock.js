import { useEffect } from 'react';

// Keeps the TV screen awake in browsers that support the Screen Wake Lock API.
export default function useScreenWakeLock() {
    useEffect(() => {
        if (!navigator.wakeLock) return undefined;
        let lock = null;
        let released = false;
        const request = async () => {
            if (released || document.visibilityState !== 'visible') return;
            try {
                lock = await navigator.wakeLock.request('screen');
            } catch {
                // Denied or unsupported: the OS power settings still apply.
            }
        };
        request();
        document.addEventListener('visibilitychange', request);
        return () => {
            released = true;
            document.removeEventListener('visibilitychange', request);
            lock?.release().catch(() => {});
        };
    }, []);
}
