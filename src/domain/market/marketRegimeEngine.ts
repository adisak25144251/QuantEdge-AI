export type LiveMarketRegime = 'TRENDING' | 'RANGING' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY' | 'UNKNOWN';
export type VolatilityState = 'LOW' | 'NORMAL' | 'ELEVATED' | 'SHOCK';
export type StrategyFamily = 'TREND_FOLLOWING' | 'MEAN_REVERSION' | 'BREAKOUT' | 'SCALPING';

export interface MarketRegimeInput {
  adx: number;
  atrPercent: number;
  emaFast: number;
  emaSlow: number;
  realizedVolatilityPercent: number;
  volumeZScore: number;
}

export interface MarketRegimeReport {
  regime: LiveMarketRegime;
  volatility: VolatilityState;
  confidence: number;
  reasons: string[];
}

export function evaluateMarketRegime(input: MarketRegimeInput): MarketRegimeReport {
  if (![input.adx, input.atrPercent, input.emaFast, input.emaSlow, input.realizedVolatilityPercent, input.volumeZScore].every(Number.isFinite)) {
    return { regime: 'UNKNOWN', volatility: 'NORMAL', confidence: 0, reasons: ['Input metrics are incomplete.'] };
  }

  const emaSeparationPercent = Math.abs(input.emaFast - input.emaSlow) / Math.max(Math.abs(input.emaSlow), 1) * 100;
  const volatility = classifyVolatility(input.realizedVolatilityPercent, input.atrPercent);
  const reasons: string[] = [];
  let regime: LiveMarketRegime = 'UNKNOWN';
  let confidence = 45;

  if (input.atrPercent >= 3.5 || volatility === 'SHOCK') {
    regime = 'HIGH_VOLATILITY';
    confidence += 25;
    reasons.push('ATR or realized volatility indicates a shock environment.');
  } else if (input.atrPercent <= 0.35 && input.adx < 20) {
    regime = 'LOW_VOLATILITY';
    confidence += 20;
    reasons.push('ATR and trend strength are muted.');
  } else if (input.adx >= 25 && emaSeparationPercent >= 0.5) {
    regime = 'TRENDING';
    confidence += 25;
    reasons.push('ADX and EMA separation confirm trend structure.');
  } else if (input.adx <= 18 && emaSeparationPercent < 0.75) {
    regime = 'RANGING';
    confidence += 20;
    reasons.push('Low ADX and compressed EMAs indicate range structure.');
  }

  if (Math.abs(input.volumeZScore) >= 1) {
    confidence += 8;
    reasons.push('Volume is meaningfully away from baseline.');
  }

  if (volatility === 'ELEVATED') {
    confidence += 5;
    reasons.push('Volatility is elevated but not at shock level.');
  }

  return {
    regime,
    volatility,
    confidence: clamp(Math.round(confidence), 0, 100),
    reasons
  };
}

export function isStrategyAllowedInRegime(strategy: StrategyFamily, regime: LiveMarketRegime): boolean {
  const allowed: Record<StrategyFamily, LiveMarketRegime[]> = {
    TREND_FOLLOWING: ['TRENDING', 'HIGH_VOLATILITY'],
    MEAN_REVERSION: ['RANGING', 'LOW_VOLATILITY'],
    BREAKOUT: ['TRENDING', 'RANGING'],
    SCALPING: ['RANGING', 'LOW_VOLATILITY']
  };

  return allowed[strategy].includes(regime);
}

function classifyVolatility(realizedVolatilityPercent: number, atrPercent: number): VolatilityState {
  const volatility = Math.max(realizedVolatilityPercent, atrPercent);
  if (volatility >= 4.5) return 'SHOCK';
  if (volatility >= 2.5) return 'ELEVATED';
  if (volatility <= 0.4) return 'LOW';
  return 'NORMAL';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
