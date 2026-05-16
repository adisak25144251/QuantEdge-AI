import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBacktestCacheKey, evaluateBacktestCacheEntry } from './backtestDataCache';

test('buildBacktestCacheKey is stable for equivalent requests', () => {
  assert.equal(
    buildBacktestCacheKey({ symbol: 'btcusdt', interval: '1h', limit: 500, source: 'binance' }),
    'BINANCE:BTCUSDT:1h:500'
  );
});

test('evaluateBacktestCacheEntry passes fresh complete cached data', () => {
  const report = evaluateBacktestCacheEntry({
    key: 'BINANCE:BTCUSDT:1h:500',
    candleCount: 500,
    createdAt: 1_700_000_000_000,
    expiresAt: 1_700_003_600_000,
    now: 1_700_001_000_000,
    checksum: 'abc'
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.usable, true);
});

test('evaluateBacktestCacheEntry blocks expired or incomplete cached data', () => {
  const report = evaluateBacktestCacheEntry({
    key: 'BINANCE:BTCUSDT:1h:500',
    candleCount: 20,
    createdAt: 1_700_000_000_000,
    expiresAt: 1_700_000_100_000,
    now: 1_700_001_000_000,
    checksum: ''
  });

  assert.equal(report.status, 'BLOCK');
  assert.ok(report.issues.some(issue => issue.code === 'CACHE_EXPIRED'));
  assert.ok(report.issues.some(issue => issue.code === 'CACHE_CHECKSUM_MISSING'));
});
