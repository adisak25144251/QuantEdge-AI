import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildUsStockTradingPlan } from './usStockTradingPlan';

const baseInput = {
  ticker: 'BOTX',
  price: 10,
  marketCap: 900_000_000,
  averageVolume: 1_000_000,
  rsi: 62,
  score: 78,
  finalView: 'Breakout Watch',
  dailyScanStatus: 'PASS' as const,
  smallCapGroup: 'Breakout Ready',
  smallCapRiskLevel: 'LOW' as const,
  entryZone: '$9.80-$10.30 after confirmation/retest',
  stopLossZone: '$9.00-$9.40 or below SMA50',
  targetZone: '$11.50-$13.00; scale only after base holds',
  riskReward: 2.2,
  warnings: [] as string[]
};

describe('usStockTradingPlan', () => {
  it('calculates 1-2 percent risk budgets for 500, 1000, and 3000 portfolios', () => {
    const plan = buildUsStockTradingPlan(baseInput);
    assert.deepEqual(plan.positionSizes.map(size => size.riskBudgetLow), [5, 10, 30]);
    assert.deepEqual(plan.positionSizes.map(size => size.riskBudgetHigh), [10, 20, 60]);
  });

  it('caps quality small-cap allocation at 5 percent', () => {
    const plan = buildUsStockTradingPlan(baseInput);
    const threeThousand = plan.positionSizes.find(size => size.portfolioValue === 3000);
    assert.equal(plan.riskClass, 'Quality small-cap');
    assert.equal(threeThousand?.allocationCapPercent, 0.05);
    assert.equal((threeThousand?.dollars ?? 0) <= 150, true);
  });

  it('caps microcap allocation at 2 percent', () => {
    const plan = buildUsStockTradingPlan({
      ...baseInput,
      ticker: 'MICR',
      marketCap: 180_000_000,
      smallCapRiskLevel: 'HIGH'
    });
    const threeThousand = plan.positionSizes.find(size => size.portfolioValue === 3000);
    assert.equal(plan.riskClass, 'Microcap');
    assert.equal(threeThousand?.allocationCapPercent, 0.02);
    assert.equal((threeThousand?.dollars ?? 0) <= 60, true);
  });

  it('blocks sizing for RSI above 85', () => {
    const plan = buildUsStockTradingPlan({ ...baseInput, ticker: 'HOT', rsi: 88 });
    assert.equal(plan.finalView, 'Wait Pullback / No Chase');
    assert.equal(plan.positionSizes.every(size => size.shares === null), true);
  });

  it('returns data required when price is missing', () => {
    const plan = buildUsStockTradingPlan({ ...baseInput, ticker: 'MISS', price: null });
    assert.equal(plan.buyZone, 'Data required');
    assert.equal(plan.positionSizes.every(size => size.dollars === null), true);
  });
});
