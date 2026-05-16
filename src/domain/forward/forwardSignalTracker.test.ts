import assert from 'node:assert/strict';
import test from 'node:test';
import { trackForwardSignal } from './forwardSignalTracker';

test('trackForwardSignal resolves long signal at take profit and records MFE/MAE', () => {
  const result = trackForwardSignal({
    id: 'fwd-1',
    side: 'LONG',
    entry: 100,
    stopLoss: 95,
    takeProfit: 110,
    issuedAt: '2026-01-01T00:00:00Z',
    candles: [
      { high: 103, low: 99, close: 102, closeTime: '2026-01-01T01:00:00Z' },
      { high: 111, low: 101, close: 110, closeTime: '2026-01-01T02:00:00Z' }
    ]
  });

  assert.equal(result.outcome, 'TP');
  assert.equal(result.maxFavorablePrice, 111);
  assert.equal(result.maxAdversePrice, 99);
});

test('trackForwardSignal expires unresolved signals after max candles', () => {
  const result = trackForwardSignal({
    id: 'fwd-2',
    side: 'SHORT',
    entry: 100,
    stopLoss: 105,
    takeProfit: 90,
    issuedAt: '2026-01-01T00:00:00Z',
    maxCandles: 1,
    candles: [{ high: 102, low: 97, close: 98, closeTime: '2026-01-01T01:00:00Z' }]
  });

  assert.equal(result.outcome, 'EXPIRED');
  assert.equal(result.finalPrice, 98);
});
