import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateProfessionalEvidence } from './professionalEvidence';

test('professional evidence passes only complete OOS walk-forward forward and slippage evidence', () => {
  const report = evaluateProfessionalEvidence({
    backtest: { sampleSize: 100, inSampleTrades: 60, outOfSampleTrades: 40, outOfSampleExpectancyR: 0.3, outOfSampleWinRate: 55, maxDrawdownPercent: 12, netProfitUsd: 500, profitFactor: 1.5 },
    walkForward: { status: 'PASS', windows: 4, positiveWindowRate: 75, minWindowExpectancyR: 0.05, averageWindowExpectancyR: 0.2, maxWindowDrawdownPercent: 14, issues: [] },
    forward: { status: 'PASS', totalSignals: 40, resolvedSignals: 35, hitRate: 57, expectancyR: 0.25, averageMfeR: 1.2, averageMaeR: 0.6, averageTimeToResolutionHours: 20, issues: [] },
    averageSlippageBps: 8
  });
  assert.equal(report.status, 'PASS');
  assert.equal(report.precisionPercent, 57);
});

test('professional evidence blocks negative OOS and excessive slippage', () => {
  const report = evaluateProfessionalEvidence({
    backtest: { sampleSize: 60, inSampleTrades: 30, outOfSampleTrades: 30, outOfSampleExpectancyR: -0.1, outOfSampleWinRate: 40, maxDrawdownPercent: 25, netProfitUsd: -100, profitFactor: 0.8 },
    walkForward: null,
    forward: null,
    averageSlippageBps: 40
  });
  assert.equal(report.status, 'BLOCK');
  assert.ok(report.issues.includes('SLIPPAGE_LIMIT_EXCEEDED'));
});
