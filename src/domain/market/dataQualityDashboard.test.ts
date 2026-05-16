import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeDataQuality } from './dataQualityDashboard';

test('summarizeDataQuality passes diversified clean sources', () => {
  const summary = summarizeDataQuality([
    { source: 'binance', symbol: 'BTCUSDT', status: 'PASS', candleCount: 500, issues: [] },
    { source: 'yahoo', symbol: 'XAUUSD', status: 'PASS', candleCount: 420, issues: [] }
  ]);

  assert.equal(summary.status, 'PASS');
  assert.equal(summary.sourceCount, 2);
  assert.equal(summary.totalCandles, 920);
  assert.equal(summary.cleanSourceRate, 100);
});

test('summarizeDataQuality blocks malformed or stale market data', () => {
  const summary = summarizeDataQuality([
    {
      source: 'binance',
      symbol: 'ETHUSDT',
      status: 'BLOCK',
      candleCount: 0,
      issues: [{ code: 'EMPTY_CANDLES', severity: 'ERROR', message: 'No candles.' }]
    },
    {
      source: 'yahoo',
      symbol: 'US100',
      status: 'REVIEW',
      candleCount: 200,
      issues: [{ code: 'STALE_LAST_CANDLE', severity: 'WARNING', message: 'Stale.' }]
    }
  ]);

  assert.equal(summary.status, 'BLOCK');
  assert.deepEqual(summary.issueCodes, ['EMPTY_CANDLES', 'STALE_LAST_CANDLE']);
  assert.equal(summary.cleanSourceRate, 0);
});
