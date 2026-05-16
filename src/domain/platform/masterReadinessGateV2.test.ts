import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMasterReadinessGateV2 } from './masterReadinessGateV2';

describe('masterReadinessGateV2', () => {
  it('allows small manual live only when all research, paper, shadow, risk, and ops gates pass', () => {
    const gate = evaluateMasterReadinessGateV2({
      dataStatus: 'PASS',
      strategyStatus: 'PASS',
      backtestStatus: 'PASS',
      forwardStatus: 'PASS',
      shadowStatus: 'PASS',
      portfolioRiskStatus: 'PASS',
      aiMemoStatus: 'PASS',
      reportStatus: 'PASS',
      opsStatus: 'PASS',
      liveTradingLocked: true,
      apiTradingEnabled: false
    });

    assert.equal(gate.stage, 'SMALL_MANUAL_LIVE_READY');
    assert.equal(gate.status, 'PASS');
  });

  it('blocks if API trading is unlocked or research evidence is blocked', () => {
    const gate = evaluateMasterReadinessGateV2({
      dataStatus: 'BLOCK',
      strategyStatus: 'PASS',
      backtestStatus: 'PASS',
      forwardStatus: 'PASS',
      shadowStatus: 'PASS',
      portfolioRiskStatus: 'PASS',
      aiMemoStatus: 'PASS',
      reportStatus: 'PASS',
      opsStatus: 'PASS',
      liveTradingLocked: false,
      apiTradingEnabled: true
    });

    assert.equal(gate.stage, 'NOT_READY');
    assert(gate.blockingCodes.includes('DATA_BLOCK'));
    assert(gate.blockingCodes.includes('API_TRADING_UNLOCKED'));
  });
});
