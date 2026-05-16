import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialPlanVersion, createNextPlanVersion } from './tradePlanVersioning';

test('createInitialPlanVersion creates deterministic version identity', () => {
  const version = createInitialPlanVersion({
    symbol: 'BTCUSDT',
    side: 'LONG',
    entry: 100,
    stopLoss: 95,
    takeProfit: 112,
    rationale: 'Initial breakout plan.',
    changedAt: '2026-01-01T00:00:00Z'
  });

  assert.equal(version.version, 1);
  assert.equal(version.changeType, 'INITIAL');
  assert.match(version.id, /^plan-BTCUSDT-LONG-1-/);
});

test('createNextPlanVersion records changed fields and reason', () => {
  const first = createInitialPlanVersion({
    symbol: 'BTCUSDT',
    side: 'LONG',
    entry: 100,
    stopLoss: 95,
    takeProfit: 112,
    rationale: 'Initial breakout plan.',
    changedAt: '2026-01-01T00:00:00Z'
  });
  const next = createNextPlanVersion(first, {
    entry: 101,
    stopLoss: 96,
    takeProfit: 114,
    rationale: 'Retest confirmed, tighten risk.',
    changedAt: '2026-01-01T01:00:00Z'
  });

  assert.equal(next.version, 2);
  assert.deepEqual(next.changedFields, ['entry', 'stopLoss', 'takeProfit', 'rationale']);
  assert.equal(next.changeType, 'REVISION');
});
