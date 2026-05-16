import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateModelDrift } from './modelDriftMonitor';

test('evaluateModelDrift passes stable forward performance versus baseline', () => {
  const report = evaluateModelDrift({
    baselineExpectancyR: 0.25,
    currentExpectancyR: 0.22,
    baselineHitRate: 58,
    currentHitRate: 55,
    sampleSize: 80
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.recommendedAction, 'KEEP_ACTIVE');
});

test('evaluateModelDrift downgrades strategy when forward edge decays materially', () => {
  const report = evaluateModelDrift({
    baselineExpectancyR: 0.3,
    currentExpectancyR: -0.05,
    baselineHitRate: 60,
    currentHitRate: 42,
    sampleSize: 80
  });

  assert.equal(report.status, 'BLOCK');
  assert.equal(report.recommendedAction, 'DOWNGRADE_TO_PAPER');
  assert.ok(report.issues.some(issue => issue.code === 'EXPECTANCY_DRIFT'));
});
