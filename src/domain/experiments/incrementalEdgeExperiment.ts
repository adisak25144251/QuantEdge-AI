export type ExperimentStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type ExperimentStrategyId = 'BASELINE_BREAKOUT_V1' | 'HYBRID_BOOK_ENSEMBLE_V1';
export type ExperimentRegime = 'TRENDING' | 'RANGING' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY' | 'UNKNOWN';

export interface ExperimentCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExperimentSeries {
  symbol: string;
  candles: ExperimentCandle[];
}

export interface ExperimentDatasetAudit {
  source: string;
  observedAt: string;
  startDate: string;
  endDate: string;
  pointInTimeUniverse: boolean;
  delistedSecuritiesIncluded: boolean;
  splitAdjusted: boolean;
  dividendAdjusted: boolean;
  executionCostsMeasured: boolean;
  lookAheadBiasChecked: boolean;
}

export interface ExperimentExecutionModel {
  feeBpsPerSide?: number;
  baseSlippageBpsPerSide?: number;
  maxSlippageBpsPerSide?: number;
  stopAtrMultiple?: number;
  targetAtrMultiple?: number;
  maxHoldingBars?: number;
  riskPerTradePercent?: number;
}

export interface IncrementalEdgeExperimentInput {
  universe: ExperimentSeries[];
  benchmark: ExperimentSeries;
  dataset: ExperimentDatasetAudit;
  execution?: ExperimentExecutionModel;
  minTrades?: number;
  minTradesPerWindow?: number;
  minPositiveWindowRate?: number;
  minExpectancyLiftR?: number;
  maxDrawdownPercent?: number;
  bootstrapSamples?: number;
  randomSeed?: number;
}

export interface ExperimentTrade {
  strategyId: ExperimentStrategyId;
  symbol: string;
  signalTime: number;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  stopPrice: number;
  targetPrice: number;
  rMultiple: number;
  outcome: 'TARGET' | 'STOP' | 'TIME';
  regime: ExperimentRegime;
  slippageBpsPerSide: number;
}

export interface StrategyExperimentMetrics {
  trades: number;
  precisionPercent: number;
  expectancyR: number;
  maxDrawdownPercent: number;
  profitFactor: number | null;
  averageSlippageBpsPerSide: number;
}

export interface RegimeExperimentMetrics extends StrategyExperimentMetrics {
  regime: ExperimentRegime;
}

export interface WalkForwardExperimentWindow {
  id: number;
  startTime: number;
  endTime: number;
  baseline: StrategyExperimentMetrics;
  hybrid: StrategyExperimentMetrics;
  expectancyLiftR: number;
}

export interface BootstrapInterval {
  estimate: number;
  lower95: number;
  upper95: number;
}

export interface IncrementalEdgeIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface IncrementalEdgeExperimentReport {
  schemaVersion: '1.0';
  gateVersion: 'incremental-edge-v1.1';
  runId: string;
  generatedAt: string;
  status: ExperimentStatus;
  strategyStage: 'RESEARCH' | 'PAPER_ELIGIBLE';
  dataset: ExperimentDatasetAudit & {
    symbols: string[];
    candleCount: number;
    fingerprint: string;
  };
  execution: Required<ExperimentExecutionModel>;
  baseline: StrategyExperimentMetrics;
  hybrid: StrategyExperimentMetrics;
  incrementalEdge: {
    expectancyLiftR: BootstrapInterval;
    precisionLiftPercent: BootstrapInterval;
    drawdownDeltaPercent: number;
  };
  walkForward: {
    windows: WalkForwardExperimentWindow[];
    eligibleWindows: number;
    positiveWindowRate: number;
  };
  byRegime: {
    baseline: RegimeExperimentMetrics[];
    hybrid: RegimeExperimentMetrics[];
  };
  issues: IncrementalEdgeIssue[];
  provenance: {
    baselineDefinition: string;
    hybridDefinition: string;
    sourceReferences: string[];
  };
}

