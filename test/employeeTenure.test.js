import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeTenure } from '../src/utils/employeeTenure.js';
const now = new Date('2026-10-24T04:00:00Z');
test('tier boundaries use completed anniversaries', () => {
  for (const [date, tier] of [['2026-10-05','new'],['2025-10-25','new'],['2025-10-24','bronze'],['2023-10-24','silver'],['2021-10-24','gold'],['2016-10-24','diamond']]) assert.equal(employeeTenure(date, now).tier, tier);
});
test('missing, invalid and future dates never award a tier', () => {
  for (const date of ['',null,'2025-02-29','2026-10-25','bad']) assert.equal(employeeTenure(date, now), null);
});
test('Taiwan midnight and leap-day anniversary are deterministic', () => {
  assert.equal(employeeTenure('2025-10-24',new Date('2026-10-23T16:00:00Z')).years,1);
  assert.equal(employeeTenure('2024-02-29',new Date('2025-02-28T04:00:00Z')).years,1);
});
