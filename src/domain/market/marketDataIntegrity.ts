export type MarketDataGateStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type MarketDataIssueSeverity = 'INFO' | 'WARNING' | 'ERROR';

export interface MarketDataIssue {
  code: string;
  severity: MarketDataIssueSeverity;
  message: string;
}

export interface MarketDataIntegrityReport {
  status: MarketDataGateStatus;
  candleCount: number;
  issues: MarketDataIssue[];
  stale: boolean;
  lastCloseTime: number | null;
  requiredMinCandles: number;
}

export interface ValidateKlinesOptions {
  interval: string;
  minCandles?: number;
  now?: number;
  staleAfterIntervals?: number;
}

export interface NormalizedKlineRequest {
  symbol: string;
  interval: string;
  limit: number;
  type: 'CRYPTO' | 'US_STOCK' | 'STOCK' | 'ETF' | 'INDEX' | 'COMMODITY' | 'FOREX' | 'UNKNOWN';
}

export type NormalizeKlineRequestResult =
  | { ok: true; value: NormalizedKlineRequest; issues: MarketDataIssue[] }
  | { ok: false; issues: MarketDataIssue[] };

const SUPPORTED_INTERVALS: Record<string, number> = {
  '1m': 60_000,
  '3m': 3 * 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '2h': 2 * 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '8h': 8 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '1w': 7 * 24 * 60 * 60_000,
  '1M': 30 * 24 * 60 * 60_000
};

const REQUEST_INTERVALS = new Set(['15m', '1h', '4h', '1d', '1w', '1M']);
const REQUEST_TYPES = new Set(['CRYPTO', 'US_STOCK', 'STOCK', 'ETF', 'INDEX', 'COMMODITY', 'FOREX', 'UNKNOWN']);

export function parseIntervalMs(interval: string): number | null {
  return SUPPORTED_INTERVALS[interval] ?? null;
}

export function normalizeKlineRequest(input: Record<string, unknown>): NormalizeKlineRequestResult {
  const issues: MarketDataIssue[] = [];
  const symbol = String(input.symbol ?? '').trim().toUpperCase();
  const interval = String(input.interval ?? '1h').trim();
  const requestedLimit = Number(input.limit ?? 100);
  const rawType = String(input.type ?? 'UNKNOWN').trim().toUpperCase();

  if (!/^[A-Z0-9._=-]{2,30}$/.test(symbol)) {
    issues.push({
      code: 'INVALID_SYMBOL',
      severity: 'ERROR',
      message: 'Symbol must be 2-30 uppercase market characters without separators.'
    });
  }

  if (!REQUEST_INTERVALS.has(interval)) {
    issues.push({
      code: 'INVALID_INTERVAL',
      severity: 'ERROR',
      message: 'Interval is not supported by the app market-data contract.'
    });
  }

  if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
    issues.push({
      code: 'INVALID_LIMIT',
      severity: 'ERROR',
      message: 'Limit must be a positive number.'
    });
  }

  const hardErrors = issues.some(issue => issue.severity === 'ERROR');
  if (hardErrors) {
    return { ok: false, issues };
  }

  const type = REQUEST_TYPES.has(rawType)
    ? rawType as NormalizedKlineRequest['type']
    : 'UNKNOWN';

  return {
    ok: true,
    value: {
      symbol,
      interval,
      limit: Math.min(1000, Math.max(1, Math.floor(requestedLimit))),
      type
    },
    issues
  };
}

export function validateKlines(
  klines: unknown,
  options: ValidateKlinesOptions
): MarketDataIntegrityReport {
  const issues: MarketDataIssue[] = [];
  const candles = Array.isArray(klines) ? klines : [];
  const minCandles = options.minCandles ?? 50;
  const intervalMs = parseIntervalMs(options.interval);

  if (!Array.isArray(klines) || candles.length === 0) {
    issues.push({
      code: 'EMPTY_DATA',
      severity: 'ERROR',
      message: 'No candle data was returned from the market-data source.'
    });
  }

  if (!intervalMs) {
    issues.push({
      code: 'UNSUPPORTED_INTERVAL',
      severity: 'ERROR',
      message: 'Cannot validate staleness for an unsupported interval.'
    });
  }

  let previousOpenTime = Number.NEGATIVE_INFINITY;
  let lastCloseTime: number | null = null;

  for (const rawCandle of candles) {
    if (!isWellFormedCandle(rawCandle)) {
      issues.push({
        code: 'MALFORMED_CANDLE',
        severity: 'ERROR',
        message: 'At least one candle is missing numeric OHLCV or timestamp fields.'
      });
      break;
    }

    const openTime = Number(rawCandle[0]);
    const closeTime = Number(rawCandle[6]);

    if (openTime <= previousOpenTime) {
      issues.push({
        code: 'NON_MONOTONIC_CANDLES',
        severity: 'ERROR',
        message: 'Candle timestamps must be strictly increasing.'
      });
      break;
    }

    previousOpenTime = openTime;
    lastCloseTime = closeTime;
  }

  if (candles.length > 0 && candles.length < minCandles) {
    issues.push({
      code: 'INSUFFICIENT_HISTORY',
      severity: 'ERROR',
      message: `At least ${minCandles} candles are required for this analysis.`
    });
  }

  let stale = false;
  if (intervalMs && lastCloseTime !== null) {
    const now = options.now ?? Date.now();
    const staleAfterIntervals = options.staleAfterIntervals ?? 3;
    stale = now - lastCloseTime > intervalMs * staleAfterIntervals;

    if (stale) {
      issues.push({
        code: 'STALE_DATA',
        severity: 'WARNING',
        message: 'Latest candle is older than the configured market-data freshness window.'
      });
    }
  }

  const status = issues.some(issue => issue.severity === 'ERROR')
    ? 'BLOCK'
    : issues.some(issue => issue.severity === 'WARNING')
      ? 'REVIEW'
      : 'PASS';

  return {
    status,
    candleCount: candles.length,
    issues,
    stale,
    lastCloseTime,
    requiredMinCandles: minCandles
  };
}

function isWellFormedCandle(candle: unknown): candle is unknown[] {
  if (!Array.isArray(candle) || candle.length < 7) return false;

  const openTime = Number(candle[0]);
  const open = Number(candle[1]);
  const high = Number(candle[2]);
  const low = Number(candle[3]);
  const close = Number(candle[4]);
  const volume = Number(candle[5]);
  const closeTime = Number(candle[6]);

  if (![openTime, open, high, low, close, volume, closeTime].every(Number.isFinite)) {
    return false;
  }

  if (openTime <= 0 || closeTime <= openTime) return false;
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) return false;
  if (high < low || high < Math.max(open, close) || low > Math.min(open, close)) return false;

  return true;
}