interface IndicatorSnapshot {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  atr14: number | null;
  atr50: number | null;
  rsi14: number | null;
  relativeVolume20: number | null;
  return5: number | null;
  return63: number | null;
  benchmarkReturn63: number | null;
  priorHigh20: number | null;
  regime: ExperimentRegime;
}

const DEFAULT_EXECUTION: Required<ExperimentExecutionModel> = {
  feeBpsPerSide: 1,
  baseSlippageBpsPerSide: 8,
  maxSlippageBpsPerSide: 45,
  stopAtrMultiple: 2,
  targetAtrMultiple: 4,
  maxHoldingBars: 20,
  riskPerTradePercent: 1
};

const SOURCE_REFERENCES = [
  'https://github.com/zslucky/algorithmic_trading_book/blob/master/sat-ebook-20150618.pdf',
  'https://github.com/zslucky/algorithmic_trading_book/blob/master/aat-ebook-20170711.pdf',
  'https://github.com/zslucky/algorithmic_trading_book/tree/master/aat_source'
];

export function runIncrementalEdgeExperiment(input: IncrementalEdgeExperimentInput): IncrementalEdgeExperimentReport {
  const execution = normalizeExecution(input.execution);
  const benchmark = normalizeSeries(input.benchmark);
  const benchmarkCloseByTime = new Map(benchmark.candles.map(candle => [candle.time, candle.close]));
  const benchmarkTimes = benchmark.candles.map(candle => candle.time);
  const normalizedUniverse = input.universe
    .map(normalizeSeries)
    .filter(series => series.candles.length > 0 && series.symbol !== benchmark.symbol);
  const baselineTrades: ExperimentTrade[] = [];
  const hybridTrades: ExperimentTrade[] = [];

  for (const series of normalizedUniverse) {
    const alignedBenchmarkCloses = alignBenchmarkCloses(series.candles, benchmarkCloseByTime, benchmarkTimes);
    baselineTrades.push(...simulateStrategy(series, alignedBenchmarkCloses, 'BASELINE_BREAKOUT_V1', execution));
    hybridTrades.push(...simulateStrategy(series, alignedBenchmarkCloses, 'HYBRID_BOOK_ENSEMBLE_V1', execution));
  }

  const baseline = summarizeTrades(baselineTrades, execution.riskPerTradePercent);
  const hybrid = summarizeTrades(hybridTrades, execution.riskPerTradePercent);
  const minTradesPerWindow = input.minTradesPerWindow ?? 20;
  const windows = buildWalkForwardEvidence(
    baselineTrades,
    hybridTrades,
    normalizedUniverse,
    execution.riskPerTradePercent
  );
  const eligibleWindows = windows.filter(window =>
    window.baseline.trades >= minTradesPerWindow && window.hybrid.trades >= minTradesPerWindow
  );
  const positiveWindowRate = eligibleWindows.length > 0
    ? percent(eligibleWindows.filter(window => window.expectancyLiftR > 0).length, eligibleWindows.length)
    : 0;
  const bootstrapSamples = clampInteger(input.bootstrapSamples ?? 2_000, 200, 20_000);
  const randomSeed = input.randomSeed ?? 25_144_251;
  const expectancyLift = bootstrapDifference(
    hybridTrades.map(trade => trade.rMultiple),
    baselineTrades.map(trade => trade.rMultiple),
    bootstrapSamples,
    randomSeed
  );
  const precisionLift = bootstrapDifference(
    hybridTrades.map(trade => trade.rMultiple > 0 ? 100 : 0),
    baselineTrades.map(trade => trade.rMultiple > 0 ? 100 : 0),
    bootstrapSamples,
    randomSeed + 1
  );
  const byRegime = {
    baseline: summarizeByRegime(baselineTrades, execution.riskPerTradePercent),
    hybrid: summarizeByRegime(hybridTrades, execution.riskPerTradePercent)
  };
  const issues = evaluateExperimentIssues({
    input,
    baseline,
    hybrid,
    expectancyLift,
    windows,
    eligibleWindows,
    positiveWindowRate,
    byRegime,
    normalizedUniverse
  });
  const status = issues.some(issue => issue.severity === 'ERROR')
    ? 'BLOCK'
    : issues.length > 0
      ? 'REVIEW'
      : 'PASS';
  const generatedAt = new Date().toISOString();
  const fingerprint = fingerprintDataset(normalizedUniverse, benchmark);

  return {
    schemaVersion: '1.0',
    gateVersion: 'incremental-edge-v1.1',
    runId: `edge-${generatedAt.replace(/\D/g, '').slice(0, 14)}-${fingerprint.slice(0, 8)}`,
    generatedAt,
    status,
    strategyStage: status === 'PASS' ? 'PAPER_ELIGIBLE' : 'RESEARCH',
    dataset: {
      ...input.dataset,
      symbols: normalizedUniverse.map(series => series.symbol),
      candleCount: normalizedUniverse.reduce((sum, series) => sum + series.candles.length, 0),
      fingerprint
    },
    execution,
    baseline,
    hybrid,
    incrementalEdge: {
      expectancyLiftR: expectancyLift,
      precisionLiftPercent: precisionLift,
      drawdownDeltaPercent: round(hybrid.maxDrawdownPercent - baseline.maxDrawdownPercent, 2)
    },
    walkForward: {
      windows,
      eligibleWindows: eligibleWindows.length,
      positiveWindowRate
    },
    byRegime,
    issues,
    provenance: {
      baselineDefinition: 'Long-only 20-day breakout with SMA20/SMA50, RSI 50-75, and relative volume confirmation. Signal uses completed bar; entry uses next bar open.',
      hybridDefinition: 'Baseline setup plus an independent-confirmation ensemble. At least two of trend, benchmark-relative momentum, volatility contraction, and compatible-regime votes must pass. Entry and exits include conservative modeled costs.',
      sourceReferences: SOURCE_REFERENCES
    }
  };
}

