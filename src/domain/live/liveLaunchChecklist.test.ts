import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLiveLaunchChecklist } from './liveLaunchChecklist';

const baseInput = {
  liveReadinessStatus: 'READY_FOR_SMALL_LIVE' as const,
  executionMode: 'MANUAL_ONLY' as const,
  apiTradingEnabled: false,
  aiBackendConfigured: true,
  emergencyStopEnabled: true,
  auditDecisionCount: 25,
  latestBuildVerified: true
};

test('evaluateLiveLaunchChecklist allows only small manual live when all launch locks pass', () => {
  const result = evaluateLiveLaunchChecklist(baseInput);

  assert.equal(result.status, 'SMALL_MANUAL_LIVE_READY');
  assert.equal(result.gates.every(gate => gate.status === 'PASS'), true);
});

test('evaluateLiveLaunchChecklist locks live when readiness has hard blockers', () => {
  const result = evaluateLiveLaunchChecklist({
    ...baseInput,
    liveReadinessStatus: 'NOT_READY'
  });

  assert.equal(result.status, 'LOCKED');
  assert.equal(result.gates.some(gate => gate.code === 'LIVE_READINESS_BLOCKED' && gate.status === 'BLOCK'), true);
});

test('evaluateLiveLaunchChecklist remains paper-only when evidence is not ready for live', () => {
  const result = evaluateLiveLaunchChecklist({
    ...baseInput,
    liveReadinessStatus: 'PAPER_ONLY'
  });

  assert.equal(result.status, 'PAPER_ONLY');
  assert.equal(result.gates.some(gate => gate.code === 'PAPER_ONLY_MODE' && gate.status === 'REVIEW'), true);
});

test('evaluateLiveLaunchChecklist blocks API trading until audited separately', () => {
  const result = evaluateLiveLaunchChecklist({
    ...baseInput,
    executionMode: 'API_CONNECTED',
    apiTradingEnabled: true
  });

  assert.equal(result.status, 'LOCKED');
  assert.equal(result.gates.some(gate => gate.code === 'API_TRADING_ENABLED' && gate.status === 'BLOCK'), true);
});

test('evaluateLiveLaunchChecklist requires emergency stop and enough audit history', () => {
  const result = evaluateLiveLaunchChecklist({
    ...baseInput,
    emergencyStopEnabled: false,
    auditDecisionCount: 3
  });

  assert.equal(result.status, 'LOCKED');
  assert.equal(result.gates.some(gate => gate.code === 'EMERGENCY_STOP_MISSING' && gate.status === 'BLOCK'), true);
  assert.equal(result.gates.some(gate => gate.code === 'AUDIT_TRAIL_TOO_SMALL' && gate.status === 'REVIEW'), true);
});
