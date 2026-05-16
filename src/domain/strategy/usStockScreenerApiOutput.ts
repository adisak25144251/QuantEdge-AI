export type UsStockScreenerApiRow = {
  ticker: string;
  company: string;
  theme: string;
  price: number | null;
  marketCap: number | null;
  avgVolume: number | null;
  relativeVolume: number | null;
  rsi: number | null;
  sma20Status: string;
  sma50Status: string;
  sma200Status: string;
  distanceFrom52WeekHigh: number | null;
  pattern: string;
  catalyst: string;
  entryZone: string;
  stopLoss: string;
  targetZone: string;
  riskReward: number | null;
  riskLevel: string;
  score: number | null;
  finalView: string;
  notes: string;
  warnings: string[];
};

export type UsStockScreenerApiOutput = {
  scan_date: string;
  market_condition: string;
  theme: string;
  screening_criteria: {
    price_range: string;
    market_cap_range: string;
    min_avg_volume: string;
    min_relative_volume: string;
    rsi_range: string;
    technical_requirements: string[];
  };
  watchlist: Array<{
    rank: number;
    ticker: string;
    company: string;
    theme: string;
    price: number | null;
    market_cap: number | null;
    avg_volume: number | null;
    relative_volume: number | null;
    rsi: number | null;
    sma20_status: string;
    sma50_status: string;
    sma200_status: string;
    distance_from_52w_high: number | null;
    pattern: string;
    catalyst: string;
    entry_zone: string;
    stop_loss: string;
    target_1: string;
    target_2: string;
    risk_reward: string;
    risk_level: string;
    score: number | null;
    final_view: string;
    notes: string;
  }>;
  top_3: Array<{
    ticker: string;
    reason: string;
    entry_plan: string;
    risk_control: string;
  }>;
  avoid_list: Array<{
    ticker: string;
    reason: string;
  }>;
  disclaimer: 'This is for educational screening only, not personal investment advice.';
};

export function buildUsStockScreenerApiOutput(input: {
  scanDate: string;
  marketCondition: string;
  theme: string;
  watchlistRows: UsStockScreenerApiRow[];
  avoidRows: UsStockScreenerApiRow[];
}): UsStockScreenerApiOutput {
  const sortedRows = [...input.watchlistRows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const watchlist = sortedRows.slice(0, 10).map((row, index) => ({
    rank: index + 1,
    ticker: row.ticker,
    company: row.company,
    theme: row.theme,
    price: row.price,
    market_cap: row.marketCap,
    avg_volume: row.avgVolume,
    relative_volume: row.relativeVolume,
    rsi: row.rsi,
    sma20_status: row.sma20Status,
    sma50_status: row.sma50Status,
    sma200_status: row.sma200Status,
    distance_from_52w_high: row.distanceFrom52WeekHigh,
    pattern: row.pattern,
    catalyst: row.catalyst,
    entry_zone: row.entryZone,
    stop_loss: row.stopLoss,
    target_1: splitTarget(row.targetZone).target1,
    target_2: splitTarget(row.targetZone).target2,
    risk_reward: row.riskReward === null ? 'Data required' : `${row.riskReward.toFixed(2)}R`,
    risk_level: row.riskLevel,
    score: row.score,
    final_view: row.finalView,
    notes: row.notes
  }));

  return {
    scan_date: input.scanDate,
    market_condition: input.marketCondition,
    theme: input.theme,
    screening_criteria: {
      price_range: '$1-$30',
      market_cap_range: '$100M-$10B',
      min_avg_volume: '>500,000 shares/day',
      min_relative_volume: '>1.5 on breakout day',
      rsi_range: '50-75 preferred; RSI >85 wait for new base',
      technical_requirements: [
        'Price above SMA20',
        'Price above SMA50',
        'SMA200 status monitored',
        'Within 20% of 52-week high preferred',
        'VCP / Triangle / Bull Flag / Cup with Handle / Breakout + Retest / Volume Dry-Up / Base near 52-week high',
        'Breakout requires volume confirmation'
      ]
    },
    watchlist,
    top_3: watchlist.slice(0, 3).map(row => ({
      ticker: row.ticker,
      reason: `${row.theme}; ${row.pattern}; score ${row.score ?? 'Data required'}.`,
      entry_plan: row.entry_zone,
      risk_control: `Stop: ${row.stop_loss}; avoid chasing if RSI >85 or breakout fails.`
    })),
    avoid_list: input.avoidRows.slice(0, 5).map(row => ({
      ticker: row.ticker,
      reason: row.warnings.length > 0 ? row.warnings.join(' | ') : row.notes || 'Risk/reward or data quality does not pass current screen.'
    })),
    disclaimer: 'This is for educational screening only, not personal investment advice.'
  };
}

function splitTarget(targetZone: string): { target1: string; target2: string } {
  if (!targetZone || targetZone === 'Data required') return { target1: 'Data required', target2: 'Data required' };
  const priceMatches = targetZone.match(/\$\d+(?:\.\d+)?/g);
  if (priceMatches && priceMatches.length >= 2) return { target1: priceMatches[0], target2: priceMatches[1] };
  if (priceMatches && priceMatches.length === 1) return { target1: priceMatches[0], target2: targetZone };
  return { target1: targetZone, target2: targetZone };
}
