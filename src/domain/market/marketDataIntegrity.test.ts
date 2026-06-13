import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeKlineRequest,
  parseIntervalMs,
  validateKlines
} from './marketDataIntegrity';

const makeCandle = (openTime: number, price = 100) => [
  openTime,
  String(price),
  String(price + 2),
  String(price - 2),
  String(price + 1),
  '1200',
  openTime + 59_999,
  '0',
  100,
  '0',
  '0',
  '0'
];

test('parseIntervalMs supports the app trading intervals', () => {
  assert.equal(parseIntervalMs('15m'), 15 * 60 * 1000);
  assert.equal(parseIntervalMs('1h'), 60 * 60 * 1000);
  assert.equal(parseIntervalMs('4h'), 4 * 60 * 60 * 1000);
  assert.equal(parseIntervalMs('1d'), 24 * 60 * 60 * 1000);
});

test('normalizeKlineRequest uppercases symbol and clamps limit', () => {
  const normalized = normalizeKlineRequest({
    symbol: 'btcusdt',
    interval: '1h',
    limit: '2000',
    type: 'CRYPTO'
  });

  assert.equal(normalized.ok, true);
  if (!normalized.ok) return;
  assert.equal(normalized.value.symbol, 'BTCUSDT');
  assert.equal(normalized.value.limit, 1000);
  assert.equal(normalized.value.interval, '1h');
});

test('normalizeKlineRequest preserves US stock and ETF request types', () => {
  const stock = normalizeKlineRequest({
    symbol: 'nvda',
    interval: '1d',
    limit: '250',
    type: 'US_STOCK'
  });
  const etf = normalizeKlineRequest({
    symbol: 'spy',
    interval: '1d',
    limit: '250',
    type: 'ETF'
  });

  assert.equal(stock.ok, true);
  assert.equal(etf.ok, true);
  if (!stock.ok || !etf.ok) return;
  assert.equal(stock.value.type, 'US_STOCK');
  assert.equal(etf.value.type, 'ETF');
});

test('normalizeKlineRequest rejects unsupported symbols and intervals', () => {
  const normalized = normalizeKlineRequest({
    symbol: 'BTC/USDT',
    interval: '2h',
    limit: '100'
  });

  assert.equal(normalized.ok, false);
  if (normalized.ok) return;
  assert.deepEqual(
    normalized.issues.map(issue => issue.code),
    ['INVALID_SYMBOL', 'INVALID_INTERVAL']
  );
});

test('validateKlines blocks empty data before indicators run', () => {
  const report = validateKlines([], {
    interval: '1h',
    minCandles: 50,
    now: 1_700_000_000_000
  });

  assert.equal(report.status, 'BLOCK');
  assert.equal(report.candleCount, 0);
  assert.equal(report.issues.some(issue => issue.code === 'EMPTY_DATA'), true);
});

test('validateKlines blocks malformed candles', () => {
  const report = validateKlines([
    makeCandle(1_700_000_000_000),
    [1_700_000_060_000, 'bad', '102']
  ], {
    interval: '1m',
    minCandles: 2,
    now: 1_700_000_120_000
  });

  assert.equal(report.status, 'BLOCK');
  assert.equal(report.issues.some(issue => issue.code === 'MALFORMED_CANDLE'), true);
});

test('validateKlines marks stale but otherwise usable data for review', () => {
  const now = 1_700_000_000_000;
  const candles = Array.from({ length: 60 }, (_, index) =>
    makeCandle(now - (120 - index) * 60_000, 100 + index)
  );

  const report = validateKlines(candles, {
    interval: '1m',
    minCandles: 50,
    now,
    staleAfterIntervals: 3
  });

  assert.equal(report.status, 'REVIEW');
  assert.equal(report.stale, true);
  assert.equal(report.issues.some(issue => issue.code === 'STALE_DATA'), true);
});

test('validateKlines passes fresh monotonic candles with enough history', () => {
  const now = 1_700_000_000_000;
  const candles = Array.from({ length: 80 }, (_, index) =>
    makeCandle(now - (79 - index) * 60_000, 100 + index)
  );

  const report = validateKlines(candles, {
    interval: '1m',
    minCandles: 50,
    now,
    staleAfterIntervals: 3
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.stale, false);
  assert.equal(report.issues.length, 0);
});

test('validateKlines blocks candles with impossible future timestamps', () => {
  const now = 1_700_000_000_000;
  const candles = [
    makeCandle(now - 60_000, 100),
    makeCandle(now + 5 * 60_000, 101)
  ];

  const report = validateKlines(candles, {
    interval: '1m',
    minCandles: 2,
    now
  });

  assert.equal(report.status, 'BLOCK');
  assert.equal(report.issues.some(issue => issue.code === 'FUTURE_CANDLE'), true);
});
