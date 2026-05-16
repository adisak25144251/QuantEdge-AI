import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioExposureMap } from './portfolioExposureMap';

describe('portfolioExposureMap', () => {
  it('groups open exposure by direction, asset class, and correlation cluster', () => {
    const report = buildPortfolioExposureMap({
      accountEquity: 100_000,
      trades: [
        { id: '1', symbol: 'BTCUSDT', side: 'LONG', sizeUSD: 25_000, status: 'OPEN', assetClass: 'CRYPTO', correlationCluster: 'crypto majors' },
        { id: '2', symbol: 'ETHUSDT', side: 'LONG', sizeUSD: 30_000, status: 'OPEN', assetClass: 'CRYPTO', correlationCluster: 'crypto majors' },
        { id: '3', symbol: 'XAUUSD', side: 'SHORT', sizeUSD: 10_000, status: 'OPEN', assetClass: 'COMMODITY', correlationCluster: 'gold' }
      ],
      maxClusterExposurePercent: 50,
      maxDirectionExposurePercent: 70
    });

    assert.equal(report.status, 'BLOCK');
    assert.equal(report.grossExposurePercent, 65);
    assert.equal(report.byDirection.LONG.exposurePercent, 55);
    assert.equal(report.byAssetClass.CRYPTO.exposurePercent, 55);
    assert.equal(report.byCluster['crypto majors'].exposurePercent, 55);
    assert(report.issues.some(issue => issue.code === 'CLUSTER_EXPOSURE_EXCEEDED'));
  });

  it('ignores closed trades and passes diversified exposure', () => {
    const report = buildPortfolioExposureMap({
      accountEquity: 100_000,
      trades: [
        { id: '1', symbol: 'BTCUSDT', side: 'LONG', sizeUSD: 20_000, status: 'OPEN' },
        { id: '2', symbol: 'US500', side: 'SHORT', sizeUSD: 15_000, status: 'OPEN' },
        { id: '3', symbol: 'ETHUSDT', side: 'LONG', sizeUSD: 80_000, status: 'WON' }
      ]
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.openTrades, 2);
    assert.equal(report.grossExposureUsd, 35_000);
  });
});
