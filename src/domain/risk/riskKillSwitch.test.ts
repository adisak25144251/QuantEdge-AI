import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRiskKillSwitch } from './riskKillSwitch';

test('evaluateRiskKillSwitch remains armed but unlocked in healthy conditions', () => {
  const result = evaluateRiskKillSwitch({
    dailyPnlPercent: -0.8,
    currentDrawdownPercent: 3,
    consecutiveLosses: 2,
    marketDataStatus: 'PASS',
    aiBackendAvailable: true,
    volatilityShockPercent: 1.2,
    liveTradingLocked: true
  });

  assert.equal(result.state, 'UNLOCKED');
  assert.equal(result.canRecordPlan, true);
});

test('evaluateRiskKillSwitch locks recording on loss, stale data, and volatility shock', () => {
  const result = evaluateRiskKillSwitch({
    dailyPnlPercent: -3.4,
    currentDrawdownPercent: 8,
    consecutiveLosses: 5,
    marketDataStatus: 'REVIEW',
    aiBackendAvailable: false,
    volatilityShockPercent: 5,
    liveTradingLocked: true
  });

  assert.equal(result.state, 'LOCKED');
  assert.equal(result.canRecordPlan, false);
  assert.ok(result.triggers.some(trigger => trigger.code === 'DAILY_LOSS_LIMIT'));
  assert.ok(result.triggers.some(trigger => trigger.code === 'VOLATILITY_SHOCK'));
});
