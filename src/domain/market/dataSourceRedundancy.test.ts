import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDataSourceRedundancy } from './dataSourceRedundancy';

describe('dataSourceRedundancy', () => {
  it('selects the fastest healthy source when prices agree', () => {
    const report = evaluateDataSourceRedundancy({
      sources: [
        { name: 'binance', status: 'PASS', latestClose: 100, latencyMs: 120, lastUpdatedAt: 1_000 },
        { name: 'backup', status: 'PASS', latestClose: 100.08, latencyMs: 80, lastUpdatedAt: 1_010 }
      ],
      now: 1_020,
      maxPriceDivergencePercent: 0.2,
      staleAfterMs: 5_000
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.selectedSource, 'backup');
    assert.equal(report.healthySources, 2);
  });

  it('blocks when there is no usable healthy source', () => {
    const report = evaluateDataSourceRedundancy({
      sources: [
        { name: 'binance', status: 'BLOCK', latestClose: null, latencyMs: 500, lastUpdatedAt: 1_000 },
        { name: 'backup', status: 'REVIEW', latestClose: 100, latencyMs: 500, lastUpdatedAt: 1_000 }
      ],
      now: 20_000,
      staleAfterMs: 5_000
    });

    assert.equal(report.status, 'BLOCK');
    assert.equal(report.selectedSource, null);
    assert(report.issues.some(issue => issue.code === 'NO_HEALTHY_DATA_SOURCE'));
  });

  it('reviews divergent prices even when sources are available', () => {
    const report = evaluateDataSourceRedundancy({
      sources: [
        { name: 'binance', status: 'PASS', latestClose: 100, latencyMs: 100, lastUpdatedAt: 1_000 },
        { name: 'backup', status: 'PASS', latestClose: 101, latencyMs: 100, lastUpdatedAt: 1_000 }
      ],
      now: 1_100,
      maxPriceDivergencePercent: 0.5
    });

    assert.equal(report.status, 'REVIEW');
    assert(report.issues.some(issue => issue.code === 'SOURCE_PRICE_DIVERGENCE'));
  });
});
