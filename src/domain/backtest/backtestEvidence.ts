export interface BacktestTradeInput {
  id?: number | string;
  pnl: number;
  rMultiple?: number;
  balanceAfter?: number;
  exitTime?: string;
  regime?: MarketRegime;
}

export type MarketRegime = 'TRENDING' | 'RANGING' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY' | 'UNKNOWN';
export type EvidenceStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface EvidenceIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface WalkForwardWindow {
  id: number;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
}

export interface BuildWalkForwardWindowsInput {
  totalCandles: number;
  trainSize: number;
  testSize: number;
  stepSize: number;
}

export interface WalkForwardWindowResult {
  id: number;
  trades: number;
  expectancyR: number;
  maxDrawdownPercent: number;
}

export interface WalkForwardStabilityReport {
  status: EvidenceStatus;
  windows: number;
  windowResults: WalkForwardWindowResult[];
  positiveWindowRate: number;
  minWindowExpectancyR: number;
  averageWindowExpectancyR: number;
  maxWindowDrawdownPercent: number;
  issues: EvidenceIssue[];
}

export interface RegimeClassificationInput {
  adx: number;
  atrPercent: number;
  emaFast: number;
  emaSlow: number;
}

export interface RegimeMetric {
  trades: number;
  winRate: number;
  expectancyR: number;
}

export interface RegimePerformanceReport {
  coveredRegimes: number;
  byRegime: Record<MarketRegime, RegimeMetric>;
  issues: EvidenceIssue[];
}

export interface BacktestEvidenceInput {
  trades: BacktestTradeInput[];
  initialBalance: number;
  inSampleRatio?: number;
}

export interface BacktestEvidenceSummary {
  sampleSize: number;
  inSampleTrades: number;
  outOfSampleTrades: number;
  outOfSampleExpectancyR: number;
  outOfSampleWinRate: number;
  maxDrawdownPercent: number;
  netProfitUsd: number;
  profitFactor: number;
  walkForward?: WalkForwardStabilityReport;
  regimePerformance?: RegimePerformanceReport;
}

export interface LiveReadinessBacktestInput {
  sampleSize: number;
  outOfSampleExpectancyR: number;
  maxDrawdownPercent: number;
}

