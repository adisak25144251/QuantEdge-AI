import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateUnifiedDataReliabilityV2 } from './unifiedDataReliabilityV2';

describe('unifiedDataReliabilityV2', () => {
  it('passes diversified fresh sources with checksum coverage', () => {
    const report = evaluateUnifiedDataReliabilityV2({
      sources: [
        { name: 'binance', assetType: 'CRYPTO', status: 'PASS', freshnessMs: 1_000, checksumPresent: true, confidence: 94 },
        { name: 'yahoo', assetType: 'US_STOCK', status: 'PASS', freshnessMs: 60_000, checksumPresent: true, confidence: 88 }
      ],
      maxFreshnessMs: 300_000,
      minConfidence: 80
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.sourceConfidenceScore, 91);
    assert.equal(report.assetTypesCovered, 2);
  });

  it('blocks stale or unchecked market data before analysis escalation', () => {
    const report = evaluateUnifiedDataReliabilityV2({
      sources: [
        { name: 'stale-stock', assetType: 'US_STOCK', status: 'PASS', freshnessMs: 900_000, checksumPresent: false, confidence: 55 }
      ]
    });

    assert.equal(report.status, 'BLOCK');
    assert(report.issues.some(issue => issue.code === 'SOURCE_STALE'));
    assert(report.issues.some(issue => issue.code === 'CHECKSUM_MISSING'));
  });
});
