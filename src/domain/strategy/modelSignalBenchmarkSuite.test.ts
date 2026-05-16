import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkSignals } from './modelSignalBenchmarkSuite';

describe('modelSignalBenchmarkSuite', () => {
  it('passes when AI materially outperforms baseline rules with enough samples', () => {
    const report = benchmarkSignals({
      samples: 120,
      ai: { expectancyR: 0.28, hitRate: 58, maxDrawdownPercent: 9 },
      baseline: { expectancyR: 0.12, hitRate: 52, maxDrawdownPercent: 12 },
      minSamples: 100,
      minExpectancyLiftR: 0.08
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.expectancyLiftR, 0.16);
    assert.equal(report.aiOutperformsBaseline, true);
  });

  it('blocks if AI does not beat baseline or evidence is too thin', () => {
    const report = benchmarkSignals({
      samples: 40,
      ai: { expectancyR: 0.05, hitRate: 50, maxDrawdownPercent: 18 },
      baseline: { expectancyR: 0.08, hitRate: 51, maxDrawdownPercent: 12 }
    });

    assert.equal(report.status, 'BLOCK');
    assert.equal(report.aiOutperformsBaseline, false);
    assert(report.issues.some(issue => issue.code === 'BENCHMARK_SAMPLE_TOO_SMALL'));
    assert(report.issues.some(issue => issue.code === 'AI_UNDERPERFORMS_BASELINE'));
  });
});
