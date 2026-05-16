import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateUsStockCandles } from './usStockDataValidation';

const candle = (day: number, close = 100, volume = 1_000_000) => [
  Date.parse(`2026-05-${String(day).padStart(2, '0')}T20:00:00.000Z`),
  String(close - 1),
  String(close + 1),
  String(close - 2),
  String(close),
  String(volume),
  Date.parse(`2026-05-${String(day).padStart(2, '0')}T20:00:00.000Z`) + 60_000
];

describe('usStockDataValidation', () => {
  it('passes clean daily stock candles after the market close', () => {
    const report = validateUsStockCandles({
      symbol: 'AAPL',
      interval: '1d',
      candles: [candle(4), candle(5), candle(6), candle(7), candle(8)],
      now: Date.parse('2026-05-10T10:00:00.000Z'),
      minCandles: 5
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.sessionState, 'WEEKEND_CLOSED');
    assert.equal(report.issues.length, 0);
  });

  it('reviews low volume and blocks split-like unadjusted price discontinuity', () => {
    const report = validateUsStockCandles({
      symbol: 'NVDA',
      interval: '1d',
      candles: [candle(4, 100), candle(5, 101), candle(6, 50, 100)],
      now: Date.parse('2026-05-06T21:00:00.000Z'),
      minCandles: 3
    });

    assert.equal(report.status, 'BLOCK');
    assert(report.issues.some(issue => issue.code === 'POSSIBLE_UNADJUSTED_SPLIT'));
    assert(report.issues.some(issue => issue.code === 'LOW_STOCK_VOLUME'));
  });
});
