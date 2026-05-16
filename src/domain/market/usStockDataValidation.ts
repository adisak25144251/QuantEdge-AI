export type UsStockDataStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type UsMarketSessionState = 'REGULAR_OPEN' | 'PREMARKET' | 'AFTER_HOURS' | 'WEEKEND_CLOSED';

export interface UsStockDataIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface UsStockDataValidationInput {
  symbol: string;
  interval: string;
  candles: unknown[];
  now?: number;
  minCandles?: number;
  minVolume?: number;
}

export interface UsStockDataValidationReport {
  status: UsStockDataStatus;
  sessionState: UsMarketSessionState;
  candleCount: number;
  issues: UsStockDataIssue[];
}

export function validateUsStockCandles(input: UsStockDataValidationInput): UsStockDataValidationReport {
  const issues: UsStockDataIssue[] = [];
  const candles = Array.isArray(input.candles) ? input.candles : [];
  const minCandles = input.minCandles ?? 50;
  const minVolume = input.minVolume ?? 500_000;
  const now = input.now ?? Date.now();
  const sessionState = getUsMarketSessionState(now);

  if (!/^[A-Z]{1,5}$/.test(String(input.symbol).toUpperCase()) && !/^[A-Z]{2,5}$/.test(String(input.symbol).toUpperCase())) {
    issues.push({ code: 'INVALID_US_STOCK_SYMBOL', severity: 'ERROR', message: 'US stock symbol is invalid.' });
  }

  if (candles.length < minCandles) {
    issues.push({ code: 'INSUFFICIENT_STOCK_HISTORY', severity: 'ERROR', message: `Need at least ${minCandles} stock candles.` });
  }

  let previousTime = Number.NEGATIVE_INFINITY;
  let previousClose: number | null = null;

  for (const raw of candles) {
    if (!isCandle(raw)) {
      issues.push({ code: 'MALFORMED_STOCK_CANDLE', severity: 'ERROR', message: 'Stock candle is malformed.' });
      break;
    }

    const time = Number(raw[0]);
    const close = Number(raw[4]);
    const volume = Number(raw[5]);

    if (time <= previousTime) {
      issues.push({ code: 'NON_MONOTONIC_STOCK_CANDLES', severity: 'ERROR', message: 'Stock candles must be strictly increasing.' });
      break;
    }

    if (volume < minVolume) {
      issues.push({ code: 'LOW_STOCK_VOLUME', severity: 'WARNING', message: 'Stock candle volume is below liquidity threshold.' });
    }

    if (previousClose !== null) {
      const gap = Math.abs(close - previousClose) / Math.max(Math.abs(previousClose), 1);
      if (gap >= 0.45) {
        issues.push({ code: 'POSSIBLE_UNADJUSTED_SPLIT', severity: 'ERROR', message: 'Large price discontinuity suggests unadjusted split data.' });
      }
    }

    previousTime = time;
    previousClose = close;
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    sessionState,
    candleCount: candles.length,
    issues: dedupeIssues(issues)
  };
}

export function getUsMarketSessionState(now: number): UsMarketSessionState {
  const date = new Date(now);
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return 'WEEKEND_CLOSED';

  const minutesUtc = date.getUTCHours() * 60 + date.getUTCMinutes();
  const regularOpen = 13 * 60 + 30;
  const regularClose = 20 * 60;
  if (minutesUtc >= regularOpen && minutesUtc < regularClose) return 'REGULAR_OPEN';
  if (minutesUtc >= 8 * 60 && minutesUtc < regularOpen) return 'PREMARKET';
  return 'AFTER_HOURS';
}

function isCandle(candle: unknown): candle is unknown[] {
  if (!Array.isArray(candle) || candle.length < 7) return false;
  const values = [candle[0], candle[1], candle[2], candle[3], candle[4], candle[5], candle[6]].map(Number);
  if (!values.every(Number.isFinite)) return false;
  const [, open, high, low, close, volume] = values;
  return open > 0 && high >= low && high >= Math.max(open, close) && low <= Math.min(open, close) && volume >= 0;
}

function dedupeIssues(issues: UsStockDataIssue[]): UsStockDataIssue[] {
  const seen = new Set<string>();
  return issues.filter(issue => {
    if (seen.has(issue.code)) return false;
    seen.add(issue.code);
    return true;
  });
}
