export type CandlePatternName =
  | 'VCP'
  | 'Triangle Wave 2'
  | 'Triangle Wave 4'
  | 'Bull Flag'
  | 'Cup with Handle'
  | 'Breakout + Retest'
  | 'Volume Dry-Up'
  | 'Base near 52-week high'
  | 'Pattern requires manual confirmation';

export interface PatternCandle {
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlePatternSignal {
  name: CandlePatternName;
  confidence: number;
  evidence: string[];
}

export interface CandlePatternReport {
  primaryPattern: CandlePatternName;
  patternSummary: string;
  signals: CandlePatternSignal[];
  features: {
    candleCount: number;
    distanceFrom52WeekHighPercent: number | null;
    relativeVolume: number | null;
    recentRangePercent: number | null;
    priorRangePercent: number | null;
    fiveDayRunUpPercent: number | null;
    monthlyRunUpPercent: number | null;
    volumeDryUp: boolean;
  };
  warnings: string[];
}

export function detectCandlePatterns(rawCandles: unknown[]): CandlePatternReport {
  const candles = normalizeCandles(rawCandles);
  const warnings: string[] = [];

  if (candles.length < 30) {
    return emptyReport(candles.length, ['Need at least 30 candles for structural pattern detection.']);
  }

  const closes = candles.map(candle => candle.close);
  const highs = candles.map(candle => candle.high);
  const lows = candles.map(candle => candle.low);
  const volumes = candles.map(candle => candle.volume);
  const lastClose = closes[closes.length - 1];
  const high52 = Math.max(...highs.slice(-252));
  const distanceFrom52WeekHighPercent = high52 > 0 ? ((high52 - lastClose) / high52) * 100 : null;
  const recentRangePercent = rangePercent(candles.slice(-20));
  const priorRangePercent = rangePercent(candles.slice(-60, -20));
  const recentVolume = average(volumes.slice(-10));
  const priorVolume = average(volumes.slice(-50, -10));
  const relativeVolume = priorVolume > 0 ? round(recentVolume / priorVolume, 2) : null;
  const volumeDryUp = priorVolume > 0 && recentVolume < priorVolume * 0.75;
  const fiveDayRunUpPercent = percentMove(closes, 5);
  const monthlyRunUpPercent = percentMove(closes, 22);
  const signals = [
    detectVcp(candles, volumeDryUp),
    detectTriangle(candles),
    detectBullFlag(candles),
    detectCupWithHandle(candles),
    detectBreakoutRetest(candles),
    detectBaseNearHigh(distanceFrom52WeekHighPercent, recentRangePercent),
    volumeDryUp
      ? signal('Volume Dry-Up', 72, [
        `10-bar volume is ${Math.round((relativeVolume ?? 0) * 100)}% of prior baseline.`
      ])
      : null
  ].filter(Boolean) as CandlePatternSignal[];

  if (monthlyRunUpPercent !== null && monthlyRunUpPercent > 100 && !signals.some(item => item.name === 'VCP' || item.name === 'Base near 52-week high' || item.name === 'Breakout + Retest')) {
    warnings.push('Monthly run-up exceeds 100% without a confirmed fresh base.');
  }
  if (fiveDayRunUpPercent !== null && fiveDayRunUpPercent > 50) {
    warnings.push('Five-day run-up exceeds 50%; avoid chasing unless a new base forms.');
  }

  const sortedSignals = signals.sort((a, b) => b.confidence - a.confidence);
  const primaryPattern = sortedSignals[0]?.name ?? 'Pattern requires manual confirmation';
  const patternSummary = sortedSignals.length > 0
    ? sortedSignals.slice(0, 3).map(item => item.name).join(' / ')
    : 'Pattern requires manual confirmation';

  return {
    primaryPattern,
    patternSummary,
    signals: sortedSignals,
    features: {
      candleCount: candles.length,
      distanceFrom52WeekHighPercent: distanceFrom52WeekHighPercent === null ? null : round(distanceFrom52WeekHighPercent, 2),
      relativeVolume,
      recentRangePercent: recentRangePercent === null ? null : round(recentRangePercent, 2),
      priorRangePercent: priorRangePercent === null ? null : round(priorRangePercent, 2),
      fiveDayRunUpPercent: fiveDayRunUpPercent === null ? null : round(fiveDayRunUpPercent, 2),
      monthlyRunUpPercent: monthlyRunUpPercent === null ? null : round(monthlyRunUpPercent, 2),
      volumeDryUp
    },
    warnings
  };
}

function detectVcp(candles: PatternCandle[], volumeDryUp: boolean): CandlePatternSignal | null {
  if (candles.length < 60) return null;
  const recent = candles.slice(-60);
  const ranges = [
    rangePercent(recent.slice(0, 20)),
    rangePercent(recent.slice(20, 40)),
    rangePercent(recent.slice(40, 60))
  ];
  if (ranges.some(value => value === null)) return null;
  const [first, second, third] = ranges as number[];
  const contracting = first > second * 1.08 && second > third * 1.08 && third <= 18;
  if (!contracting) return null;

  return signal('VCP', volumeDryUp ? 88 : 78, [
    `Range contraction ${round(first, 1)}% -> ${round(second, 1)}% -> ${round(third, 1)}%.`,
    volumeDryUp ? 'Volume contracts into the latest base.' : 'Volume contraction should be confirmed manually.'
  ]);
}

function detectTriangle(candles: PatternCandle[]): CandlePatternSignal | null {
  if (candles.length < 45) return null;
  const recent = candles.slice(-40);
  const firstHalf = recent.slice(0, 20);
  const secondHalf = recent.slice(20);
  const highsFalling = max(firstHalf.map(candle => candle.high)) > max(secondHalf.map(candle => candle.high)) * 1.01;
  const lowsRising = min(firstHalf.map(candle => candle.low)) < min(secondHalf.map(candle => candle.low)) * 0.99;
  const compression = (rangePercent(secondHalf) ?? 100) < (rangePercent(firstHalf) ?? 0) * 0.85;
  if (!highsFalling || !lowsRising || !compression) return null;

  const priorMove = percentChange(candles[candles.length - 70]?.close ?? candles[0].close, candles[candles.length - 40]?.close ?? candles[0].close);
  const name: CandlePatternName = priorMove > 20 ? 'Triangle Wave 4' : 'Triangle Wave 2';
  return signal(name, 76, [
    'Recent highs are compressing while lows are rising.',
    `Prior impulse estimate: ${round(priorMove, 1)}%.`
  ]);
}

function detectBullFlag(candles: PatternCandle[]): CandlePatternSignal | null {
  if (candles.length < 35) return null;
  const impulseStart = candles[candles.length - 35].close;
  const impulseHigh = max(candles.slice(-35, -10).map(candle => candle.high));
  const lastClose = candles[candles.length - 1].close;
  const impulsePercent = percentChange(impulseStart, impulseHigh);
  const pullbackPercent = percentChange(impulseHigh, lastClose);
  const recentRange = rangePercent(candles.slice(-10));
  if (impulsePercent < 15 || pullbackPercent > -2 || pullbackPercent < -18 || (recentRange ?? 100) > 18) return null;

  return signal('Bull Flag', 74, [
    `Impulse +${round(impulsePercent, 1)}% followed by controlled pullback ${round(pullbackPercent, 1)}%.`,
    `Latest range ${round(recentRange ?? 0, 1)}%.`
  ]);
}

function detectCupWithHandle(candles: PatternCandle[]): CandlePatternSignal | null {
  if (candles.length < 90) return null;
  const sample = candles.slice(-140);
  const left = sample.slice(0, Math.floor(sample.length * 0.35));
  const middle = sample.slice(Math.floor(sample.length * 0.2), Math.floor(sample.length * 0.75));
  const right = sample.slice(Math.floor(sample.length * 0.65));
  const leftHigh = max(left.map(candle => candle.high));
  const trough = min(middle.map(candle => candle.low));
  const rightHigh = max(right.map(candle => candle.high));
  const handle = sample.slice(-15);
  const handlePullback = percentChange(max(handle.map(candle => candle.high)), sample[sample.length - 1].close);
  const cupDepth = percentChange(leftHigh, trough);
  const recovered = Math.abs(percentChange(leftHigh, rightHigh)) <= 12;
  if (cupDepth > -12 || cupDepth < -50 || !recovered || handlePullback < -16) return null;

  return signal('Cup with Handle', 73, [
    `Cup depth ${round(cupDepth, 1)}% with right side near left high.`,
    `Handle pullback ${round(handlePullback, 1)}%.`
  ]);
}

function detectBreakoutRetest(candles: PatternCandle[]): CandlePatternSignal | null {
  if (candles.length < 70) return null;
  const base = candles.slice(-70, -10);
  const recent = candles.slice(-10);
  const baseHigh = max(base.map(candle => candle.high));
  const breakout = recent.some(candle => candle.close > baseHigh * 1.02);
  const retestHeld = recent.some(candle => candle.low <= baseHigh * 1.03 && candle.close >= baseHigh * 0.98);
  if (!breakout || !retestHeld) return null;

  return signal('Breakout + Retest', 82, [
    `Price cleared prior base high near ${round(baseHigh, 2)}.`,
    'Recent pullback/retest held near breakout zone.'
  ]);
}

function detectBaseNearHigh(distanceFrom52WeekHighPercent: number | null, recentRangePercent: number | null): CandlePatternSignal | null {
  if (distanceFrom52WeekHighPercent === null || recentRangePercent === null) return null;
  if (distanceFrom52WeekHighPercent > 20 || recentRangePercent > 25) return null;

  return signal('Base near 52-week high', 70, [
    `Within ${round(distanceFrom52WeekHighPercent, 1)}% of 52-week high.`,
    `Recent base range ${round(recentRangePercent, 1)}%.`
  ]);
}

function normalizeCandles(rawCandles: unknown[]): PatternCandle[] {
  return rawCandles
    .map((raw): PatternCandle | null => {
      if (Array.isArray(raw)) {
        const [time, open, high, low, close, volume] = raw;
        return toValidCandle({ time: Number(time), open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) });
      }
      if (raw && typeof raw === 'object') {
        const candle = raw as Record<string, unknown>;
        return toValidCandle({
          time: Number(candle.time ?? candle.t),
          open: Number(candle.open ?? candle.o),
          high: Number(candle.high ?? candle.h),
          low: Number(candle.low ?? candle.l),
          close: Number(candle.close ?? candle.c),
          volume: Number(candle.volume ?? candle.v)
        });
      }
      return null;
    })
    .filter((candle): candle is PatternCandle => candle !== null)
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

function toValidCandle(candle: PatternCandle): PatternCandle | null {
  const values = [candle.open, candle.high, candle.low, candle.close, candle.volume];
  if (!values.every(Number.isFinite)) return null;
  if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0 || candle.volume < 0) return null;
  if (candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close)) return null;
  return candle;
}

