import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { routeStrategyForRegime } from './regimeStrategyRouter';

describe('regimeStrategyRouter', () => {
  it('selects the highest scoring strategy compatible with the live regime', () => {
    const route = routeStrategyForRegime({
      regime: 'TRENDING',
      strategies: [
        { id: 'mean', family: 'MEAN_REVERSION', status: 'PASS', score: 95 },
        { id: 'trend', family: 'TREND_FOLLOWING', status: 'PASS', score: 80 },
        { id: 'breakout', family: 'BREAKOUT', status: 'REVIEW', score: 90 }
      ]
    });

    assert.equal(route.status, 'PASS');
    assert.equal(route.selectedStrategyId, 'trend');
    assert.equal(route.blockedStrategies.includes('mean'), true);
  });

  it('blocks when regime is unknown or no compatible strategy exists', () => {
    const route = routeStrategyForRegime({
      regime: 'UNKNOWN',
      strategies: [
        { id: 'trend', family: 'TREND_FOLLOWING', status: 'PASS', score: 90 }
      ]
    });

    assert.equal(route.status, 'BLOCK');
    assert.equal(route.selectedStrategyId, null);
    assert(route.issues.some(issue => issue.code === 'UNKNOWN_MARKET_REGIME'));
  });
});
