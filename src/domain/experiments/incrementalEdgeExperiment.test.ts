import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runIncrementalEdgeExperiment,
  type ExperimentCandle,
  type ExperimentSeries
} from './incrementalEdgeExperiment';

function buildSeries(symbol: string, offset = 0): ExperimentSeries {
  const candles: ExperimentCandle[] = [];
  let close = 10 + offset;
  for (let index = 0; index < 900; index += 1) {
    const cycle = Math.sin(index / 20) * 0.05;
    const impulse = index % 35 === 0 ? 0.08 : 0.002;
    const previous = close;
    close = previous * (1 + cycle / 100 + impulse);
    const open = previous;
    const high = Math.max(open, close) * 1.015;
    const low = Math.min(open, close) * 0.985;
    candles.push({
      time: Date.UTC(2018, 0, 1 + index),
      open,
      high,
      low,
      close,
      volume: index % 35 === 0 ? 3_000_000 : 1_000_000
    });
  }
  return { symbol, candles };
}

test('incremental edge experiment is deterministic and leaves an evidence fingerprint', () => {
  const benchmark = buildSeries('SPY');
  const universe = Array.from({ length: 10 }, (_, index) => buildSeries(`T${index}`, index));
  const input = {
    universe,
    benchmark,
    dataset: {
      source: 'deterministic-fixture',
      observedAt: '2026-07-29T00:00:00.000Z',
      startDate: '2018-01-01',
      endDate: '2020-06-18',
      pointInTimeUniverse: true,
      delistedSecuritiesIncluded: true,
      splitAdjusted: true,
      dividendAdjusted: true,
      executionCostsMeasured: true,
      lookAheadBiasChecked: true
    },
    bootstrapSamples: 300,
    randomSeed: 42
  };
  const first = runIncrementalEdgeExperiment(input);
  const second = runIncrementalEdgeExperiment(input);

  assert.equal(first.dataset.fingerprint, second.dataset.fingerprint);
  assert.deepEqual(first.incrementalEdge, second.incrementalEdge);
  assert.equal(first.walkForward.windows.length, 5);
  assert.equal(first.schemaVersion, '1.0');
});

test('experiment blocks current-only universe and modeled execution evidence', () => {
  const report = runIncrementalEdgeExperiment({
    universe: Array.from({ length: 10 }, (_, index) => buildSeries(`T${index}`, index)),
    benchmark: buildSeries('SPY'),
    dataset: {
      source: 'current-universe-fixture',
      observedAt: '2026-07-29T00:00:00.000Z',
      startDate: '2018-01-01',
      endDate: '2020-06-18',
      pointInTimeUniverse: false,
      delistedSecuritiesIncluded: false,
      splitAdjusted: true,
      dividendAdjusted: true,
      executionCostsMeasured: false,
      lookAheadBiasChecked: true
    },
    bootstrapSamples: 300
  });

  assert.equal(report.status, 'BLOCK');
  assert(report.issues.some(issue => issue.code === 'POINT_IN_TIME_UNIVERSE_REQUIRED'));
  assert(report.issues.some(issue => issue.code === 'DELISTED_SECURITIES_MISSING'));
  assert(report.issues.some(issue => issue.code === 'EXECUTION_COSTS_MODELED' && issue.severity === 'WARNING'));
});

test('experiment rejects malformed and insufficient candle evidence without inventing metrics', () => {
  const report = runIncrementalEdgeExperiment({
    universe: [{ symbol: 'BAD', candles: [{ time: 1, open: 10, high: 9, low: 11, close: 10, volume: -1 }] }],
    benchmark: { symbol: 'SPY', candles: [] },
    dataset: {
      source: 'invalid-fixture',
      observedAt: '2026-07-29T00:00:00.000Z',
      startDate: '',
      endDate: '',
      pointInTimeUniverse: false,
      delistedSecuritiesIncluded: false,
      splitAdjusted: false,
      dividendAdjusted: false,
      executionCostsMeasured: false,
      lookAheadBiasChecked: false
    },
    bootstrapSamples: 300
  });

  assert.equal(report.status, 'BLOCK');
  assert.equal(report.baseline.trades, 0);
  assert.equal(report.hybrid.trades, 0);
  assert.equal(report.incrementalEdge.expectancyLiftR.estimate, 0);
  assert(report.issues.some(issue => issue.code === 'UNIVERSE_TOO_SMALL'));
  assert(report.issues.some(issue => issue.code === 'EXPERIMENT_SAMPLE_TOO_SMALL'));
});
