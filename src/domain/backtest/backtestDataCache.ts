export type BacktestCacheStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface BacktestCacheRequest {
  symbol: string;
  interval: string;
  limit: number;
  source: string;
}

export interface BacktestCacheEntry {
  key: string;
  candleCount: number;
  createdAt: number;
  expiresAt: number;
  now: number;
  checksum: string;
  minCandles?: number;
}

export interface BacktestCacheIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface BacktestCacheReport {
  status: BacktestCacheStatus;
  usable: boolean;
  issues: BacktestCacheIssue[];
}

export function buildBacktestCacheKey(input: BacktestCacheRequest): string {
  return [
    input.source.trim().toUpperCase(),
    input.symbol.trim().toUpperCase(),
    input.interval.trim(),
    Math.max(1, Math.floor(input.limit))
  ].join(':');
}

export function evaluateBacktestCacheEntry(entry: BacktestCacheEntry): BacktestCacheReport {
  const issues: BacktestCacheIssue[] = [];
  const minCandles = entry.minCandles ?? 50;

  if (entry.now > entry.expiresAt) {
    issues.push({ code: 'CACHE_EXPIRED', severity: 'ERROR', message: 'Cached historical candles are expired.' });
  }
  if (entry.candleCount < minCandles) {
    issues.push({ code: 'CACHE_HISTORY_TOO_SMALL', severity: 'ERROR', message: `Cache needs at least ${minCandles} candles.` });
  }
  if (!entry.checksum) {
    issues.push({ code: 'CACHE_CHECKSUM_MISSING', severity: 'ERROR', message: 'Cache checksum is missing.' });
  }

  const status = issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS';
  return {
    status,
    usable: status === 'PASS',
    issues
  };
}
