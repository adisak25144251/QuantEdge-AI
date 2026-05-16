import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateLiveRegimeFromCandles } from './liveRegimeFromCandles';

const candle = (index: number, open: number, high: number, low: number, close: number, volume = 1000) => [
  1_700_000_000_000 + index * 60_000,
  String(open),
  String(high),
  String(low),
  String(close),
  String(volume),
  1_700_000_000_000 + index * 60_000 + 59_999
];

test('evaluateLiveRegimeFromCandles detects live trend from rising candles', () => {
  const candles = Array.from({ length: 80 }, (_, index) => {
    const price = 100 + index * 0.6;
    return candle(index, price, price + 0.9, price - 0.4, price + 0.5, 1000 + index * 10);
  });

  const report = evaluateLiveRegimeFromCandles(candles);

  assert.equal(report.status, 'PASS');
  assert.equal(report.regime.regime, 'TRENDING');
  assert.ok(report.metrics.atrPercent > 0);
});

test('evaluateLiveRegimeFromCandles blocks insufficient candle history', () => {
  const report = evaluateLiveRegimeFromCandles([candle(1, 100, 101, 99, 100)]);

  assert.equal(report.status, 'BLOCK');
  assert.ok(report.issues.some(issue => issue.code === 'INSUFFICIENT_REGIME_HISTORY'));
});
