import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateInstitutionalBacktestV2 } from './institutionalBacktestV2';

describe('institutionalBacktestV2', () => {
  it('passes robust multi-asset backtest evidence', () => {
    const report = evaluateInstitutionalBacktestV2({
      sampleSize: 320,
      outOfSampleExpectancyR: 0.22,
      maxDrawdownPercent: 12,
      walkForwardPositiveRate: 82,
      monteCarloSurvivalRate: 91,
      benchmarkExpectancyR: 0.08,
      assetAwareFees: true,
      splitSessionAdjusted: true
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.edgeOverBenchmarkR, 0.14);
  });

  it('blocks overfit or unadjusted evidence', () => {
    const report = evaluateInstitutionalBacktestV2({
      sampleSize: 40,
      outOfSampleExpectancyR: -0.02,
      maxDrawdownPercent: 35,
      walkForwardPositiveRate: 40,
      monteCarloSurvivalRate: 50,
      benchmarkExpectancyR: 0.05,
      assetAwareFees: false,
      splitSessionAdjusted: false
    });

    assert.equal(report.status, 'BLOCK');
    assert(report.issues.some(issue => issue.code === 'BACKTEST_SAMPLE_TOO_SMALL'));
    assert(report.issues.some(issue => issue.code === 'SPLIT_SESSION_ADJUSTMENT_MISSING'));
  });
});
