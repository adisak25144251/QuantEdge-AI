import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAiBottleneckTradingPlan } from './aiBottleneckTradingPlan';

const baseInput = {
  ticker: 'QUAL',
  price: 10,
  marketCap: 1_200_000_000,
  averageVolume: 900_000,
  relativeVolume: 1.6,
  rsi: 62,
  score: 78,
  group: 'Emerging Bottleneck',
  issues: [] as string[],
  pattern: 'VCP / Breakout Retest',
  entryZone: '$9.80-$10.40 after confirmed breakout/retest',
  stopLossZone: '$9.00-$9.40 or below failed retest low',
  targetZone: '$11.80-$13.50 if base holds and catalyst confirms',
  riskReward: 2.2,
  backlogOrContract: 'AI infrastructure capacity backlog.',
  revenueGrowth: 24,
  cashDebtProfile: 'MANAGEABLE'
};

describe('aiBottleneckTradingPlan', () => {
  it('uses 1 percent risk budget for the supported portfolio sizes', () => {
    const plan = buildAiBottleneckTradingPlan(baseInput);
    assert.deepEqual(plan.positionSizes.map(size => size.riskBudget), [5, 10, 30, 100]);
  });

  it('caps quality small-cap sizing at no more than 5 percent allocation', () => {
    const plan = buildAiBottleneckTradingPlan(baseInput);
    const tenThousand = plan.positionSizes.find(size => size.portfolioValue === 10000);
    assert.equal(plan.allocationClass, 'Quality small-cap');
    assert.equal(tenThousand?.allocationCapPercent, 0.05);
    assert.equal((tenThousand?.dollars ?? 0) <= 500, true);
  });

  it('caps microcap or high speculative sizing at no more than 2 percent allocation', () => {
    const plan = buildAiBottleneckTradingPlan({
      ...baseInput,
      ticker: 'MICR',
      marketCap: 180_000_000,
      issues: ['DILUTION_RISK_HIGH'],
      group: 'Speculative Bottleneck'
    });
    const tenThousand = plan.positionSizes.find(size => size.portfolioValue === 10000);
    assert.equal(plan.allocationClass, 'Microcap / high speculative');
    assert.equal(tenThousand?.allocationCapPercent, 0.02);
    assert.equal((tenThousand?.dollars ?? 0) <= 200, true);
  });

  it('marks RSI above 85 as no entry and wait new base', () => {
    const plan = buildAiBottleneckTradingPlan({ ...baseInput, ticker: 'HOT', rsi: 88 });
    assert.equal(plan.finalView, 'Wait New Base / No Chase');
    assert.equal(plan.positionSizes.every(size => size.shares === null), true);
  });

  it('returns data required sizing when price is missing', () => {
    const plan = buildAiBottleneckTradingPlan({ ...baseInput, ticker: 'MISS', price: null });
    assert.equal(plan.buyZone, 'Data required');
    assert.equal(plan.stopLoss, 'Data required');
    assert.equal(plan.positionSizes.every(size => size.dollars === null), true);
  });
});
