import assert from 'node:assert/strict';
import test from 'node:test';
import { compareStrategies, computeAntiOverfitScore, rankStrategyCandidates } from './strategyLab';

test('rankStrategyCandidates rewards robust out-of-sample and walk-forward evidence', () => {
  const [winner, laggard] = rankStrategyCandidates([
    {
      id: 'mean-reversion',
      name: 'Mean Reversion',
      sampleSize: 240,
      outOfSampleExpectancyR: 0.18,
      maxDrawdownPercent: 8,
      walkForwardPositiveRate: 82,
      coveredRegimes: 4,
      paperExpectancyR: 0.16
    },
    {
      id: 'curve-fit-breakout',
      name: 'Curve Fit Breakout',
      sampleSize: 60,
      outOfSampleExpectancyR: -0.02,
      maxDrawdownPercent: 24,
      walkForwardPositiveRate: 45,
      coveredRegimes: 1,
      paperExpectancyR: 0.01
    }
  ]);

  assert.equal(winner.id, 'mean-reversion');
  assert.equal(winner.status, 'PASS');
  assert.equal(laggard.status, 'BLOCK');
  assert.ok(winner.score > laggard.score);
});

test('computeAntiOverfitScore blocks high in-sample divergence and thin robustness evidence', () => {
  const report = computeAntiOverfitScore({
    inSampleExpectancyR: 0.9,
    outOfSampleExpectancyR: 0.05,
    sampleSize: 42,
    walkForwardPositiveRate: 40,
    coveredRegimes: 1
  });

  assert.equal(report.status, 'BLOCK');
  assert.ok(report.score < 50);
  assert.ok(report.issues.some(issue => issue.code === 'IN_SAMPLE_DIVERGENCE'));
});

test('compareStrategies exposes ranked best candidate and blocked candidates', () => {
  const comparison = compareStrategies([
    {
      id: 'trend',
      name: 'Trend',
      sampleSize: 180,
      outOfSampleExpectancyR: 0.12,
      maxDrawdownPercent: 9,
      walkForwardPositiveRate: 78,
      coveredRegimes: 3
    },
    {
      id: 'scalper',
      name: 'Scalper',
      sampleSize: 30,
      outOfSampleExpectancyR: 0.04,
      maxDrawdownPercent: 18,
      walkForwardPositiveRate: 55,
      coveredRegimes: 2
    }
  ]);

  assert.equal(comparison.best?.id, 'trend');
  assert.deepEqual(comparison.blockedCandidateIds, ['scalper']);
  assert.equal(comparison.passCount, 1);
});
