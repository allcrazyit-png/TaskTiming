import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCurrentWeather, TV_WEATHER_URL, TV_RAIN_ALERT_PERCENT } from '../src/utils/tvWeather.js';

test('current weather is rounded to whole degrees and percent', () => {
  assert.deepEqual(parseCurrentWeather({ current: { temperature_2m: 22.7, precipitation_probability: 0 } }), { temp: 23, rain: 0 });
});

test('an unusable reply gives no weather instead of NaN on screen', () => {
  assert.equal(parseCurrentWeather(null), null);
  assert.equal(parseCurrentWeather({}), null);
  assert.equal(parseCurrentWeather({ current: { temperature_2m: 20 } }), null);
});

test('asks only for current temperature and rain chance, at township level', () => {
  assert.match(TV_WEATHER_URL, /current=temperature_2m,precipitation_probability/);
  assert.match(TV_WEATHER_URL, /latitude=23\.99&longitude=120\.46/);
  assert.equal(TV_RAIN_ALERT_PERCENT, 50);
});
