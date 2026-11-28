import { useEffect, useState } from 'react';
import { parseCurrentWeather, TV_WEATHER_REFRESH_MS, TV_WEATHER_URL } from '../utils/tvWeather';

// Polls the current weather; a failed fetch keeps the last reading, and none at all renders nothing.
export default function useTvWeather({ disabled = false } = {}) {
    const [weather, setWeather] = useState(null);
    useEffect(() => {
        if (disabled) return undefined;
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch(TV_WEATHER_URL);
                if (!res.ok) return;
                const next = parseCurrentWeather(await res.json());
                if (next && !cancelled) setWeather(next);
            } catch {
                // Weather is optional; the board keeps working without it.
            }
        };
        load();
        const timer = setInterval(load, TV_WEATHER_REFRESH_MS);
        return () => { cancelled = true; clearInterval(timer); };
    }, [disabled]);
    return weather;
}