export function summarizeBacktestEvidence(input: BacktestEvidenceInput): BacktestEvidenceSummary {
  const trades = [...input.trades];
  const sampleSize = trades.length;

  if (sampleSize === 0 || !Number.isFinite(input.initialBalance) || input.initialBalance <= 0) {
    return emptyEvidence();
  }

  const inSampleRatio = clamp(input.inSampleRatio ?? 0.7, 0.1, 0.9);
  const inSampleTrades = Math.max(1, Math.min(sampleSize - 1, Math.floor(sampleSize * inSampleRatio)));
  const outOfSample = trades.slice(inSampleTrades);
  const outOfSampleTrades = outOfSample.length;

  const outOfSampleExpectancyR = outOfSampleTrades > 0
    ? outOfSample.reduce((sum, trade) => sum + getRMultiple(trade, input.initialBalance), 0) / outOfSampleTrades
    : 0;
  const outOfSampleWins = outOfSample.filter(trade => trade.pnl > 0).length;
  const grossProfit = trades.filter(trade => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(trades.filter(trade => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0));
  const netProfitUsd = trades.reduce((sum, trade) => sum + trade.pnl, 0);

  return {
    sampleSize,
    inSampleTrades,
    outOfSampleTrades,
    outOfSampleExpectancyR: round(outOfSampleExpectancyR, 2),
    outOfSampleWinRate: outOfSampleTrades > 0 ? round((outOfSampleWins / outOfSampleTrades) * 100, 2) : 0,
    maxDrawdownPercent: round(computeMaxDrawdownPercent(trades, input.initialBalance), 2),
    netProfitUsd: round(netProfitUsd, 2),
    profitFactor: grossLoss === 0 ? Number.POSITIVE_INFINITY : round(grossProfit / grossLoss, 2)
  };
}

export function toLiveReadinessBacktestInput(
  evidence: BacktestEvidenceSummary | null | undefined
): LiveReadinessBacktestInput {
  if (!evidence) {
    return {
      sampleSize: 0,
      outOfSampleExpectancyR: 0,
      maxDrawdownPercent: 100
    };
  }

  return {
    sampleSize: evidence.sampleSize,
    outOfSampleExpectancyR: evidence.outOfSampleExpectancyR,
    maxDrawdownPercent: evidence.maxDrawdownPercent
  };
}

export function buildWalkForwardWindows(input: BuildWalkForwardWindowsInput): WalkForwardWindow[] {
  const windows: WalkForwardWindow[] = [];
  const totalCandles = Math.max(0, Math.floor(input.totalCandles));
  const trainSize = Math.max(1, Math.floor(input.trainSize));
  const testSize = Math.max(1, Math.floor(input.testSize));
  const stepSize = Math.max(1, Math.floor(input.stepSize));

  let trainStart = 0;
  let id = 1;
  while (trainStart + trainSize + testSize <= totalCandles) {
    const trainEnd = trainStart + trainSize - 1;
    const testStart = trainEnd + 1;
    const testEnd = testStart + testSize - 1;

    windows.push({ id, trainStart, trainEnd, testStart, testEnd });
    id += 1;
    trainStart += stepSize;
  }

  return windows;
}

export function evaluateWalkForwardStability(
  windows: WalkForwardWindowResult[],
  options: {
    minTradesPerWindow?: number;
    minPositiveWindowRate?: number;
    maxDrawdownPercent?: number;
  } = {}
): WalkForwardStabilityReport {
  const issues: EvidenceIssue[] = [];
  const minTradesPerWindow = options.minTradesPerWindow ?? 20;
  const minPositiveWindowRate = options.minPositiveWindowRate ?? 70;
  const maxDrawdownPercent = options.maxDrawdownPercent ?? 20;

  if (windows.length === 0) {
    issues.push({
      code: 'NO_WALK_FORWARD_WINDOWS',
      severity: 'ERROR',
      message: 'No walk-forward windows were available for robustness analysis.'
    });
  }

  if (windows.some(window => window.trades < minTradesPerWindow)) {
    issues.push({
      code: 'WINDOW_SAMPLE_TOO_SMALL',
      severity: 'ERROR',
      message: `Each walk-forward test window needs at least ${minTradesPerWindow} trades.`
    });
  }

  const positiveWindows = windows.filter(window => window.expectancyR > 0).length;
  const positiveWindowRate = windows.length > 0 ? round((positiveWindows / windows.length) * 100, 2) : 0;
  const minWindowExpectancyR = windows.length > 0 ? round(Math.min(...windows.map(window => window.expectancyR)), 2) : 0;
  const averageWindowExpectancyR = windows.length > 0
    ? round(windows.reduce((sum, window) => sum + window.expectancyR, 0) / windows.length, 2)
    : 0;
  const maxWindowDrawdown = windows.length > 0 ? round(Math.max(...windows.map(window => window.maxDrawdownPercent)), 2) : 100;

  if (positiveWindowRate < minPositiveWindowRate) {
    issues.push({
      code: 'LOW_POSITIVE_WINDOW_RATE',
      severity: 'ERROR',
      message: `Positive walk-forward window rate is below ${minPositiveWindowRate}%.`
    });
  }

  if (minWindowExpectancyR <= 0) {
    issues.push({
      code: 'NEGATIVE_WINDOW_EXPECTANCY',
      severity: 'ERROR',
      message: 'At least one walk-forward window has non-positive expectancy.'
    });
  }

  if (maxWindowDrawdown > maxDrawdownPercent) {
    issues.push({
      code: 'WALK_FORWARD_DRAWDOWN_EXCEEDED',
      severity: 'ERROR',
      message: `Walk-forward drawdown exceeds ${maxDrawdownPercent}%.`
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : 'PASS',
    windows: windows.length,
    windowResults: windows.map(window => ({ ...window })),
    positiveWindowRate,
    minWindowExpectancyR,
    averageWindowExpectancyR,
    maxWindowDrawdownPercent: maxWindowDrawdown,
    issues
  };
}

export function classifyMarketRegime(input: RegimeClassificationInput): MarketRegime {
  if (![input.adx, input.atrPercent, input.emaFast, input.emaSlow].every(Number.isFinite)) {
    return 'UNKNOWN';
  }

  if (input.atrPercent >= 3.5) return 'HIGH_VOLATILITY';
  if (input.atrPercent <= 0.35) return 'LOW_VOLATILITY';

  const emaSeparationPercent = Math.abs(input.emaFast - input.emaSlow) / Math.max(Math.abs(input.emaSlow), 1) * 100;
  if (input.adx >= 25 && emaSeparationPercent >= 0.5) return 'TRENDING';
  if (input.adx <= 18 && emaSeparationPercent < 0.75) return 'RANGING';

  return 'UNKNOWN';
}

export function analyzeRegimePerformance(trades: BacktestTradeInput[]): RegimePerformanceReport {
  const regimes: MarketRegime[] = ['TRENDING', 'RANGING', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'UNKNOWN'];
  const byRegime = regimes.reduce((acc, regime) => {
    acc[regime] = { trades: 0, winRate: 0, expectancyR: 0 };
    return acc;
  }, {} as Record<MarketRegime, RegimeMetric>);

  for (const regime of regimes) {
    const bucket = trades.filter(trade => (trade.regime ?? 'UNKNOWN') === regime);
    if (bucket.length === 0) continue;

    byRegime[regime] = {
      trades: bucket.length,
      winRate: round((bucket.filter(trade => trade.pnl > 0).length / bucket.length) * 100, 2),
      expectancyR: round(bucket.reduce((sum, trade) => sum + getRMultiple(trade, 10_000), 0) / bucket.length, 2)
    };
  }

  const coveredRegimes = regimes.filter(regime => byRegime[regime].trades > 0 && regime !== 'UNKNOWN').length;
  const issues: EvidenceIssue[] = [];

  if (coveredRegimes < 3) {
    issues.push({
      code: 'INSUFFICIENT_REGIME_COVERAGE',
      severity: 'WARNING',
      message: 'Backtest evidence should cover at least three market regimes before live escalation.'
    });
  }

  const negativeRegime = regimes.some(regime => byRegime[regime].trades > 0 && byRegime[regime].expectancyR < 0);
  if (negativeRegime) {
    issues.push({
      code: 'NEGATIVE_REGIME_EXPECTANCY',
      severity: 'WARNING',
      message: 'At least one covered regime has negative expectancy.'
    });
  }

  return {
    coveredRegimes,
    byRegime,
    issues
  };
}

function computeMaxDrawdownPercent(trades: BacktestTradeInput[], initialBalance: number): number {
  let balance = initialBalance;
  let peak = initialBalance;
  let maxDrawdown = 0;

  for (const trade of trades) {
    balance = Number.isFinite(trade.balanceAfter ?? Number.NaN)
      ? Number(trade.balanceAfter)
      : balance + trade.pnl;
    peak = Math.max(peak, balance);

    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, ((peak - balance) / peak) * 100);
    }
  }

  return maxDrawdown;
}

function getRMultiple(trade: BacktestTradeInput, initialBalance: number): number {
  if (Number.isFinite(trade.rMultiple ?? Number.NaN)) {
    return Number(trade.rMultiple);
  }

  const assumedRiskUsd = initialBalance * 0.01;
  return assumedRiskUsd > 0 ? trade.pnl / assumedRiskUsd : 0;
}

function emptyEvidence(): BacktestEvidenceSummary {
  return {
    sampleSize: 0,
    inSampleTrades: 0,
    outOfSampleTrades: 0,
    outOfSampleExpectancyR: 0,
    outOfSampleWinRate: 0,
    maxDrawdownPercent: 100,
    netProfitUsd: 0,
    profitFactor: 0
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