function simulateStrategy(
  series: ExperimentSeries,
  benchmarkCloses: Array<number | null>,
  strategyId: ExperimentStrategyId,
  execution: Required<ExperimentExecutionModel>
): ExperimentTrade[] {
  const candles = series.candles;
  const closes = candles.map(candle => candle.close);
  const highs = candles.map(candle => candle.high);
  const volumes = candles.map(candle => candle.volume);
  const trades: ExperimentTrade[] = [];
  let nextEligibleIndex = 201;

  for (let signalIndex = 200; signalIndex < candles.length - 1; signalIndex += 1) {
    if (signalIndex + 1 < nextEligibleIndex) continue;
    const indicators = indicatorSnapshot(candles, closes, highs, volumes, benchmarkCloses, signalIndex);
    if (!isSignalEligible(candles, signalIndex, indicators, strategyId)) continue;

    const entryIndex = signalIndex + 1;
    const entryCandle = candles[entryIndex];
    const slippageBps = estimateSlippageBps(candles, volumes, signalIndex, indicators, execution);
    const entryPrice = entryCandle.open * (1 + slippageBps / 10_000);
    const atr = indicators.atr14 ?? 0;
    const riskDistance = atr * execution.stopAtrMultiple;
    if (!(entryPrice > 0) || !(riskDistance > 0) || riskDistance >= entryPrice * 0.35) continue;

    const stopPrice = entryPrice - riskDistance;
    const targetPrice = entryPrice + atr * execution.targetAtrMultiple;
    const lastExitIndex = Math.min(candles.length - 1, entryIndex + execution.maxHoldingBars);
    let exitIndex = lastExitIndex;
    let rawExitPrice = candles[lastExitIndex].close;
    let outcome: ExperimentTrade['outcome'] = 'TIME';

    for (let index = entryIndex; index <= lastExitIndex; index += 1) {
      const candle = candles[index];
      const stopHit = candle.low <= stopPrice;
      const targetHit = candle.high >= targetPrice;
      if (stopHit) {
        exitIndex = index;
        rawExitPrice = stopPrice;
        outcome = 'STOP';
        break;
      }
      if (targetHit) {
        exitIndex = index;
        rawExitPrice = targetPrice;
        outcome = 'TARGET';
        break;
      }
    }

    const exitPrice = rawExitPrice * (1 - slippageBps / 10_000);
    const feeCost = (entryPrice + exitPrice) * execution.feeBpsPerSide / 10_000;
    const rMultiple = (exitPrice - entryPrice - feeCost) / riskDistance;
    trades.push({
      strategyId,
      symbol: series.symbol,
      signalTime: candles[signalIndex].time,
      entryTime: entryCandle.time,
      exitTime: candles[exitIndex].time,
      entryPrice: round(entryPrice, 6),
      exitPrice: round(exitPrice, 6),
      stopPrice: round(stopPrice, 6),
      targetPrice: round(targetPrice, 6),
      rMultiple: round(rMultiple, 4),
      outcome,
      regime: indicators.regime,
      slippageBpsPerSide: slippageBps
    });
    nextEligibleIndex = exitIndex + 1;
  }

  return trades;
}

