import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReleaseReadiness } from './releaseReadiness';

test('evaluateReleaseReadiness passes only when production gates are complete', () => {
  const report = evaluateReleaseReadiness({
    testsPassing: true,
    lintPassing: true,
    buildPassing: true,
    smokePassing: true,
    securityStatus: 'PASS',
    deploymentStatus: 'PASS',
    liveTradingLocked: true,
    rollbackPlanReady: true,
    environmentReviewed: true
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.releaseAllowed, true);
});

test('evaluateReleaseReadiness blocks missing rollback and unlocked live trading', () => {
  const report = evaluateReleaseReadiness({
    testsPassing: true,
    lintPassing: true,
    buildPassing: true,
    smokePassing: true,
    securityStatus: 'PASS',
    deploymentStatus: 'REVIEW',
    liveTradingLocked: false,
    rollbackPlanReady: false,
    environmentReviewed: false
  });

  assert.equal(report.status, 'BLOCK');
  assert.equal(report.releaseAllowed, false);
  assert.ok(report.checks.some(check => check.code === 'LIVE_TRADING_LOCK'));
  assert.ok(report.checks.some(check => check.code === 'ROLLBACK_PLAN'));
});
