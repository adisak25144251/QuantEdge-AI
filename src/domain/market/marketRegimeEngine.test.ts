import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateMarketRegime, isStrategyAllowedInRegime } from './marketRegimeEngine';

test('evaluateMarketRegime detects volatile trending markets with confidence', () => {
  const regime = evaluateMarketRegime({
    adx: 34,
    atrPercent: 2.6,
    emaFast: 106,
    emaSlow: 100,
    realizedVolatilityPercent: 3.2,
    volumeZScore: 1.4
  });

  assert.equal(regime.regime, 'TRENDING');
  assert.equal(regime.volatility, 'ELEVATED');
  assert.ok(regime.confidence >= 70);
});

test('isStrategyAllowedInRegime blocks regime-incompatible strategies', () => {
  assert.equal(isStrategyAllowedInRegime('MEAN_REVERSION', 'TRENDING'), false);
  assert.equal(isStrategyAllowedInRegime('TREND_FOLLOWING', 'TRENDING'), true);
  assert.equal(isStrategyAllowedInRegime('BREAKOUT', 'LOW_VOLATILITY'), false);
});