function isSignalEligible(
  candles: ExperimentCandle[],
  index: number,
  indicators: IndicatorSnapshot,
  strategyId: ExperimentStrategyId
): boolean {
  const close = candles[index].close;
  const baselineEligible =
    indicators.priorHigh20 !== null &&
    close > indicators.priorHigh20 &&
    indicators.sma20 !== null &&
    indicators.sma50 !== null &&
    close > indicators.sma20 &&
    close > indicators.sma50 &&
    indicators.rsi14 !== null &&
    indicators.rsi14 >= 50 &&
    indicators.rsi14 <= 75 &&
    indicators.relativeVolume20 !== null &&
    indicators.relativeVolume20 >= 1.5;

  if (!baselineEligible || strategyId === 'BASELINE_BREAKOUT_V1') return baselineEligible;

  if (indicators.return5 === null || indicators.return5 > 0.5) return false;
  const votes = [
    indicators.sma200 !== null && indicators.sma50 !== null && indicators.sma50 > indicators.sma200,
    indicators.return63 !== null &&
      indicators.benchmarkReturn63 !== null &&
      indicators.return63 > indicators.benchmarkReturn63,
    indicators.atr14 !== null &&
      indicators.atr50 !== null &&
      indicators.atr14 <= indicators.atr50 * 1.15,
    indicators.regime === 'TRENDING' || indicators.regime === 'RANGING'
  ];
  return votes.filter(Boolean).length >= 2;
}

function indicatorSnapshot(
  candles: ExperimentCandle[],
  closes: number[],
  highs: number[],
  volumes: number[],
  benchmarkCloses: Array<number | null>,
  index: number
): IndicatorSnapshot {
  const sma20 = averageRange(closes, index - 19, index);
  const sma50 = averageRange(closes, index - 49, index);
  const sma200 = averageRange(closes, index - 199, index);
  const atr14 = atr(candles, index, 14);
  const atr50 = atr(candles, index, 50);
  const rsi14 = rsi(closes, index, 14);
  const averageVolume20 = averageRange(volumes, index - 20, index - 1);
  const relativeVolume20 = averageVolume20 && averageVolume20 > 0 ? volumes[index] / averageVolume20 : null;
  const priorHigh20 = maxRange(highs, index - 20, index - 1);
  const return5 = rateOfChange(closes, index, 5);
  const return63 = rateOfChange(closes, index, 63);
  const benchmarkReturn63 = rateOfChangeNullable(benchmarkCloses, index, 63);
  const atrPercent = atr14 && closes[index] > 0 ? atr14 / closes[index] * 100 : Number.NaN;
  const path = closes.slice(Math.max(0, index - 29), index + 1);
  const netMove = path.length > 1 ? Math.abs(path[path.length - 1] - path[0]) : 0;
  const grossMove = path.slice(1).reduce((sum, close, offset) => sum + Math.abs(close - path[offset]), 0);
  const adxProxy = grossMove > 0 ? Math.min(50, netMove / grossMove * 50) : 0;
  const regime = classifyRegime(adxProxy, atrPercent, sma20, sma50);

  return {
    sma20,
    sma50,
    sma200,
    atr14,
    atr50,
    rsi14,
    relativeVolume20,
    return5,
    return63,
    benchmarkReturn63,
    priorHigh20,
    regime
  };
}

