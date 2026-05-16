import assert from 'node:assert/strict';
import test from 'node:test';
import { runScenarioStressTest } from './scenarioStressTest';

test('runScenarioStressTest passes a plan that survives gap and slippage shocks', () => {
  const report = runScenarioStressTest({
    side: 'LONG',
    entry: 100,
    stopLoss: 95,
    takeProfit: 112,
    accountEquity: 10_000,
    sizeUnits: 10,
    scenarios: [
      { name: '1% gap down', gapPercent: -1, slippagePercent: 0.2, volatilityMultiplier: 1.2 },
      { name: 'normal fill', gapPercent: 0, slippagePercent: 0.1, volatilityMultiplier: 1 }
    ],
    maxLossPercent: 1.5
  });

  assert.equal(report.status, 'PASS');
  assert.ok(report.worstCaseLossPercent < 1.5);
});

test('runScenarioStressTest blocks oversized loss under shock scenario', () => {
  const report = runScenarioStressTest({
    side: 'SHORT',
    entry: 100,
    stopLoss: 104,
    takeProfit: 90,
    accountEquity: 10_000,
    sizeUnits: 100,
    scenarios: [{ name: 'gap squeeze', gapPercent: 3, slippagePercent: 1, volatilityMultiplier: 2 }],
    maxLossPercent: 2
  });

  assert.equal(report.status, 'BLOCK');
  assert.ok(report.issues.some(issue => issue.code === 'STRESS_LOSS_EXCEEDED'));
});
