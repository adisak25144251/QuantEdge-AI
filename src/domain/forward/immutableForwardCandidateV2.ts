import type { ExperimentCandle, ExperimentRegime, ExperimentSeries } from '../experiments/incrementalEdgeExperiment';

export type ForwardStrategyId = 'BASELINE_BREAKOUT_FORWARD_V1' | 'REGIME_QUALITY_BREAKOUT_FORWARD_V2';
export type ForwardEventType =
  | 'COLLECTION_COMPLETED'
  | 'SIGNAL_ISSUED'
  | 'ENTRY_FILLED'
  | 'BAR_OBSERVED'
  | 'POSITION_EXITED';
export type ForwardPositionStatus = 'PENDING_ENTRY' | 'OPEN' | 'RESOLVED';
export type ForwardPromotionStatus = 'COLLECTING' | 'BLOCK' | 'PAPER_ELIGIBLE';

export interface ImmutableForwardCandidateDefinition {
  candidateId: string;
  version: number;
  frozenAt: string;
  forwardStart: string;
  stage: 'FORWARD_COLLECTION';
  hypothesis: string;
  benchmark: string;
  universe: string[];
  controlStrategy: {
    id: 'BASELINE_BREAKOUT_FORWARD_V1';
    breakoutLookback: number;
    minimumRelativeVolume: number;
    minimumRsi: number;
    maximumRsi: number;
  };
  candidateStrategy: {
    id: 'REGIME_QUALITY_BREAKOUT_FORWARD_V2';
    breakoutLookback: number;
    minimumRelativeVolume: number;
    minimumRsi: number;
    maximumRsi: number;
    maximumAtr14ToAtr50: number;
    maximumFiveDayReturn: number;
    allowedRegimes: ExperimentRegime[];
  };
  execution: {
    feeBpsPerSide: number;
    baseSlippageBpsPerSide: number;
    maximumSlippageBpsPerSide: number;
    stopAtrMultiple: number;
    targetAtrMultiple: number;
    maximumHoldingSessions: number;
    riskPerTradePercent: number;
  };
  promotionGate: {
    minimumCalendarDays: number;
    minimumResolvedCandidateTrades: number;
    minimumResolvedControlTrades: number;
    minimumExpectancyR: number;
    minimumIncrementalExpectancyR: number;
    requireIncrementalExpectancyLower95AboveZero: boolean;
    maximumDrawdownPercent: number;
    minimumCoveredRegimes: number;
    minimumTradesPerRegime: number;
    requireMeasuredExecutionCosts: boolean;
  };
}

export interface ForwardLedgerEvent {
  sequence: number;
  type: ForwardEventType;
  occurredAt: string;
  entityId: string;
  previousHash: string;
  eventHash: string;
  payload: Record<string, unknown>;
}

export interface ForwardLedger {
  schemaVersion: '1.0';
  candidateId: string;
  candidateHash: string;
  forwardStart: string;
  createdAt: string;
  events: ForwardLedgerEvent[];
}

export interface ForwardSignalState {
  id: string;
  strategyId: ForwardStrategyId;
  symbol: string;
  status: ForwardPositionStatus;
  signalTime: number;
  signalClose: number;
  atrAtSignal: number;
  regime: ExperimentRegime;
  slippageBpsPerSide: number;
  entryTime?: number;
  entryPrice?: number;
  stopPrice?: number;
  targetPrice?: number;
  observedSessions: number;
  maxFavorablePrice?: number;
  maxAdversePrice?: number;
  exitTime?: number;
  exitPrice?: number;
  outcome?: 'TARGET' | 'STOP' | 'TIME';
  rMultiple?: number;
}

