import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateUsStockRisk } from './usStockRiskEngine';

describe('usStockRiskEngine', () => {
  it('passes a liquid stock plan with controlled sector, beta, and earnings risk', () => {
    const report = evaluateUsStockRisk({
      symbol: 'MSFT',
      sector: 'Technology',
      accountEquity: 100_000,
      positionUsd: 8_000,
      sectorExposureUsd: 12_000,
      beta: 1.05,
      averageDailyVolumeUsd: 5_000_000_000,
      daysToEarnings: 21,
      overnightHold: false,
      shortSell: false
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.issues.length, 0);
  });

  it('blocks earnings lockout and oversized sector exposure', () => {
    const report = evaluateUsStockRisk({
      symbol: 'TSLA',
      sector: 'Consumer Cyclical',
      accountEquity: 100_000,
      positionUsd: 25_000,
      sectorExposureUsd: 35_000,
      beta: 2.2,
      averageDailyVolumeUsd: 300_000_000,
      daysToEarnings: 2,
      overnightHold: true,
      shortSell: true
    });

    assert.equal(report.status, 'BLOCK');
    assert(report.issues.some(issue => issue.code === 'EARNINGS_LOCKOUT'));
    assert(report.issues.some(issue => issue.code === 'SECTOR_EXPOSURE_EXCEEDED'));
    assert(report.issues.some(issue => issue.code === 'SINGLE_STOCK_EXPOSURE_EXCEEDED'));
  });
});
