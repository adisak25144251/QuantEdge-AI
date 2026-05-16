import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLiveReadiness } from './liveReadiness';

const readyInput = {
  marketDataStatus: 'PASS' as const,
  riskPolicyStatus: 'PASS' as const,
  paperTrading: {
    closedTrades: 80,
    expectancyR: 0.35,
    maxDrawdownPercent: 6,
    winRate: 55
  },
  backtest: {
    sampleSize: 350,
    outOfSampleExpectancyR: 0.22,
    maxDrawdownPercent: 12
  },
  aiBackendConfigured: true,
  executionMode: 'MANUAL_ONLY' as const
};

test('evaluateLiveReadiness blocks live when market data is blocked', () => {
  const result = evaluateLiveReadiness({
    ...readyInput,
    marketDataStatus: 'BLOCK'
  });

  assert.equal(result.status, 'NOT_READY');
  assert.equal(result.gates.some(gate => gate.code === 'MARKET_DATA_BLOCKED' && gate.status === 'BLOCK'), true);
});

test('evaluateLiveReadiness stays paper-only until paper evidence is statistically useful', () => {
  const result = evaluateLiveReadiness({
    ...readyInput,
    paperTrading: {
      closedTrades: 12,
      expectancyR: 0.5,
      maxDrawdownPercent: 3,
      winRate: 58
    }
  });

  assert.equal(result.status, 'PAPER_ONLY');
  assert.equal(result.gates.some(gate => gate.code === 'PAPER_SAMPLE_TOO_SMALL' && gate.status === 'REVIEW'), true);
});

test('evaluateLiveReadiness stays not ready without out-of-sample backtest evidence', () => {
  const result = evaluateLiveReadiness({
    ...readyInput,
    backtest: {
      sampleSize: 0,
      outOfSampleExpectancyR: 0,
      maxDrawdownPercent: 100
    }
  });

  assert.equal(result.status, 'NOT_READY');
  assert.equal(result.gates.some(gate => gate.code === 'BACKTEST_SAMPLE_TOO_SMALL' && gate.status === 'BLOCK'), true);
});

test('evaluateLiveReadiness approves only small manual live readiness when all gates pass', () => {
  const result = evaluateLiveReadiness(readyInput);

  assert.equal(result.status, 'READY_FOR_SMALL_LIVE');
  assert.equal(result.gates.every(gate => gate.status === 'PASS'), true);
});

test('evaluateLiveReadiness blocks API execution until audited controls exist', () => {
  const result = evaluateLiveReadiness({
    ...readyInput,
    executionMode: 'API_CONNECTED'
  });

  assert.equal(result.status, 'NOT_READY');
  assert.equal(result.gates.some(gate => gate.code === 'API_EXECUTION_NOT_AUDITED' && gate.status === 'BLOCK'), true);
});
