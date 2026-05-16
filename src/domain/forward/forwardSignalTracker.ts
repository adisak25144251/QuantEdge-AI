import type { ForwardSignalResult } from './forwardTestScorecard';

export interface ForwardTrackingCandle {
  high: number;
  low: number;
  close: number;
  closeTime: string;
}

export interface ForwardSignalTrackingInput {
  id: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  issuedAt: string;
  candles: ForwardTrackingCandle[];
  maxCandles?: number;
}

export function trackForwardSignal(input: ForwardSignalTrackingInput): ForwardSignalResult {
  const maxCandles = input.maxCandles ?? input.candles.length;
  const observed = input.candles.slice(0, maxCandles);
  let outcome: ForwardSignalResult['outcome'] = 'OPEN';
  let resolvedAt: string | undefined;
  let finalPrice = observed[observed.length - 1]?.close ?? input.entry;
  let maxFavorablePrice = input.entry;
  let maxAdversePrice = input.entry;

  for (const candle of observed) {
    if (input.side === 'LONG') {
      maxFavorablePrice = Math.max(maxFavorablePrice, candle.high);
      maxAdversePrice = Math.min(maxAdversePrice, candle.low);
      if (candle.low <= input.stopLoss) {
        outcome = 'SL';
        finalPrice = input.stopLoss;
        resolvedAt = candle.closeTime;
        break;
      }
      if (candle.high >= input.takeProfit) {
        outcome = 'TP';
        finalPrice = input.takeProfit;
        resolvedAt = candle.closeTime;
        break;
      }
    } else {
      maxFavorablePrice = Math.min(maxFavorablePrice, candle.low);
      maxAdversePrice = Math.max(maxAdversePrice, candle.high);
      if (candle.high >= input.stopLoss) {
        outcome = 'SL';
        finalPrice = input.stopLoss;
        resolvedAt = candle.closeTime;
        break;
      }
      if (candle.low <= input.takeProfit) {
        outcome = 'TP';
        finalPrice = input.takeProfit;
        resolvedAt = candle.closeTime;
        break;
      }
    }
  }

  if (outcome === 'OPEN' && observed.length >= maxCandles && maxCandles > 0) {
    outcome = 'EXPIRED';
    resolvedAt = observed[observed.length - 1]?.closeTime;
  }

  return {
    id: input.id,
    side: input.side,
    entry: input.entry,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    maxFavorablePrice,
    maxAdversePrice,
    finalPrice,
    outcome,
    issuedAt: input.issuedAt,
    resolvedAt
  };
}
