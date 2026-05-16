import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectMultiAssetStrategyV2 } from './multiAssetStrategyEngineV2';

describe('multiAssetStrategyEngineV2', () => {
  it('selects a US stock relative-strength breakout in trending risk-on conditions', () => {
    const result = selectMultiAssetStrategyV2({
      assetType: 'US_STOCK',
      regime: 'TRENDING',
      relativeStrengthPercent: 4,
      volatilityPercent: 1.4,
      dataStatus: 'PASS',
      riskStatus: 'PASS'
    });

    assert.equal(result.status, 'PASS');
    assert.equal(result.strategyId, 'US_STOCK_RELATIVE_STRENGTH_BREAKOUT');
  });

  it('blocks strategy selection when data or risk is blocked', () => {
    const result = selectMultiAssetStrategyV2({
      assetType: 'CRYPTO',
      regime: 'TRENDING',
      relativeStrengthPercent: 0,
      volatilityPercent: 3,
      dataStatus: 'BLOCK',
      riskStatus: 'PASS'
    });

    assert.equal(result.status, 'BLOCK');
    assert.equal(result.strategyId, null);
  });
});
