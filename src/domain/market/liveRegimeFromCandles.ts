import { evaluateMarketRegime, type MarketRegimeReport } from './marketRegimeEngine';

export type LiveRegimeStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface LiveRegimeIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface LiveRegimeMetrics {
  atrPercent: number;
  emaFast: number;
  emaSlow: number;
  realizedVolatilityPercent: number;
  volumeZScore: number;
  adxProxy: number;
}

export interface LiveRegimeFromCandlesReport {
  status: LiveRegimeStatus;
  regime: MarketRegimeReport;
  metrics: LiveRegimeMetrics;
  issues: LiveRegimeIssue[];
}

interface CandlePoint {
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function evaluateLiveRegimeFromCandles(rawCandles: unknown, minCandles = 50): LiveRegimeFromCandlesReport {
  const candles = normalizeCandles(rawCandles);
  const issues: LiveRegimeIssue[] = [];

  if (candles.length < minCandles) {
    issues.push({
      code: 'INSUFFICIENT_REGIME_HISTORY',
      severity: 'ERROR',
      message: `Need at least ${minCandles} candles for live regime evaluation.`
    });
  }

  if (candles.length < 2) {
    return {
      status: 'BLOCK',
      regime: evaluateMarketRegime(emptyMetricsInput()),
      metrics: emptyMetrics(),
      issues
    };
  }

  const closes = candles.map(candle => candle.close);
  const volumes = candles.map(candle => candle.volume);
  const emaFast = ema(closes, 12);
  const emaSlow = ema(closes, 26);
  const atr = averageTrueRange(candles, 14);
  const lastClose = closes[closes.length - 1] || 1;
  const atrPercent = (atr / lastClose) * 100;
  const realizedVolatilityPercent = stdev(returns(closes).slice(-20)) * Math.sqrt(20) * 100;
  const volumeZScore = zScore(volumes[volumes.length - 1], volumes.slice(-30));
  const adxProxy = trendStrengthProxy(closes);
  const metrics = {
    atrPercent: round(atrPercent, 2),
    emaFast: round(emaFast, 4),
    emaSlow: round(emaSlow, 4),
    realizedVolatilityPercent: round(realizedVolatilityPercent, 2),
    volumeZScore: round(volumeZScore, 2),
    adxProxy: round(adxProxy, 2)
  };

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : 'PASS',
    regime: evaluateMarketRegime({
      adx: metrics.adxProxy,
      atrPercent: metrics.atrPercent,
      emaFast: metrics.emaFast,
      emaSlow: metrics.emaSlow,
      realizedVolatilityPercent: metrics.realizedVolatilityPercent,
      volumeZScore: metrics.volumeZScore
    }),
    metrics,
    issues
  };
}

function normalizeCandles(rawCandles: unknown): CandlePoint[] {
  if (!Array.isArray(rawCandles)) return [];
  return rawCandles.flatMap(raw => {
    if (Array.isArray(raw) && raw.length >= 6) {
      const high = Number(raw[2]);
      const low = Number(raw[3]);
      const close = Number(raw[4]);
      const volume = Number(raw[5]);
      return [high, low, close, volume].every(Number.isFinite) ? [{ high, low, close, volume }] : [];
    }
    if (raw && typeof raw === 'object') {
      const item = raw as Record<string, unknown>;
      const high = Number(item.high);
      const low = Number(item.low);
      const close = Number(item.close);
      const volume = Number(item.volume ?? 0);
      return [high, low, close, volume].every(Number.isFinite) ? [{ high, low, close, volume }] : [];
    }
    return [];
  });
}

function averageTrueRange(candles: CandlePoint[], period: number): number {
  const ranges = candles.slice(-period).map((candle, index, slice) => {
    const previousClose = index > 0 ? slice[index - 1].close : candle.close;
    return Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  });
  return ranges.length > 0 ? avg(ranges) : 0;
}

function trendStrengthProxy(closes: number[]): number {
  const recent = closes.slice(-30);
  if (recent.length < 2) return 0;
  const netMove = Math.abs(recent[recent.length - 1] - recent[0]);
  const path = recent.slice(1).reduce((sum, close, index) => sum + Math.abs(close - recent[index]), 0);
  return path > 0 ? Math.min(50, (netMove / path) * 50) : 0;
}

function ema(values: number[], period: number): number {
  const alpha = 2 / (period + 1);
  return values.reduce((previous, value, index) => index === 0 ? value : value * alpha + previous * (1 - alpha), values[0] ?? 0);
}

function returns(values: number[]): number[] {
  return values.slice(1).map((value, index) => {
    const previous = values[index];
    return previous > 0 ? (value - previous) / previous : 0;
  });
}

function zScore(value: number, values: number[]): number {
  const mean = avg(values);
  const deviation = stdev(values);
  return deviation > 0 ? (value - mean) / deviation : 0;
}

function stdev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = avg(values);
  return Math.sqrt(avg(values.map(value => (value - mean) ** 2)));
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function emptyMetrics(): LiveRegimeMetrics {
  return { atrPercent: 0, emaFast: 0, emaSlow: 0, realizedVolatilityPercent: 0, volumeZScore: 0, adxProxy: 0 };
}

function emptyMetricsInput() {
  return { adx: Number.NaN, atrPercent: Number.NaN, emaFast: Number.NaN, emaSlow: Number.NaN, realizedVolatilityPercent: Number.NaN, volumeZScore: Number.NaN };
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
