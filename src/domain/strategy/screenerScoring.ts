export interface ScreenerMarketInput {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
}

export interface ScreenerSetupScore {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  logic: string;
  lastPrice: string;
  priceChange: string;
  score: number;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const scoreScreenerSetup = (input: ScreenerMarketInput): ScreenerSetupScore => {
  const momentum = Number(input.priceChangePercent) || 0;
  const volume = Math.max(Number(input.volume) || 0, 0);
  const volumeScore = clamp(Math.log10(volume + 1), 0, 12);
  const momentumScore = clamp(Math.abs(momentum) * 4, 0, 28);
  const confidence = Math.round(clamp(60 + momentumScore + volumeScore, 60, 95));

  const direction = momentum >= 0 ? 'LONG' : 'SHORT';
  const logic = momentum >= 2
    ? 'Momentum continuation'
    : momentum <= -2
      ? 'Bearish momentum continuation'
      : 'Range watch';

  return {
    symbol: input.symbol,
    direction,
    confidence,
    logic,
    lastPrice: (Number(input.lastPrice) || 0).toFixed(4),
    priceChange: momentum.toFixed(2),
    score: confidence + Math.abs(momentum),
  };
};
