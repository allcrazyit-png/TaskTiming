import { useEffect, useState } from 'react';
import { fetchPublicBoard } from '../services/taskTimingRecords';
import { initialBoardState, msUntilNextReload, reduceBoardState, TV_REFRESH_MS } from '../utils/tvBoard';

// Polls the public board every minute while the TV page is open, and reloads
// the whole page once a day so the screen picks up new builds.
export default function usePublicBoard(key, { disabled = false } = {}) {
    const [state, setState] = useState(initialBoardState);

    useEffect(() => {
        if (disabled) return undefined;
        let controller = null;
        const load = async () => {
            controller?.abort();
            controller = new AbortController();
            const { signal } = controller;
            try {
                const data = await fetchPublicBoard({ key, signal });
                if (!signal.aborted) setState(prev => reduceBoardState(prev, { type: 'success', data, at: new Date() }));
            } catch (error) {
                if (!signal.aborted) setState(prev => reduceBoardState(prev, { type: 'failure', error, at: new Date() }));
            }
        };
        load();
        const interval = setInterval(load, TV_REFRESH_MS);
        return () => {
            clearInterval(interval);
            controller?.abort();
        };
    }, [key, disabled]);

    useEffect(() => {
        if (disabled) return undefined;
        const timer = setTimeout(() => window.location.reload(), msUntilNextReload(new Date()));
        return () => clearTimeout(timer);
    }, [disabled]);

    return state;
}
