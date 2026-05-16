import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeWalkForwardParameters } from './walkForwardOptimizer';

describe('walkForwardOptimizer', () => {
  it('selects the most robust parameter candidate across walk-forward windows', () => {
    const result = optimizeWalkForwardParameters({
      candidates: [
        {
          id: 'fast',
          parameters: { emaFast: 9, emaSlow: 21 },
          windows: [
            { id: 1, trades: 40, expectancyR: 0.24, maxDrawdownPercent: 6 },
            { id: 2, trades: 42, expectancyR: 0.18, maxDrawdownPercent: 7 },
            { id: 3, trades: 38, expectancyR: 0.21, maxDrawdownPercent: 5 }
          ]
        },
        {
          id: 'fragile',
          parameters: { emaFast: 5, emaSlow: 13 },
          windows: [
            { id: 1, trades: 50, expectancyR: 0.8, maxDrawdownPercent: 4 },
            { id: 2, trades: 6, expectancyR: -0.2, maxDrawdownPercent: 19 }
          ]
        }
      ],
      minTradesPerWindow: 20,
      minPositiveWindowRate: 70,
      maxDrawdownPercent: 15
    });

    assert.equal(result.status, 'PASS');
    assert.equal(result.bestCandidate?.id, 'fast');
    assert.equal(result.candidates[0].robustnessScore, 100);
  });

  it('blocks when every candidate is unstable or overfit', () => {
    const result = optimizeWalkForwardParameters({
      candidates: [
        {
          id: 'overfit',
          parameters: { rsi: 2 },
          windows: [
            { id: 1, trades: 4, expectancyR: 1.4, maxDrawdownPercent: 3 },
            { id: 2, trades: 4, expectancyR: -0.7, maxDrawdownPercent: 30 }
          ]
        }
      ]
    });

    assert.equal(result.status, 'BLOCK');
    assert.equal(result.bestCandidate, null);
    assert(result.issues.some(issue => issue.code === 'NO_ROBUST_PARAMETER_SET'));
  });
});
