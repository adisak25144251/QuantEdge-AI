import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCorrelationRisk } from './correlationRisk';

test('evaluateCorrelationRisk blocks highly correlated same-direction exposure', () => {
  const result = evaluateCorrelationRisk({
    accountEquity: 10_000,
    currentTrades: [
      { id: '1', symbol: 'BTCUSDT', side: 'LONG', sizeUSD: 3_000, status: 'OPEN' },
      { id: '2', symbol: 'ETHUSDT', side: 'LONG', sizeUSD: 2_500, status: 'OPEN' }
    ],
    candidate: { symbol: 'SOLUSDT', side: 'LONG', sizeUsd: 2_000 },
    correlations: [
      { a: 'BTCUSDT', b: 'SOLUSDT', value: 0.86 },
      { a: 'ETHUSDT', b: 'SOLUSDT', value: 0.82 }
    ],
    maxCorrelatedExposurePercent: 60
  });

  assert.equal(result.status, 'BLOCK');
  assert.equal(result.correlatedExposurePercent, 75);
  assert.ok(result.issues.some(issue => issue.code === 'CORRELATED_EXPOSURE_EXCEEDED'));
});

test('evaluateCorrelationRisk reviews unknown correlations instead of pretending precision', () => {
  const result = evaluateCorrelationRisk({
    accountEquity: 10_000,
    currentTrades: [{ id: '1', symbol: 'XAUUSD', side: 'LONG', sizeUSD: 1_000, status: 'OPEN' }],
    candidate: { symbol: 'US100', side: 'SHORT', sizeUsd: 1_000 },
    correlations: []
  });

  assert.equal(result.status, 'REVIEW');
  assert.ok(result.issues.some(issue => issue.code === 'CORRELATION_DATA_MISSING'));
});