function classifyRegime(adxProxy: number, atrPercent: number, sma20: number | null, sma50: number | null): ExperimentRegime {
  if (![adxProxy, atrPercent, sma20, sma50].every(value => value !== null && Number.isFinite(value))) return 'UNKNOWN';
  if (atrPercent >= 5) return 'HIGH_VOLATILITY';
  if (atrPercent <= 0.7 && adxProxy < 20) return 'LOW_VOLATILITY';
  const separation = Math.abs(Number(sma20) - Number(sma50)) / Math.max(Math.abs(Number(sma50)), 1) * 100;
  if (adxProxy >= 25 && separation >= 0.5) return 'TRENDING';
  if (adxProxy <= 18 && separation < 1) return 'RANGING';
  return 'UNKNOWN';
}

function estimateSlippageBps(
  candles: ExperimentCandle[],
  volumes: number[],
  index: number,
  indicators: IndicatorSnapshot,
  execution: Required<ExperimentExecutionModel>
): number {
  const averageVolume = averageRange(volumes, index - 20, index - 1) ?? 0;
  const dollarVolume = averageVolume * candles[index].close;
  const liquidityPenalty = dollarVolume < 5_000_000 ? 20 : dollarVolume < 20_000_000 ? 12 : dollarVolume < 100_000_000 ? 5 : 0;
  const atrPercent = indicators.atr14 && candles[index].close > 0 ? indicators.atr14 / candles[index].close * 100 : 0;
  const volatilityPenalty = Math.min(12, atrPercent * 1.5);
  return round(clamp(execution.baseSlippageBpsPerSide + liquidityPenalty + volatilityPenalty, 0, execution.maxSlippageBpsPerSide), 2);
}

function summarizeTrades(trades: ExperimentTrade[], riskPerTradePercent: number): StrategyExperimentMetrics {
  if (trades.length === 0) {
    return {
      trades: 0,
      precisionPercent: 0,
      expectancyR: 0,
      maxDrawdownPercent: 100,
      profitFactor: null,
      averageSlippageBpsPerSide: 0
    };
  }

  const sorted = [...trades].sort((a, b) => a.exitTime - b.exitTime || a.symbol.localeCompare(b.symbol));
  const wins = sorted.filter(trade => trade.rMultiple > 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.rMultiple, 0);
  const grossLoss = Math.abs(sorted.filter(trade => trade.rMultiple < 0).reduce((sum, trade) => sum + trade.rMultiple, 0));
  let equity = 100;
  let peak = equity;
  let maxDrawdown = 0;
  for (const trade of sorted) {
    equity *= 1 + (riskPerTradePercent / 100) * trade.rMultiple;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - equity) / peak * 100 : 100);
  }

  return {
    trades: sorted.length,
    precisionPercent: percent(wins.length, sorted.length),
    expectancyR: round(mean(sorted.map(trade => trade.rMultiple)), 4),
    maxDrawdownPercent: round(maxDrawdown, 2),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss, 3) : null,
    averageSlippageBpsPerSide: round(mean(sorted.map(trade => trade.slippageBpsPerSide)), 2)
  };
}

function summarizeByRegime(trades: ExperimentTrade[], riskPerTradePercent: number): RegimeExperimentMetrics[] {
  const regimes: ExperimentRegime[] = ['TRENDING', 'RANGING', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'UNKNOWN'];
  return regimes.map(regime => ({
    regime,
    ...summarizeTrades(trades.filter(trade => trade.regime === regime), riskPerTradePercent)
  }));
}

