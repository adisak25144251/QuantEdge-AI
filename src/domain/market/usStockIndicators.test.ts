import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUsStockIndicators } from './usStockIndicators';

describe('usStockIndicators', () => {
  it('computes relative strength, gap, volume confirmation, and sector alignment', () => {
    const report = analyzeUsStockIndicators({
      symbol: 'NVDA',
      closes: [100, 102, 104, 108, 112],
      benchmarkCloses: [100, 101, 102, 103, 104],
      opens: [99, 101, 103, 106, 110],
      volumes: [1_000_000, 1_100_000, 1_200_000, 1_300_000, 2_500_000],
      sectorStrengthPercent: 1.5
    });

    assert.equal(report.status, 'PASS');
    assert(report.relativeStrengthPercent > 0);
    assert.equal(report.volumeConfirmation, 'CONFIRMED');
    assert.equal(report.sectorAlignment, 'ALIGNED');
  });

  it('reviews weak benchmark relative strength and low volume confirmation', () => {
    const report = analyzeUsStockIndicators({
      symbol: 'AAPL',
      closes: [100, 99, 98, 97, 96],
      benchmarkCloses: [100, 101, 102, 103, 104],
      opens: [100, 99, 98, 97, 96],
      volumes: [1_000_000, 1_100_000, 1_200_000, 1_300_000, 500_000],
      sectorStrengthPercent: -1
    });

    assert.equal(report.status, 'REVIEW');
    assert(report.issues.some(issue => issue.code === 'RELATIVE_STRENGTH_WEAK'));
  });
});
