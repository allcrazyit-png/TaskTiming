import test from 'node:test';
import assert from 'node:assert/strict';
import { efficiencyGaugePoint } from '../src/utils/efficiencyGauge.js';
test('efficiency gauge stays on upper semicircle and matches scale endpoints', () => {
  assert.equal(efficiencyGaugePoint(0).x, 18);
  assert.ok(Math.abs(efficiencyGaugePoint(75).x - 90) < 0.001);
  assert.equal(efficiencyGaugePoint(75).y, 16);
  assert.equal(efficiencyGaugePoint(150).x, 162);
  for (const value of [0, 50, 75.9, 100, 150]) assert.ok(efficiencyGaugePoint(value).y <= 88.001);
  assert.deepEqual(efficiencyGaugePoint(200), efficiencyGaugePoint(150));
});
