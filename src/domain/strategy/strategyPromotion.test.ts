import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateStrategyPromotion } from './strategyPromotion';

test('evaluateStrategyPromotion promotes research to paper when lab and backtest evidence pass', () => {
  const result = evaluateStrategyPromotion({
    currentStage: 'RESEARCH',
    labStatus: 'PASS',
    backtestStatus: 'PASS',
    paperStatus: 'BLOCK',
    liveReadinessStatus: 'NOT_READY',
    auditDecisionCount: 0
  });

  assert.equal(result.nextStage, 'PAPER');
  assert.equal(result.status, 'PASS');
});

test('evaluateStrategyPromotion blocks live eligibility until paper, readiness, and audit evidence pass', () => {
  const result = evaluateStrategyPromotion({
    currentStage: 'SMALL_LIVE_READY',
    labStatus: 'PASS',
    backtestStatus: 'PASS',
    paperStatus: 'PASS',
    liveReadinessStatus: 'PAPER_ONLY',
    auditDecisionCount: 8
  });

  assert.equal(result.nextStage, 'SMALL_LIVE_READY');
  assert.equal(result.status, 'BLOCK');
  assert.ok(result.issues.some(issue => issue.code === 'LIVE_READINESS_NOT_APPROVED'));
  assert.ok(result.issues.some(issue => issue.code === 'AUDIT_SAMPLE_TOO_SMALL'));
});