function buildWalkForwardEvidence(
  baselineTrades: ExperimentTrade[],
  hybridTrades: ExperimentTrade[],
  universe: ExperimentSeries[],
  riskPerTradePercent: number
): WalkForwardExperimentWindow[] {
  const allTimes = universe.flatMap(series => series.candles.map(candle => candle.time));
  if (allTimes.length === 0) return [];
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  if (!(maxTime > minTime)) return [];
  const oosStart = minTime + (maxTime - minTime) * 0.3;
  const windowSize = (maxTime - oosStart) / 5;

  return Array.from({ length: 5 }, (_, index) => {
    const startTime = Math.floor(oosStart + windowSize * index);
    const endTime = index === 4 ? maxTime : Math.floor(oosStart + windowSize * (index + 1)) - 1;
    const baseline = summarizeTrades(
      baselineTrades.filter(trade => trade.entryTime >= startTime && trade.entryTime <= endTime),
      riskPerTradePercent
    );
    const hybrid = summarizeTrades(
      hybridTrades.filter(trade => trade.entryTime >= startTime && trade.entryTime <= endTime),
      riskPerTradePercent
    );
    return {
      id: index + 1,
      startTime,
      endTime,
      baseline,
      hybrid,
      expectancyLiftR: round(hybrid.expectancyR - baseline.expectancyR, 4)
    };
  });
}

function bootstrapDifference(
  candidate: number[],
  baseline: number[],
  samples: number,
  seed: number
): BootstrapInterval {
  const estimate = candidate.length > 0 && baseline.length > 0 ? mean(candidate) - mean(baseline) : 0;
  if (candidate.length === 0 || baseline.length === 0) {
    return { estimate: round(estimate, 4), lower95: 0, upper95: 0 };
  }

  const random = seededRandom(seed);
  const differences = new Array<number>(samples);
  for (let sample = 0; sample < samples; sample += 1) {
    let candidateSum = 0;
    let baselineSum = 0;
    for (let index = 0; index < candidate.length; index += 1) {
      candidateSum += candidate[Math.floor(random() * candidate.length)];
    }
    for (let index = 0; index < baseline.length; index += 1) {
      baselineSum += baseline[Math.floor(random() * baseline.length)];
    }
    differences[sample] = candidateSum / candidate.length - baselineSum / baseline.length;
  }
  differences.sort((a, b) => a - b);

  return {
    estimate: round(estimate, 4),
    lower95: round(quantile(differences, 0.025), 4),
    upper95: round(quantile(differences, 0.975), 4)
  };
}

