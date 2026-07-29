import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildForwardEvidence,
  canonicalJson,
  createForwardLedger,
  planForwardCollection,
  replayForwardLedger,
  type ForwardLedger,
  type ImmutableForwardCandidateDefinition,
  type PlannedForwardEvent
} from './immutableForwardCandidateV2';
import type { ExperimentCandle, ExperimentSeries } from '../experiments/incrementalEdgeExperiment';

const candidateFile = JSON.parse(
  readFileSync('research/strategy-candidates/us-forward-hybrid-v2.json', 'utf8')
) as { definitionHash: string; definition: ImmutableForwardCandidateDefinition };

test('immutable candidate definition matches its frozen SHA-256 hash', () => {
  const digest = `sha256:${createHash('sha256').update(canonicalJson(candidateFile.definition)).digest('hex')}`;
  assert.equal(digest, candidateFile.definitionHash);
  assert.ok(Date.parse(candidateFile.definition.forwardStart) > Date.parse(candidateFile.definition.frozenAt));
});

test('ledger rejects signals created before the untouched forward start', () => {
  const definition = fixtureDefinition();
  const ledger = createForwardLedger(definition, sha256(definition), definition.frozenAt);
  ledger.events.push({
    sequence: 1,
    type: 'SIGNAL_ISSUED',
    occurredAt: definition.forwardStart,
    entityId: 'invalid-pre-start',
    previousHash: 'GENESIS',
    eventHash: 'test',
    payload: {
      strategyId: 'BASELINE_BREAKOUT_FORWARD_V1',
      symbol: 'TEST',
      signalTime: Date.parse(definition.forwardStart) - 1,
      signalClose: 100,
      atrAtSignal: 2,
      regime: 'TRENDING',
      slippageBpsPerSide: 8
    }
  });
  assert.throws(() => replayForwardLedger(ledger), /Pre-forward signal rejected/);
});

test('forward collector issues from a completed forward bar and fills only on a later open', () => {
  const candles = fixtureCandles();
  const definition = fixtureDefinition(candles[200].time);
  let ledger = createForwardLedger(definition, sha256(definition), definition.frozenAt);
  const first = planForwardCollection({
    definition,
    ledger,
    universe: [{ symbol: 'TEST', candles: candles.slice(0, 201) }],
    benchmark: benchmarkSeries(candles.slice(0, 201)),
    observedAt: new Date(candles[200].time + 60_000).toISOString(),
    provider: 'fixture',
    executionCostsMeasured: false
  });
  const signal = first.find(event => event.type === 'SIGNAL_ISSUED' &&
    event.payload.strategyId === 'BASELINE_BREAKOUT_FORWARD_V1');
  assert.ok(signal);
  assert.equal(signal.payload.signalTime, candles[200].time);
  assert.equal(first.some(event => event.type === 'ENTRY_FILLED'), false);

  ledger = appendForTest(ledger, first);
  const second = planForwardCollection({
    definition,
    ledger,
    universe: [{ symbol: 'TEST', candles: candles.slice(0, 202) }],
    benchmark: benchmarkSeries(candles.slice(0, 202)),
    observedAt: new Date(candles[201].time + 60_000).toISOString(),
    provider: 'fixture',
    executionCostsMeasured: false
  });
  const entry = second.find(event => event.type === 'ENTRY_FILLED' && event.entityId === signal.entityId);
  assert.ok(entry);
  assert.equal(entry.payload.entryTime, candles[201].time);
  assert.ok(Number(entry.payload.entryTime) > Number(signal.payload.signalTime));
});

test('promotion remains collecting before duration, samples, and measured fills are complete', () => {
  const definition = fixtureDefinition();
  const ledger = createForwardLedger(definition, sha256(definition), definition.frozenAt);
  const report = buildForwardEvidence(definition, ledger, definition.forwardStart, false);
  assert.equal(report.status, 'COLLECTING');
  assert.equal(report.candidate.resolved, 0);
  assert.ok(report.issues.some(issue => issue.code === 'CANDIDATE_SAMPLE_INCOMPLETE'));
  assert.ok(report.issues.some(issue => issue.code === 'MEASURED_EXECUTION_REQUIRED'));
});

