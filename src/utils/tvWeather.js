// Current weather for the TV board: Puyan Township, Changhua (township-level point, not an address).
export const TV_WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=23.99&longitude=120.46'
  + '&current=temperature_2m,precipitation_probability&timezone=Asia%2FTaipei';
export const TV_WEATHER_REFRESH_MS = 30 * 60_000;
export const TV_RAIN_ALERT_PERCENT = 50;

// Returns { temp, rain } rounded to whole numbers, or null when the reply is unusable.
export function parseCurrentWeather(json) {
  const temp = json?.current?.temperature_2m;
  const rain = json?.current?.precipitation_probability;
  if (!Number.isFinite(temp) || !Number.isFinite(rain)) return null;
  return { temp: Math.round(temp), rain: Math.round(rain) };
}