function evaluateExperimentIssues(context: {
  input: IncrementalEdgeExperimentInput;
  baseline: StrategyExperimentMetrics;
  hybrid: StrategyExperimentMetrics;
  expectancyLift: BootstrapInterval;
  windows: WalkForwardExperimentWindow[];
  eligibleWindows: WalkForwardExperimentWindow[];
  positiveWindowRate: number;
  byRegime: { baseline: RegimeExperimentMetrics[]; hybrid: RegimeExperimentMetrics[] };
  normalizedUniverse: ExperimentSeries[];
}): IncrementalEdgeIssue[] {
  const issues: IncrementalEdgeIssue[] = [];
  const minTrades = context.input.minTrades ?? 200;
  const minPositiveWindowRate = context.input.minPositiveWindowRate ?? 70;
  const minExpectancyLiftR = context.input.minExpectancyLiftR ?? 0.05;
  const maxDrawdownPercent = context.input.maxDrawdownPercent ?? 20;

  if (context.normalizedUniverse.length < 10) {
    issues.push(error('UNIVERSE_TOO_SMALL', 'At least 10 securities are required for cross-sectional evidence.'));
  }
  if (!context.input.dataset.pointInTimeUniverse) {
    issues.push(error('POINT_IN_TIME_UNIVERSE_REQUIRED', 'Current constituents can introduce survivorship bias.'));
  }
  if (!context.input.dataset.delistedSecuritiesIncluded) {
    issues.push(error('DELISTED_SECURITIES_MISSING', 'Delisted securities must be included before production promotion.'));
  }
  if (!context.input.dataset.splitAdjusted) {
    issues.push(error('SPLIT_ADJUSTMENT_REQUIRED', 'Price history must be adjusted for stock splits.'));
  }
  if (!context.input.dataset.lookAheadBiasChecked) {
    issues.push(error('LOOK_AHEAD_AUDIT_REQUIRED', 'Signal and execution timestamps need an explicit look-ahead audit.'));
  }
  if (!context.input.dataset.executionCostsMeasured) {
    issues.push(warning('EXECUTION_COSTS_MODELED', 'Execution costs are conservative estimates, not measured paper/live fills.'));
  }
  if (context.baseline.trades < minTrades || context.hybrid.trades < minTrades) {
    issues.push(error('EXPERIMENT_SAMPLE_TOO_SMALL', `Both strategies need at least ${minTrades} trades.`));
  }
  if (context.hybrid.expectancyR <= 0.05) {
    issues.push(error('HYBRID_EXPECTANCY_TOO_LOW', 'Hybrid out-of-sample expectancy must exceed 0.05R.'));
  }
  if (context.expectancyLift.estimate < minExpectancyLiftR) {
    issues.push(error('INCREMENTAL_EDGE_TOO_SMALL', `Expectancy lift must be at least ${minExpectancyLiftR}R.`));
  }
  if (context.expectancyLift.lower95 <= 0) {
    issues.push(error('INCREMENTAL_EDGE_NOT_STATISTICALLY_STABLE', 'The 95% bootstrap lower bound must be above zero.'));
  }
  if (context.hybrid.maxDrawdownPercent > maxDrawdownPercent) {
    issues.push(error('HYBRID_DRAWDOWN_EXCEEDED', `Hybrid drawdown exceeds ${maxDrawdownPercent}%.`));
  }
  if (context.hybrid.maxDrawdownPercent > context.baseline.maxDrawdownPercent + 5) {
    issues.push(error('HYBRID_DRAWDOWN_WORSE', 'Hybrid drawdown is more than five percentage points worse than baseline.'));
  }
  if (context.windows.length < 5 || context.eligibleWindows.length < 4) {
    issues.push(error('WALK_FORWARD_WINDOWS_INSUFFICIENT', 'At least four of five OOS windows need adequate samples.'));
  }
  if (context.positiveWindowRate < minPositiveWindowRate) {
    issues.push(error('WALK_FORWARD_EDGE_UNSTABLE', `Positive incremental-edge windows are below ${minPositiveWindowRate}%.`));
  }

  const coveredRegimes = context.byRegime.hybrid.filter(metric => metric.trades >= 20).length;
  const negativeRegimes = context.byRegime.hybrid.filter(metric => metric.trades >= 20 && metric.expectancyR <= 0);
  if (coveredRegimes < 3) {
    issues.push(error('REGIME_COVERAGE_INSUFFICIENT', 'Hybrid evidence needs at least 20 trades in three market regimes.'));
  }
  if (negativeRegimes.length > 0) {
    issues.push(error('NEGATIVE_REGIME_EXPECTANCY', `Hybrid expectancy is non-positive in ${negativeRegimes.map(metric => metric.regime).join(', ')}.`));
  }

  return issues;
}

function normalizeSeries(series: ExperimentSeries): ExperimentSeries {
  const symbol = String(series.symbol || '').trim().toUpperCase();
  const byTime = new Map<number, ExperimentCandle>();
  for (const raw of series.candles || []) {
    const candle = {
      time: Number(raw.time),
      open: Number(raw.open),
      high: Number(raw.high),
      low: Number(raw.low),
      close: Number(raw.close),
      volume: Number(raw.volume)
    };
    if (
      Number.isFinite(candle.time) &&
      [candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite) &&
      candle.time > 0 &&
      candle.open > 0 &&
      candle.high >= Math.max(candle.open, candle.close, candle.low) &&
      candle.low <= Math.min(candle.open, candle.close, candle.high) &&
      candle.volume >= 0
    ) {
      byTime.set(candle.time, candle);
    }
  }
  return { symbol, candles: [...byTime.values()].sort((a, b) => a.time - b.time) };
}

function alignBenchmarkCloses(
  candles: ExperimentCandle[],
  benchmarkCloseByTime: Map<number, number>,
  benchmarkTimes: number[]
): Array<number | null> {
  let benchmarkIndex = 0;
  let latestClose: number | null = null;
  return candles.map(candle => {
    while (benchmarkIndex < benchmarkTimes.length && benchmarkTimes[benchmarkIndex] <= candle.time) {
      latestClose = benchmarkCloseByTime.get(benchmarkTimes[benchmarkIndex]) ?? latestClose;
      benchmarkIndex += 1;
    }
    return latestClose;
  });
}

