import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeRegimePerformance,
  buildWalkForwardWindows,
  classifyMarketRegime,
  evaluateWalkForwardStability,
  summarizeBacktestEvidence,
  toLiveReadinessBacktestInput
} from './backtestEvidence';

const makeTrade = (id: number, rMultiple: number, balanceAfter: number) => ({
  id,
  pnl: rMultiple * 100,
  rMultiple,
  balanceAfter,
  exitTime: `2026-05-09T${String(id).padStart(2, '0')}:00:00.000Z`
});

test('summarizeBacktestEvidence splits chronological trades into in-sample and out-of-sample windows', () => {
  const trades = [
    makeTrade(1, -1, 9900),
    makeTrade(2, 2, 10100),
    makeTrade(3, -1, 10000),
    makeTrade(4, 1.5, 10150),
    makeTrade(5, 1, 10250),
    makeTrade(6, -0.5, 10200),
    makeTrade(7, 2, 10400),
    makeTrade(8, 1, 10500),
    makeTrade(9, -1, 10400),
    makeTrade(10, 2, 10600)
  ];

  const evidence = summarizeBacktestEvidence({
    trades,
    initialBalance: 10_000,
    inSampleRatio: 0.6
  });

  assert.equal(evidence.sampleSize, 10);
  assert.equal(evidence.inSampleTrades, 6);
  assert.equal(evidence.outOfSampleTrades, 4);
  assert.equal(evidence.outOfSampleExpectancyR, 1);
  assert.equal(evidence.outOfSampleWinRate, 75);
});

test('summarizeBacktestEvidence estimates max drawdown from balance path', () => {
  const evidence = summarizeBacktestEvidence({
    trades: [
      makeTrade(1, 2, 10_200),
      makeTrade(2, 1, 10_300),
      makeTrade(3, -3, 10_000),
      makeTrade(4, 1, 10_100)
    ],
    initialBalance: 10_000,
    inSampleRatio: 0.5
  });

  assert.equal(evidence.maxDrawdownPercent, 2.91);
});

test('toLiveReadinessBacktestInput maps unavailable evidence to hard-blocking defaults', () => {
  const readinessInput = toLiveReadinessBacktestInput(null);

  assert.equal(readinessInput.sampleSize, 0);
  assert.equal(readinessInput.outOfSampleExpectancyR, 0);
  assert.equal(readinessInput.maxDrawdownPercent, 100);
});

test('toLiveReadinessBacktestInput maps real evidence into readiness fields', () => {
  const evidence = summarizeBacktestEvidence({
    trades: Array.from({ length: 220 }, (_, index) => makeTrade(index + 1, index % 3 === 0 ? -1 : 1.2, 10_000 + index * 10)),
    initialBalance: 10_000,
    inSampleRatio: 0.7
  });

  const readinessInput = toLiveReadinessBacktestInput(evidence);

  assert.equal(readinessInput.sampleSize, 220);
  assert.equal(readinessInput.outOfSampleExpectancyR > 0, true);
  assert.equal(readinessInput.maxDrawdownPercent >= 0, true);
});

test('buildWalkForwardWindows creates rolling train/test windows without lookahead overlap', () => {
  const windows = buildWalkForwardWindows({
    totalCandles: 500,
    trainSize: 200,
    testSize: 50,
    stepSize: 50
  });

  assert.equal(windows.length, 6);
  assert.deepEqual(windows[0], {
    id: 1,
    trainStart: 0,
    trainEnd: 199,
    testStart: 200,
    testEnd: 249
  });
  assert.equal(windows[1].trainStart, 50);
  assert.equal(windows[1].testStart, 250);
});

test('evaluateWalkForwardStability grades robustness by positive windows and expectancy dispersion', () => {
  const stable = evaluateWalkForwardStability([
    { id: 1, trades: 60, expectancyR: 0.32, maxDrawdownPercent: 8 },
    { id: 2, trades: 58, expectancyR: 0.28, maxDrawdownPercent: 9 },
    { id: 3, trades: 62, expectancyR: 0.35, maxDrawdownPercent: 7 },
    { id: 4, trades: 55, expectancyR: 0.22, maxDrawdownPercent: 10 }
  ]);

  assert.equal(stable.status, 'PASS');
  assert.equal(stable.positiveWindowRate, 100);
  assert.equal(stable.minWindowExpectancyR, 0.22);

  const overfit = evaluateWalkForwardStability([
    { id: 1, trades: 60, expectancyR: 0.9, maxDrawdownPercent: 4 },
    { id: 2, trades: 4, expectancyR: -0.4, maxDrawdownPercent: 18 },
    { id: 3, trades: 5, expectancyR: 0.1, maxDrawdownPercent: 22 }
  ]);

  assert.equal(overfit.status, 'BLOCK');
  assert.equal(overfit.issues.some(issue => issue.code === 'LOW_POSITIVE_WINDOW_RATE'), true);
  assert.equal(overfit.issues.some(issue => issue.code === 'WINDOW_SAMPLE_TOO_SMALL'), true);
});

test('classifyMarketRegime separates trending, ranging, and volatile candles', () => {
  assert.equal(classifyMarketRegime({ adx: 31, atrPercent: 1.2, emaFast: 105, emaSlow: 100 }), 'TRENDING');
  assert.equal(classifyMarketRegime({ adx: 13, atrPercent: 0.8, emaFast: 100.3, emaSlow: 100 }), 'RANGING');
  assert.equal(classifyMarketRegime({ adx: 18, atrPercent: 4.5, emaFast: 101, emaSlow: 100 }), 'HIGH_VOLATILITY');
});

test('analyzeRegimePerformance reports coverage and expectancy per regime', () => {
  const report = analyzeRegimePerformance([
    { ...makeTrade(1, 1, 10100), regime: 'TRENDING' },
    { ...makeTrade(2, 1.5, 10250), regime: 'TRENDING' },
    { ...makeTrade(3, -1, 10150), regime: 'RANGING' },
    { ...makeTrade(4, -0.5, 10100), regime: 'RANGING' },
    { ...makeTrade(5, 0.8, 10180), regime: 'HIGH_VOLATILITY' }
  ]);

  assert.equal(report.coveredRegimes, 3);
  assert.equal(report.byRegime.TRENDING.expectancyR, 1.25);
  assert.equal(report.byRegime.RANGING.expectancyR, -0.75);
  assert.equal(report.issues.some(issue => issue.code === 'NEGATIVE_REGIME_EXPECTANCY'), true);
});
