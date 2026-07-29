import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runIncrementalEdgeExperiment,
  type ExperimentSeries
} from '../src/domain/experiments/incrementalEdgeExperiment';
import { fetchYahooAdjustedDaily, mapWithConcurrency } from './lib/yahooAdjustedDaily';

const CURRENT_RESEARCH_UNIVERSE = [
  'SOUN', 'BBAI', 'AEHR', 'POET', 'INDI', 'OUST', 'NVTS', 'EAF', 'UUUU', 'SMR',
  'WULF', 'CRDO', 'CORZ', 'IREN', 'MU', 'AAOI', 'LASR', 'ACMR', 'BE', 'EOSE'
];
const BENCHMARK = 'SPY';
const START_DATE = '2015-01-01';
const CONCURRENCY = 4;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const symbols = [...CURRENT_RESEARCH_UNIVERSE, BENCHMARK];
  const failures: Array<{ symbol: string; reason: string }> = [];
  const downloaded = await mapWithConcurrency(symbols, CONCURRENCY, async symbol => {
    try {
      return await fetchYahooAdjustedDaily(symbol, START_DATE);
    } catch (error) {
      failures.push({ symbol, reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  });
  const series = downloaded.filter((item): item is ExperimentSeries => item !== null);
  const benchmark = series.find(item => item.symbol === BENCHMARK);
  if (!benchmark) throw new Error('Benchmark SPY could not be loaded; the experiment is not evaluable.');

  const universe = series.filter(item => item.symbol !== BENCHMARK);
  const timestamps = universe.flatMap(item => item.candles.map(candle => candle.time));
  const report = runIncrementalEdgeExperiment({
    universe,
    benchmark,
    dataset: {
      source: 'Yahoo Finance public chart endpoint; adjusted OHLC derived from adjclose ratio',
      observedAt: new Date().toISOString(),
      startDate: timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString().slice(0, 10) : '',
      endDate: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString().slice(0, 10) : '',
      pointInTimeUniverse: false,
      delistedSecuritiesIncluded: false,
      splitAdjusted: true,
      dividendAdjusted: true,
      executionCostsMeasured: false,
      lookAheadBiasChecked: true
    },
    execution: {
      feeBpsPerSide: 1,
      baseSlippageBpsPerSide: 8,
      maxSlippageBpsPerSide: 45,
      stopAtrMultiple: 2,
      targetAtrMultiple: 4,
      maxHoldingBars: 20,
      riskPerTradePercent: 1
    },
    minTrades: 200,
    minTradesPerWindow: 20,
    minPositiveWindowRate: 70,
    minExpectancyLiftR: 0.05,
    maxDrawdownPercent: 20,
    bootstrapSamples: 5_000,
    randomSeed: 25_144_251
  });

  const evidence = {
    ...report,
    downloadFailures: failures,
    limitations: [
      'This run uses a current research universe and therefore cannot remove survivorship bias.',
      'Yahoo adjusted history is suitable for research continuity, not exchange-grade execution reconstruction.',
      'Slippage is modeled from volatility and dollar-volume tiers; measured paper fills are still required.',
      'A PASS result is intentionally impossible until point-in-time constituents, delisted securities, and measured execution evidence are supplied.'
    ],
    disclaimer: 'Educational research evidence only. Not personal investment advice and not approval for real-money trading.'
  };
  const runDirectory = path.join(rootDir, 'artifacts', 'strategy-experiments', report.runId);
  const publicDirectory = path.join(rootDir, 'public', 'evidence');
  await Promise.all([
    mkdir(runDirectory, { recursive: true }),
    mkdir(publicDirectory, { recursive: true })
  ]);
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  await Promise.all([
    writeFile(path.join(runDirectory, 'report.json'), serialized, 'utf8'),
    writeFile(path.join(publicDirectory, 'incremental-edge-latest.json'), serialized, 'utf8')
  ]);

  process.stdout.write([
    `Run: ${report.runId}`,
    `Status: ${report.status}`,
    `Universe: ${report.dataset.symbols.length} symbols / ${report.dataset.candleCount} candles`,
    `Baseline: ${report.baseline.trades} trades, ${report.baseline.expectancyR}R expectancy, ${report.baseline.maxDrawdownPercent}% max DD`,
    `Hybrid: ${report.hybrid.trades} trades, ${report.hybrid.expectancyR}R expectancy, ${report.hybrid.maxDrawdownPercent}% max DD`,
    `Incremental expectancy: ${report.incrementalEdge.expectancyLiftR.estimate}R (95% CI ${report.incrementalEdge.expectancyLiftR.lower95} to ${report.incrementalEdge.expectancyLiftR.upper95})`,
    `Walk-forward: ${report.walkForward.positiveWindowRate}% positive eligible windows`,
    `Issues: ${report.issues.map(issue => issue.code).join(', ') || 'none'}`,
    `Evidence: ${path.join(runDirectory, 'report.json')}`
  ].join('\n') + '\n');
}

void main().catch(error => {
  process.stderr.write(`Incremental edge experiment failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
