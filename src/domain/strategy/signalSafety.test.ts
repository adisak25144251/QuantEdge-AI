import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSetupIdentity,
  canExecuteCandidate,
  setupDetailsToAlert,
  toProfessionalReadiness,
} from './signalSafety';

test('buildSetupIdentity is deterministic for equivalent setup inputs', () => {
  const first = buildSetupIdentity({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    side: 'LONG',
    entry: 65000.123456,
    sl: 64000,
    tp: 67500,
  });

  const second = buildSetupIdentity({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    side: 'LONG',
    entry: 65000.123456,
    sl: 64000,
    tp: 67500,
  });

  assert.equal(first, second);
  assert.match(first, /^BTCUSDT-1h-LONG-/);
});

test('canExecuteCandidate only allows reviewed actionable candidates with valid risk geometry', () => {
  assert.equal(canExecuteCandidate({
    currentStatus: 'ACTIONABLE',
    side: 'LONG',
    entry: 100,
    sl: 95,
    tp: 112,
    rr: 2.4,
    userConfirmedRisk: true,
  }), true);

  assert.equal(canExecuteCandidate({
    currentStatus: 'ACTIONABLE',
    side: 'LONG',
    entry: 100,
    sl: 105,
    tp: 112,
    rr: 2.4,
    userConfirmedRisk: true,
  }), false);

  assert.equal(canExecuteCandidate({
    currentStatus: 'ACTIONABLE',
    side: 'LONG',
    entry: 100,
    sl: 95,
    tp: 112,
    rr: 2.4,
    userConfirmedRisk: false,
  }), false);
});

test('toProfessionalReadiness converts raw status to safer professional wording', () => {
  assert.deepEqual(toProfessionalReadiness('ACTIONABLE'), {
    priority: 'ACTIONABLE',
    label: 'Setup candidate passed review gates',
    actionText: 'Review risk before execution',
    canShowExecutionControls: true,
  });

  assert.deepEqual(toProfessionalReadiness('WAIT'), {
    priority: 'INTERESTING',
    label: 'Candidate still needs confirmation',
    actionText: 'Wait for confirmation',
    canShowExecutionControls: false,
  });
});

test('setupDetailsToAlert creates a deterministic alert snapshot without random confidence', () => {
  const alert = setupDetailsToAlert({
    symbol: 'ETHUSDT',
    timeframe: '4h',
    side: 'SHORT',
    currentStatus: 'WAIT',
    statusReason: 'Risk/reward below threshold',
    entry: 3000,
    sl: 3090,
    tp: 2800,
    rr: 2.22,
    confidenceScore: 68,
    conditionsSatisfied: ['Trend filter', 'Momentum filter'],
    pendingConditions: ['Candle close confirmation'],
    timestamp: '2026-05-09T02:00:00.000Z',
  });

  assert.equal(alert.id, 'ETHUSDT-4h-SHORT-3000-3090-2800');
  assert.equal(alert.priority, 'INTERESTING');
  assert.equal(alert.actionableFlag, false);
  assert.equal(alert.confidence, 68);
  assert.equal(alert.chartSnapshotUrl, null);
  assert.deepEqual(alert.conditionsSatisfied, ['Trend filter', 'Momentum filter']);
});