function signal(name: CandlePatternName, confidence: number, evidence: string[]): CandlePatternSignal {
  return { name, confidence, evidence };
}

function emptyReport(candleCount: number, warnings: string[]): CandlePatternReport {
  return {
    primaryPattern: 'Pattern requires manual confirmation',
    patternSummary: 'Pattern requires manual confirmation',
    signals: [],
    features: {
      candleCount,
      distanceFrom52WeekHighPercent: null,
      relativeVolume: null,
      recentRangePercent: null,
      priorRangePercent: null,
      fiveDayRunUpPercent: null,
      monthlyRunUpPercent: null,
      volumeDryUp: false
    },
    warnings
  };
}

function rangePercent(candles: PatternCandle[]): number | null {
  if (candles.length === 0) return null;
  const high = max(candles.map(candle => candle.high));
  const low = min(candles.map(candle => candle.low));
  const reference = Math.max(Math.abs(candles[0].close), 1);
  return ((high - low) / reference) * 100;
}

function percentMove(values: number[], lookback: number): number | null {
  if (values.length <= lookback) return null;
  return percentChange(values[values.length - lookback], values[values.length - 1]);
}

function percentChange(start: number, end: number): number {
  if (!Number.isFinite(start) || start === 0) return 0;
  return ((end - start) / Math.abs(start)) * 100;
}

function average(values: number[]): number {
  const valid = values.filter(Number.isFinite);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function max(values: number[]): number {
  return Math.max(...values.filter(Number.isFinite));
}

function min(values: number[]): number {
  return Math.min(...values.filter(Number.isFinite));
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