export interface PlannedForwardEvent {
  type: ForwardEventType;
  occurredAt: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export interface ForwardCollectionInput {
  definition: ImmutableForwardCandidateDefinition;
  ledger: ForwardLedger;
  universe: ExperimentSeries[];
  benchmark: ExperimentSeries;
  observedAt: string;
  provider: string;
  executionCostsMeasured: boolean;
  dataFailures?: Array<{ symbol: string; reason: string }>;
}

export interface ForwardStrategyMetrics {
  signals: number;
  pending: number;
  open: number;
  resolved: number;
  precisionPercent: number;
  expectancyR: number;
  maxDrawdownPercent: number;
  averageSlippageBpsPerSide: number;
}

export interface ForwardPromotionIssue {
  code: string;
  severity: 'PENDING' | 'ERROR';
  message: string;
}

export interface ForwardEvidenceReport {
  schemaVersion: '1.0';
  candidateId: string;
  candidateHash: string;
  generatedAt: string;
  forwardStart: string;
  elapsedCalendarDays: number;
  status: ForwardPromotionStatus;
  control: ForwardStrategyMetrics;
  candidate: ForwardStrategyMetrics;
  incrementalExpectancyR: {
    estimate: number;
    lower95: number;
    upper95: number;
  };
  regimeCoverage: Array<{ regime: ExperimentRegime; trades: number; expectancyR: number }>;
  executionEvidence: 'MODELED' | 'MEASURED';
  ledger: {
    events: number;
    headHash: string;
    lastMarketThrough: string | null;
  };
  issues: ForwardPromotionIssue[];
  disclaimer: string;
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

const GENESIS_HASH = 'GENESIS';

export function createForwardLedger(
  definition: ImmutableForwardCandidateDefinition,
  candidateHash: string,
  createdAt: string
): ForwardLedger {
  if (!candidateHash.startsWith('sha256:') || candidateHash.length !== 71) {
    throw new Error('Candidate hash must be a complete sha256 digest.');
  }
  if (Date.parse(definition.forwardStart) <= Date.parse(definition.frozenAt)) {
    throw new Error('Forward start must be strictly later than the candidate freeze time.');
  }
  return {
    schemaVersion: '1.0',
    candidateId: definition.candidateId,
    candidateHash,
    forwardStart: definition.forwardStart,
    createdAt,
    events: []
  };
}

export function replayForwardLedger(ledger: ForwardLedger): Map<string, ForwardSignalState> {
  const signals = new Map<string, ForwardSignalState>();
  let expectedSequence = 1;
  for (const event of ledger.events) {
    if (event.sequence !== expectedSequence) throw new Error(`Ledger sequence gap at ${expectedSequence}.`);
    expectedSequence += 1;
    if (event.type === 'COLLECTION_COMPLETED') continue;

    if (event.type === 'SIGNAL_ISSUED') {
      if (signals.has(event.entityId)) throw new Error(`Duplicate signal ${event.entityId}.`);
      const signalTime = requiredNumber(event.payload.signalTime, 'signalTime');
      if (signalTime < Date.parse(ledger.forwardStart)) throw new Error('Pre-forward signal rejected.');
      signals.set(event.entityId, {
        id: event.entityId,
        strategyId: requiredStrategyId(event.payload.strategyId),
        symbol: requiredString(event.payload.symbol, 'symbol'),
        status: 'PENDING_ENTRY',
        signalTime,
        signalClose: requiredNumber(event.payload.signalClose, 'signalClose'),
        atrAtSignal: requiredNumber(event.payload.atrAtSignal, 'atrAtSignal'),
        regime: requiredRegime(event.payload.regime),
        slippageBpsPerSide: requiredNumber(event.payload.slippageBpsPerSide, 'slippageBpsPerSide'),
        observedSessions: 0
      });
      continue;
    }

    const signal = signals.get(event.entityId);
    if (!signal) throw new Error(`Event references missing signal ${event.entityId}.`);
    if (event.type === 'ENTRY_FILLED') {
      if (signal.status !== 'PENDING_ENTRY') throw new Error(`Invalid entry transition for ${signal.id}.`);
      const entryTime = requiredNumber(event.payload.entryTime, 'entryTime');
      if (entryTime <= signal.signalTime || entryTime < Date.parse(ledger.forwardStart)) {
        throw new Error('Entry must use a future forward-only bar.');
      }
      signal.entryTime = entryTime;
      signal.entryPrice = requiredNumber(event.payload.entryPrice, 'entryPrice');
      signal.stopPrice = requiredNumber(event.payload.stopPrice, 'stopPrice');
      signal.targetPrice = requiredNumber(event.payload.targetPrice, 'targetPrice');
      signal.maxFavorablePrice = signal.entryPrice;
      signal.maxAdversePrice = signal.entryPrice;
      signal.status = 'OPEN';
    } else if (event.type === 'BAR_OBSERVED') {
      if (signal.status !== 'OPEN') throw new Error(`Invalid observation transition for ${signal.id}.`);
      const barTime = requiredNumber(event.payload.barTime, 'barTime');
      if (barTime < Number(signal.entryTime)) throw new Error('Observation predates entry.');
      signal.observedSessions += 1;
      signal.maxFavorablePrice = Math.max(Number(signal.maxFavorablePrice), requiredNumber(event.payload.high, 'high'));
      signal.maxAdversePrice = Math.min(Number(signal.maxAdversePrice), requiredNumber(event.payload.low, 'low'));
    } else if (event.type === 'POSITION_EXITED') {
      if (signal.status !== 'OPEN') throw new Error(`Invalid exit transition for ${signal.id}.`);
      signal.exitTime = requiredNumber(event.payload.exitTime, 'exitTime');
      signal.exitPrice = requiredNumber(event.payload.exitPrice, 'exitPrice');
      signal.outcome = requiredOutcome(event.payload.outcome);
      signal.rMultiple = requiredNumber(event.payload.rMultiple, 'rMultiple');
      signal.status = 'RESOLVED';
    }
  }
  return signals;
}

export function planForwardCollection(input: ForwardCollectionInput): PlannedForwardEvent[] {
  assertLedgerIdentity(input.definition, input.ledger);
  const states = replayForwardLedger(input.ledger);
  const processedThrough = lastProcessedTimes(input.ledger);
  const benchmark = normalizeSeries(input.benchmark);
  const benchmarkByTime = new Map(benchmark.candles.map(candle => [candle.time, candle.close]));
  const benchmarkTimes = benchmark.candles.map(candle => candle.time);
  const events: PlannedForwardEvent[] = [];
  const forwardStart = Date.parse(input.definition.forwardStart);
  const normalizedUniverse = input.universe
    .map(normalizeSeries)
    .filter(series => input.definition.universe.includes(series.symbol));

  for (const series of normalizedUniverse) {
    const priorThrough = processedThrough.get(series.symbol) ?? forwardStart - 1;
    const closes = series.candles.map(candle => candle.close);
    const highs = series.candles.map(candle => candle.high);
    const volumes = series.candles.map(candle => candle.volume);
    const benchmarkCloses = alignBenchmarkCloses(series.candles, benchmarkByTime, benchmarkTimes);
    const active = new Map(
      [...states.values()]
        .filter(state => state.symbol === series.symbol && state.status !== 'RESOLVED')
        .map(state => [state.id, { ...state }])
    );

    for (let index = 200; index < series.candles.length; index += 1) {
      const candle = series.candles[index];
      if (candle.time < forwardStart || candle.time <= priorThrough) continue;

      for (const signal of [...active.values()]) {
        if (signal.status === 'PENDING_ENTRY' && candle.time > signal.signalTime) {
          const entryPrice = applyBuyCost(candle.open, signal.slippageBpsPerSide);
          const riskDistance = signal.atrAtSignal * input.definition.execution.stopAtrMultiple;
          if (riskDistance > 0 && riskDistance < entryPrice * 0.35) {
            signal.entryTime = candle.time;
            signal.entryPrice = entryPrice;
            signal.stopPrice = entryPrice - riskDistance;
            signal.targetPrice = entryPrice + signal.atrAtSignal * input.definition.execution.targetAtrMultiple;
            signal.status = 'OPEN';
            signal.maxFavorablePrice = entryPrice;
            signal.maxAdversePrice = entryPrice;
            events.push(event('ENTRY_FILLED', input.observedAt, signal.id, {
              entryTime: candle.time,
              entryPrice: round(entryPrice, 6),
              stopPrice: round(signal.stopPrice, 6),
              targetPrice: round(signal.targetPrice, 6),
              fillSource: 'NEXT_REGULAR_SESSION_OPEN',
              executionCostsMeasured: input.executionCostsMeasured
            }));
          }
        }

        if (signal.status !== 'OPEN' || candle.time < Number(signal.entryTime)) continue;
        signal.observedSessions += 1;
        signal.maxFavorablePrice = Math.max(Number(signal.maxFavorablePrice), candle.high);
        signal.maxAdversePrice = Math.min(Number(signal.maxAdversePrice), candle.low);
        events.push(event('BAR_OBSERVED', input.observedAt, signal.id, {
          barTime: candle.time,
          high: candle.high,
          low: candle.low,
          close: candle.close
        }));

        const stopHit = candle.low <= Number(signal.stopPrice);
        const targetHit = candle.high >= Number(signal.targetPrice);
        const timedOut = signal.observedSessions >= input.definition.execution.maximumHoldingSessions;
        if (!stopHit && !targetHit && !timedOut) continue;
        const outcome: 'STOP' | 'TARGET' | 'TIME' = stopHit ? 'STOP' : targetHit ? 'TARGET' : 'TIME';
        const rawExit = stopHit ? Number(signal.stopPrice) : targetHit ? Number(signal.targetPrice) : candle.close;
        const exitPrice = applySellCost(rawExit, signal.slippageBpsPerSide);
        const feeCost = (Number(signal.entryPrice) + exitPrice) * input.definition.execution.feeBpsPerSide / 10_000;
        const rMultiple = (exitPrice - Number(signal.entryPrice) - feeCost) /
          (Number(signal.entryPrice) - Number(signal.stopPrice));
        events.push(event('POSITION_EXITED', input.observedAt, signal.id, {
          exitTime: candle.time,
          exitPrice: round(exitPrice, 6),
          outcome,
          rMultiple: round(rMultiple, 4),
          observedSessions: signal.observedSessions
        }));
        signal.status = 'RESOLVED';
        active.delete(signal.id);
      }

      const indicators = indicatorSnapshot(series.candles, closes, highs, volumes, benchmarkCloses, index);
      for (const strategyId of ['BASELINE_BREAKOUT_FORWARD_V1', 'REGIME_QUALITY_BREAKOUT_FORWARD_V2'] as const) {
        const alreadyActive = [...active.values()].some(signal => signal.strategyId === strategyId);
        if (alreadyActive || !isSignalEligible(series.candles, index, indicators, strategyId, input.definition)) continue;
        const id = `${input.definition.candidateId}:${strategyId}:${series.symbol}:${isoDate(candle.time)}`;
        if (states.has(id) || events.some(planned => planned.entityId === id && planned.type === 'SIGNAL_ISSUED')) continue;
        const slippage = estimateSlippageBps(series.candles, volumes, index, indicators, input.definition);
        const signal: ForwardSignalState = {
          id,
          strategyId,
          symbol: series.symbol,
          status: 'PENDING_ENTRY',
          signalTime: candle.time,
          signalClose: candle.close,
          atrAtSignal: Number(indicators.atr14),
          regime: indicators.regime,
          slippageBpsPerSide: slippage,
          observedSessions: 0
        };
        active.set(id, signal);
        events.push(event('SIGNAL_ISSUED', input.observedAt, id, {
          strategyId,
          symbol: series.symbol,
          signalTime: candle.time,
          signalClose: candle.close,
          atrAtSignal: round(Number(indicators.atr14), 6),
          regime: indicators.regime,
          slippageBpsPerSide: slippage,
          indicatorSnapshot: indicators,
          signalCandleFingerprint: `${series.symbol}:${candle.time}:${candle.open}:${candle.high}:${candle.low}:${candle.close}:${candle.volume}`
        }));
      }
    }
  }

  const marketThroughBySymbol = Object.fromEntries(normalizedUniverse.map(series => [
    series.symbol,
    series.candles.filter(candle => candle.time >= forwardStart).at(-1)?.time ?? null
  ]));
  const newestMarketTime = Math.max(
    0,
    ...Object.values(marketThroughBySymbol).filter((value): value is number => typeof value === 'number')
  );
  const hasNewSymbolBar = Object.entries(marketThroughBySymbol).some(([symbol, value]) =>
    typeof value === 'number' && value > (processedThrough.get(symbol) ?? forwardStart - 1)
  );
  if (hasNewSymbolBar || input.ledger.events.length === 0) {
    events.push(event('COLLECTION_COMPLETED', input.observedAt, `collection:${newestMarketTime}:${input.observedAt}`, {
      provider: input.provider,
      observedAt: input.observedAt,
      marketThrough: newestMarketTime || null,
      marketThroughBySymbol,
      executionCostsMeasured: input.executionCostsMeasured,
      universeSnapshot: [...input.definition.universe],
      failures: input.dataFailures ?? []
    }));
  }
  return events;
}

export function buildForwardEvidence(
  definition: ImmutableForwardCandidateDefinition,
  ledger: ForwardLedger,
  generatedAt: string,
  executionCostsMeasured: boolean
): ForwardEvidenceReport {
  assertLedgerIdentity(definition, ledger);
  const states = [...replayForwardLedger(ledger).values()];
  const controlStates = states.filter(state => state.strategyId === definition.controlStrategy.id);
  const candidateStates = states.filter(state => state.strategyId === definition.candidateStrategy.id);
  const control = summarize(controlStates, definition.execution.riskPerTradePercent);
  const candidate = summarize(candidateStates, definition.execution.riskPerTradePercent);
  const controlR = resolvedR(controlStates);
  const candidateR = resolvedR(candidateStates);
  const incremental = bootstrapDifference(candidateR, controlR, 5_000, 25_144_252);
  const regimes: ExperimentRegime[] = ['TRENDING', 'RANGING', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'UNKNOWN'];
  const regimeCoverage = regimes.map(regime => {
    const values = candidateStates.filter(state => state.status === 'RESOLVED' && state.regime === regime);
    return {
      regime,
      trades: values.length,
      expectancyR: round(mean(resolvedR(values)), 4)
    };
  });
  const elapsedCalendarDays = Math.max(
    0,
    Math.floor((Date.parse(generatedAt) - Date.parse(definition.forwardStart)) / 86_400_000)
  );
  const gate = definition.promotionGate;
  const pending: ForwardPromotionIssue[] = [];
  const failures: ForwardPromotionIssue[] = [];
  if (elapsedCalendarDays < gate.minimumCalendarDays) pending.push(issue('FORWARD_DURATION_INCOMPLETE', 'PENDING', `Need ${gate.minimumCalendarDays} calendar days; collected ${elapsedCalendarDays}.`));
  if (candidate.resolved < gate.minimumResolvedCandidateTrades) pending.push(issue('CANDIDATE_SAMPLE_INCOMPLETE', 'PENDING', `Need ${gate.minimumResolvedCandidateTrades} resolved candidate trades; collected ${candidate.resolved}.`));
  if (control.resolved < gate.minimumResolvedControlTrades) pending.push(issue('CONTROL_SAMPLE_INCOMPLETE', 'PENDING', `Need ${gate.minimumResolvedControlTrades} resolved control trades; collected ${control.resolved}.`));
  const mature = pending.length === 0;
  if (mature && candidate.expectancyR < gate.minimumExpectancyR) failures.push(issue('FORWARD_EXPECTANCY_FAILED', 'ERROR', `Candidate expectancy must be at least ${gate.minimumExpectancyR}R.`));
  if (mature && incremental.estimate < gate.minimumIncrementalExpectancyR) failures.push(issue('INCREMENTAL_EDGE_FAILED', 'ERROR', `Incremental expectancy must be at least ${gate.minimumIncrementalExpectancyR}R.`));
  if (mature && gate.requireIncrementalExpectancyLower95AboveZero && incremental.lower95 <= 0) failures.push(issue('INCREMENTAL_CI_FAILED', 'ERROR', 'Incremental expectancy 95% lower bound must be above zero.'));
  if (mature && candidate.maxDrawdownPercent > gate.maximumDrawdownPercent) failures.push(issue('DRAWDOWN_GATE_FAILED', 'ERROR', `Candidate drawdown exceeds ${gate.maximumDrawdownPercent}%.`));
  const coveredRegimes = regimeCoverage.filter(item => item.trades >= gate.minimumTradesPerRegime && item.expectancyR > 0).length;
  if (mature && coveredRegimes < gate.minimumCoveredRegimes) failures.push(issue('REGIME_STABILITY_FAILED', 'ERROR', `Need positive expectancy in ${gate.minimumCoveredRegimes} regimes.`));
  if (gate.requireMeasuredExecutionCosts && !executionCostsMeasured) {
    (mature ? failures : pending).push(issue('MEASURED_EXECUTION_REQUIRED', mature ? 'ERROR' : 'PENDING', 'Modeled slippage cannot satisfy the production promotion gate.'));
  }
  const collectionEvents = ledger.events.filter(event => event.type === 'COLLECTION_COMPLETED');
  const latestCollection = collectionEvents.at(-1);
  const latestFailures = Array.isArray(latestCollection?.payload.failures)
    ? latestCollection.payload.failures
    : [];
  if (latestFailures.length > 0) {
    (mature ? failures : pending).push(issue(
      'FORWARD_DATA_COLLECTION_INCOMPLETE',
      mature ? 'ERROR' : 'PENDING',
      `${latestFailures.length} symbols failed in the latest collection run.`
    ));
  }
  const issues = [...pending, ...failures];
  const status: ForwardPromotionStatus = pending.length > 0 ? 'COLLECTING' : failures.length > 0 ? 'BLOCK' : 'PAPER_ELIGIBLE';
  const lastMarketThrough = collectionEvents
    .map(event => Number(event.payload.marketThrough))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  return {
    schemaVersion: '1.0',
    candidateId: definition.candidateId,
    candidateHash: ledger.candidateHash,
    generatedAt,
    forwardStart: definition.forwardStart,
    elapsedCalendarDays,
    status,
    control,
    candidate,
    incrementalExpectancyR: incremental,
    regimeCoverage,
    executionEvidence: executionCostsMeasured ? 'MEASURED' : 'MODELED',
    ledger: {
      events: ledger.events.length,
      headHash: ledger.events.at(-1)?.eventHash ?? GENESIS_HASH,
      lastMarketThrough: lastMarketThrough ? new Date(lastMarketThrough).toISOString() : null
    },
    issues,
    disclaimer: 'Forward educational paper evidence only. Not personal investment advice or approval for real-money trading.'
  };
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function isSignalEligible(
  candles: ExperimentCandle[],
  index: number,
  indicator: IndicatorSnapshot,
  strategyId: ForwardStrategyId,
  definition: ImmutableForwardCandidateDefinition
): boolean {
  const close = candles[index].close;
  const rule = strategyId === definition.controlStrategy.id
    ? definition.controlStrategy
    : definition.candidateStrategy;
  const baseline = indicator.priorHigh20 !== null &&
    close > indicator.priorHigh20 &&
    indicator.sma20 !== null &&
    indicator.sma50 !== null &&
    close > indicator.sma20 &&
    close > indicator.sma50 &&
    indicator.rsi14 !== null &&
    indicator.rsi14 >= rule.minimumRsi &&
    indicator.rsi14 <= rule.maximumRsi &&
    indicator.relativeVolume20 !== null &&
    indicator.relativeVolume20 >= rule.minimumRelativeVolume;
  if (!baseline || strategyId === definition.controlStrategy.id) return baseline;
  const candidate = definition.candidateStrategy;
  return indicator.sma20 !== null &&
    indicator.sma50 !== null &&
    indicator.sma200 !== null &&
    indicator.sma20 > indicator.sma50 &&
    indicator.sma50 > indicator.sma200 &&
    indicator.return63 !== null &&
    indicator.benchmarkReturn63 !== null &&
    indicator.return63 > indicator.benchmarkReturn63 &&
    indicator.atr14 !== null &&
    indicator.atr50 !== null &&
    indicator.atr14 <= indicator.atr50 * candidate.maximumAtr14ToAtr50 &&
    indicator.return5 !== null &&
    indicator.return5 <= candidate.maximumFiveDayReturn &&
    candidate.allowedRegimes.includes(indicator.regime);
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
  const return5 = rateOfChange(closes, index, 5);
  const return63 = rateOfChange(closes, index, 63);
  const benchmarkReturn63 = rateOfChangeNullable(benchmarkCloses, index, 63);
  const priorHigh20 = maxRange(highs, index - 20, index - 1);
  const atrPercent = atr14 && closes[index] > 0 ? atr14 / closes[index] * 100 : Number.NaN;
  const path = closes.slice(Math.max(0, index - 29), index + 1);
  const netMove = path.length > 1 ? Math.abs(path.at(-1)! - path[0]) : 0;
  const grossMove = path.slice(1).reduce((sum, value, offset) => sum + Math.abs(value - path[offset]), 0);
  const trendEfficiency = grossMove > 0 ? Math.min(50, netMove / grossMove * 50) : 0;
  return {
    sma20, sma50, sma200, atr14, atr50, rsi14, relativeVolume20, return5, return63,
    benchmarkReturn63, priorHigh20,
    regime: classifyRegime(trendEfficiency, atrPercent, sma20, sma50)
  };
}

function summarize(states: ForwardSignalState[], riskPercent: number): ForwardStrategyMetrics {
  const resolved = states.filter(state => state.status === 'RESOLVED' && Number.isFinite(state.rMultiple));
  const returns = resolved.map(state => Number(state.rMultiple));
  let equity = 100;
  let peak = equity;
  let maxDrawdown = 0;
  for (const state of [...resolved].sort((a, b) => Number(a.exitTime) - Number(b.exitTime))) {
    equity *= 1 + Number(state.rMultiple) * riskPercent / 100;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - equity) / peak * 100 : 100);
  }
  return {
    signals: states.length,
    pending: states.filter(state => state.status === 'PENDING_ENTRY').length,
    open: states.filter(state => state.status === 'OPEN').length,
    resolved: resolved.length,
    precisionPercent: percent(returns.filter(value => value > 0).length, returns.length),
    expectancyR: round(mean(returns), 4),
    maxDrawdownPercent: round(maxDrawdown, 2),
    averageSlippageBpsPerSide: round(mean(states.map(state => state.slippageBpsPerSide)), 2)
  };
}

function bootstrapDifference(candidate: number[], control: number[], samples: number, seed: number) {
  const estimate = mean(candidate) - mean(control);
  if (candidate.length === 0 || control.length === 0) return { estimate: round(estimate, 4), lower95: 0, upper95: 0 };
  const random = seededRandom(seed);
  const values: number[] = [];
  for (let sample = 0; sample < samples; sample += 1) {
    let candidateTotal = 0;
    let controlTotal = 0;
    for (let index = 0; index < candidate.length; index += 1) candidateTotal += candidate[Math.floor(random() * candidate.length)];
    for (let index = 0; index < control.length; index += 1) controlTotal += control[Math.floor(random() * control.length)];
    values.push(candidateTotal / candidate.length - controlTotal / control.length);
  }
  values.sort((a, b) => a - b);
  return {
    estimate: round(estimate, 4),
    lower95: round(values[Math.floor(values.length * 0.025)] ?? 0, 4),
    upper95: round(values[Math.floor(values.length * 0.975)] ?? 0, 4)
  };
}

function lastProcessedTimes(ledger: ForwardLedger): Map<string, number> {
  const output = new Map<string, number>();
  for (const event of ledger.events) {
    if (event.type !== 'COLLECTION_COMPLETED') continue;
    const values = event.payload.marketThroughBySymbol;
    if (!values || typeof values !== 'object') continue;
    for (const [symbol, raw] of Object.entries(values)) {
      const time = Number(raw);
      if (Number.isFinite(time)) output.set(symbol, Math.max(output.get(symbol) ?? 0, time));
    }
  }
  return output;
}

function assertLedgerIdentity(definition: ImmutableForwardCandidateDefinition, ledger: ForwardLedger) {
  if (ledger.candidateId !== definition.candidateId || ledger.forwardStart !== definition.forwardStart) {
    throw new Error('Ledger identity does not match the immutable candidate.');
  }
}

function event(type: ForwardEventType, occurredAt: string, entityId: string, payload: Record<string, unknown>): PlannedForwardEvent {
  return { type, occurredAt, entityId, payload };
}

function normalizeSeries(series: ExperimentSeries): ExperimentSeries {
  const byTime = new Map<number, ExperimentCandle>();
  for (const raw of series.candles ?? []) {
    const candle = { ...raw, time: Number(raw.time), open: Number(raw.open), high: Number(raw.high), low: Number(raw.low), close: Number(raw.close), volume: Number(raw.volume) };
    if ([candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite) &&
      candle.time > 0 && candle.open > 0 && candle.close > 0 &&
      candle.high >= Math.max(candle.open, candle.close, candle.low) &&
      candle.low <= Math.min(candle.open, candle.close, candle.high) && candle.volume >= 0) {
      byTime.set(candle.time, candle);
    }
  }
  return { symbol: series.symbol.trim().toUpperCase(), candles: [...byTime.values()].sort((a, b) => a.time - b.time) };
}

function alignBenchmarkCloses(candles: ExperimentCandle[], benchmark: Map<number, number>, times: number[]): Array<number | null> {
  let cursor = 0;
  let latest: number | null = null;
  return candles.map(candle => {
    while (cursor < times.length && times[cursor] <= candle.time) {
      latest = benchmark.get(times[cursor]) ?? latest;
      cursor += 1;
    }
    return latest;
  });
}

function estimateSlippageBps(candles: ExperimentCandle[], volumes: number[], index: number, indicator: IndicatorSnapshot, definition: ImmutableForwardCandidateDefinition): number {
  const averageVolume = averageRange(volumes, index - 20, index - 1) ?? 0;
  const dollarVolume = averageVolume * candles[index].close;
  const liquidityPenalty = dollarVolume < 5_000_000 ? 20 : dollarVolume < 20_000_000 ? 12 : dollarVolume < 100_000_000 ? 5 : 0;
  const volatilityPenalty = indicator.atr14 ? Math.min(12, indicator.atr14 / candles[index].close * 150) : 0;
  return round(Math.min(definition.execution.maximumSlippageBpsPerSide, definition.execution.baseSlippageBpsPerSide + liquidityPenalty + volatilityPenalty), 2);
}

function classifyRegime(efficiency: number, atrPercent: number, sma20: number | null, sma50: number | null): ExperimentRegime {
  if (![efficiency, atrPercent, sma20, sma50].every(value => value !== null && Number.isFinite(value))) return 'UNKNOWN';
  if (atrPercent >= 5) return 'HIGH_VOLATILITY';
  if (atrPercent <= 0.7 && efficiency < 20) return 'LOW_VOLATILITY';
  const separation = Math.abs(Number(sma20) - Number(sma50)) / Math.max(Math.abs(Number(sma50)), 1) * 100;
  if (efficiency >= 25 && separation >= 0.5) return 'TRENDING';
  if (efficiency <= 18 && separation < 1) return 'RANGING';
  return 'UNKNOWN';
}

function atr(candles: ExperimentCandle[], index: number, period: number): number | null {
  if (index < period) return null;
  let total = 0;
  for (let current = index - period + 1; current <= index; current += 1) {
    const candle = candles[current];
    const previousClose = candles[current - 1]?.close ?? candle.close;
    total += Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  }
  return total / period;
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
  return 100 - 100 / (1 + gains / losses);
}

function averageRange(values: number[], start: number, end: number): number | null {
  if (start < 0 || end < start || end >= values.length) return null;
  return values.slice(start, end + 1).reduce((sum, value) => sum + value, 0) / (end - start + 1);
}

function maxRange(values: number[], start: number, end: number): number | null {
  if (start < 0 || end < start || end >= values.length) return null;
  return Math.max(...values.slice(start, end + 1));
}

function rateOfChange(values: number[], index: number, period: number): number | null {
  return index >= period && values[index - period] > 0 ? values[index] / values[index - period] - 1 : null;
}

function rateOfChangeNullable(values: Array<number | null>, index: number, period: number): number | null {
  const current = values[index];
  const prior = values[index - period];
  return index >= period && current !== null && prior !== null && prior > 0 ? current / prior - 1 : null;
}

function applyBuyCost(price: number, bps: number) {
  return price * (1 + bps / 10_000);
}

function applySellCost(price: number, bps: number) {
  return price * (1 - bps / 10_000);
}

function resolvedR(states: ForwardSignalState[]) {
  return states.filter(state => state.status === 'RESOLVED' && Number.isFinite(state.rMultiple)).map(state => Number(state.rMultiple));
}

function requiredNumber(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Ledger ${field} is invalid.`);
  return parsed;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Ledger ${field} is invalid.`);
  return value;
}

function requiredStrategyId(value: unknown): ForwardStrategyId {
  if (value !== 'BASELINE_BREAKOUT_FORWARD_V1' && value !== 'REGIME_QUALITY_BREAKOUT_FORWARD_V2') throw new Error('Ledger strategyId is invalid.');
  return value;
}

function requiredRegime(value: unknown): ExperimentRegime {
  if (!['TRENDING', 'RANGING', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'UNKNOWN'].includes(String(value))) throw new Error('Ledger regime is invalid.');
  return value as ExperimentRegime;
}

function requiredOutcome(value: unknown): 'TARGET' | 'STOP' | 'TIME' {
  if (value !== 'TARGET' && value !== 'STOP' && value !== 'TIME') throw new Error('Ledger outcome is invalid.');
  return value;
}

function issue(code: string, severity: ForwardPromotionIssue['severity'], message: string): ForwardPromotionIssue {
  return { code, severity, message };
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percent(value: number, total: number): number {
  return total > 0 ? round(value / total * 100, 2) : 0;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

function isoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}
