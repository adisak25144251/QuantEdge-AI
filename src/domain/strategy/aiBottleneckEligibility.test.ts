import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAiBottleneckDailyEligibility, evaluateAiBottleneckSmallMidEligibility } from './aiBottleneckEligibility';

const valid = {
  marketCap: 1_000_000_000,
  price: 20,
  averageVolume: 900_000,
  relativeVolume: 1.8,
  catalystAgeDays: 20,
  hasDemandEvidence: true,
  sma20Status: 'ABOVE',
  sma50Status: 'ABOVE',
  rsi: 62,
  monthlyRunUpPercent: 25,
  distanceFrom52WeekHighPercent: 12,
  pattern: 'VCP / Breakout + Retest'
};

test('AI bottleneck eligibility passes only complete qualifying evidence', () => {
  assert.equal(evaluateAiBottleneckDailyEligibility(valid).eligible, true);
  assert.equal(evaluateAiBottleneckSmallMidEligibility(valid).eligible, true);
});

test('AI bottleneck eligibility does not treat missing hard criteria as passing', () => {
  const incomplete = {
    ...valid,
    marketCap: null,
    averageVolume: null,
    rsi: null,
    catalystAgeDays: null,
    distanceFrom52WeekHighPercent: null
  };

  const daily = evaluateAiBottleneckDailyEligibility(incomplete);
  const smallMid = evaluateAiBottleneckSmallMidEligibility(incomplete);

  assert.equal(daily.eligible, false);
  assert(daily.failedCriteria.includes('MARKET_CAP_100M_TO_20B'));
  assert(daily.failedCriteria.includes('CATALYST_WITHIN_180_DAYS'));
  assert.equal(smallMid.eligible, false);
  assert(smallMid.failedCriteria.includes('WITHIN_25_PERCENT_OF_52W_HIGH'));
});
