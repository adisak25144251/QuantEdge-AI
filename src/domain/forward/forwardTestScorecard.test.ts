import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeForwardTests } from './forwardTestScorecard';

test('summarizeForwardTests reports hit rate, expectancy, MFE and MAE after issued signals', () => {
  const summary = summarizeForwardTests([
    { id: 's1', side: 'LONG', entry: 100, stopLoss: 95, takeProfit: 110, maxFavorablePrice: 111, maxAdversePrice: 98, finalPrice: 110, outcome: 'TP', issuedAt: '2026-01-01T00:00:00Z', resolvedAt: '2026-01-01T04:00:00Z' },
    { id: 's2', side: 'LONG', entry: 100, stopLoss: 95, takeProfit: 110, maxFavorablePrice: 104, maxAdversePrice: 94, finalPrice: 95, outcome: 'SL', issuedAt: '2026-01-02T00:00:00Z', resolvedAt: '2026-01-02T02:00:00Z' }
  ]);

  assert.equal(summary.totalSignals, 2);
  assert.equal(summary.hitRate, 50);
  assert.equal(summary.expectancyR, 0.5);
  assert.equal(summary.averageMfeR, 1.5);
  assert.equal(summary.averageMaeR, 0.8);
});

test('summarizeForwardTests marks thin forward evidence as review', () => {
  const summary = summarizeForwardTests([
    { id: 's1', side: 'SHORT', entry: 100, stopLoss: 104, takeProfit: 92, maxFavorablePrice: 97, maxAdversePrice: 101, finalPrice: 98, outcome: 'OPEN', issuedAt: '2026-01-01T00:00:00Z' }
  ], { minSignals: 10 });

  assert.equal(summary.status, 'REVIEW');
  assert.ok(summary.issues.some(issue => issue.code === 'FORWARD_SAMPLE_TOO_SMALL'));
});