function fixtureDefinition(forwardTime = Date.UTC(2025, 6, 20)): ImmutableForwardCandidateDefinition {
  return {
    candidateId: 'TEST_FORWARD_V2',
    version: 2,
    frozenAt: new Date(forwardTime - 86_400_000).toISOString(),
    forwardStart: new Date(forwardTime).toISOString(),
    stage: 'FORWARD_COLLECTION',
    hypothesis: 'test',
    benchmark: 'SPY',
    universe: ['TEST'],
    controlStrategy: {
      id: 'BASELINE_BREAKOUT_FORWARD_V1',
      breakoutLookback: 20,
      minimumRelativeVolume: 1.5,
      minimumRsi: 50,
      maximumRsi: 75
    },
    candidateStrategy: {
      id: 'REGIME_QUALITY_BREAKOUT_FORWARD_V2',
      breakoutLookback: 20,
      minimumRelativeVolume: 1.3,
      minimumRsi: 52,
      maximumRsi: 76,
      maximumAtr14ToAtr50: 1.25,
      maximumFiveDayReturn: 0.3,
      allowedRegimes: ['TRENDING', 'RANGING']
    },
    execution: {
      feeBpsPerSide: 1,
      baseSlippageBpsPerSide: 8,
      maximumSlippageBpsPerSide: 45,
      stopAtrMultiple: 2,
      targetAtrMultiple: 4,
      maximumHoldingSessions: 20,
      riskPerTradePercent: 1
    },
    promotionGate: {
      minimumCalendarDays: 180,
      minimumResolvedCandidateTrades: 200,
      minimumResolvedControlTrades: 200,
      minimumExpectancyR: 0.05,
      minimumIncrementalExpectancyR: 0.05,
      requireIncrementalExpectancyLower95AboveZero: true,
      maximumDrawdownPercent: 15,
      minimumCoveredRegimes: 3,
      minimumTradesPerRegime: 20,
      requireMeasuredExecutionCosts: true
    }
  };
}

function fixtureCandles(): ExperimentCandle[] {
  const start = Date.UTC(2024, 0, 1);
  const candles = Array.from({ length: 202 }, (_, index) => {
    const close = 80 + index * 0.1 + (index % 2 === 0 ? -0.45 : 0.45);
    return {
      time: start + index * 86_400_000,
      open: close - 0.1,
      high: close + 0.35,
      low: close - 0.35,
      close,
      volume: 1_000_000
    };
  });
  const priorHigh = Math.max(...candles.slice(180, 200).map(candle => candle.high));
  candles[200] = {
    time: candles[200].time,
    open: priorHigh - 0.2,
    high: priorHigh + 1.2,
    low: priorHigh - 0.4,
    close: priorHigh + 0.8,
    volume: 2_000_000
  };
  candles[201] = {
    time: candles[201].time,
    open: candles[200].close + 0.1,
    high: candles[200].close + 0.5,
    low: candles[200].close - 0.2,
    close: candles[200].close + 0.3,
    volume: 1_100_000
  };
  return candles;
}

function benchmarkSeries(candles: ExperimentCandle[]): ExperimentSeries {
  return {
    symbol: 'SPY',
    candles: candles.map((candle, index) => ({
      ...candle,
      open: 400 + index * 0.1,
      high: 401 + index * 0.1,
      low: 399 + index * 0.1,
      close: 400 + index * 0.1,
      volume: 80_000_000
    }))
  };
}

function appendForTest(ledger: ForwardLedger, events: PlannedForwardEvent[]): ForwardLedger {
  const next = structuredClone(ledger);
  for (const item of events) {
    next.events.push({
      ...item,
      sequence: next.events.length + 1,
      previousHash: next.events.at(-1)?.eventHash ?? 'GENESIS',
      eventHash: `test-${next.events.length + 1}`
    });
  }
  return next;
}

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}