function normalizeExecution(execution: ExperimentExecutionModel | undefined): Required<ExperimentExecutionModel> {
  return {
    feeBpsPerSide: clamp(execution?.feeBpsPerSide ?? DEFAULT_EXECUTION.feeBpsPerSide, 0, 100),
    baseSlippageBpsPerSide: clamp(execution?.baseSlippageBpsPerSide ?? DEFAULT_EXECUTION.baseSlippageBpsPerSide, 0, 100),
    maxSlippageBpsPerSide: clamp(execution?.maxSlippageBpsPerSide ?? DEFAULT_EXECUTION.maxSlippageBpsPerSide, 1, 200),
    stopAtrMultiple: clamp(execution?.stopAtrMultiple ?? DEFAULT_EXECUTION.stopAtrMultiple, 0.25, 10),
    targetAtrMultiple: clamp(execution?.targetAtrMultiple ?? DEFAULT_EXECUTION.targetAtrMultiple, 0.25, 20),
    maxHoldingBars: clampInteger(execution?.maxHoldingBars ?? DEFAULT_EXECUTION.maxHoldingBars, 1, 252),
    riskPerTradePercent: clamp(execution?.riskPerTradePercent ?? DEFAULT_EXECUTION.riskPerTradePercent, 0.1, 5)
  };
}

function atr(candles: ExperimentCandle[], index: number, period: number): number | null {
  if (index < period) return null;
  let sum = 0;
  for (let current = index - period + 1; current <= index; current += 1) {
    const candle = candles[current];
    const previousClose = candles[current - 1]?.close ?? candle.close;
    sum += Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  }
  return sum / period;
}

function rsi(values: number[], index: number, period: number): number | null {
  if (index < period) return null;
  let gains = 0;
  let losses = 0;
  for (let current = index - period + 1; current <= index; current += 1) {
    const change = values[current] - values[current - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return gains > 0 ? 100 : 50;
  const relativeStrength = (gains / period) / (losses / period);
  return 100 - 100 / (1 + relativeStrength);
}

function rateOfChange(values: number[], index: number, period: number): number | null {
  if (index < period || values[index - period] <= 0) return null;
  return values[index] / values[index - period] - 1;
}

function rateOfChangeNullable(values: Array<number | null>, index: number, period: number): number | null {
  const current = values[index];
  const previous = values[index - period];
  if (index < period || current === null || previous === null || previous <= 0) return null;
  return current / previous - 1;
}

function averageRange(values: number[], start: number, end: number): number | null {
  if (start < 0 || end < start || end >= values.length) return null;
  let sum = 0;
  for (let index = start; index <= end; index += 1) sum += values[index];
  return sum / (end - start + 1);
}

function maxRange(values: number[], start: number, end: number): number | null {
  if (start < 0 || end < start || end >= values.length) return null;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = start; index <= end; index += 1) max = Math.max(max, values[index]);
  return Number.isFinite(max) ? max : null;
}

function fingerprintDataset(universe: ExperimentSeries[], benchmark: ExperimentSeries): string {
  const signature = [...universe, benchmark]
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .map(series => {
      const first = series.candles[0];
      const last = series.candles[series.candles.length - 1];
      return `${series.symbol}:${series.candles.length}:${first?.time ?? 0}:${first?.close ?? 0}:${last?.time ?? 0}:${last?.close ?? 0}`;
    })
    .join('|');
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223 >>> 0;
    return state / 0x1_0000_0000;
  };
}

function quantile(sorted: number[], probability: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function error(code: string, message: string): IncrementalEdgeIssue {
  return { code, severity: 'ERROR', message };
}

function warning(code: string, message: string): IncrementalEdgeIssue {
  return { code, severity: 'WARNING', message };
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percent(value: number, total: number): number {
  return total > 0 ? round(value / total * 100, 2) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.floor(clamp(value, min, max));
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
