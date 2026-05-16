export type InstitutionalBacktestStatusV2 = 'PASS' | 'REVIEW' | 'BLOCK';

export interface InstitutionalBacktestInputV2 {
  sampleSize: number;
  outOfSampleExpectancyR: number;
  maxDrawdownPercent: number;
  walkForwardPositiveRate: number;
  monteCarloSurvivalRate: number;
  benchmarkExpectancyR: number;
  assetAwareFees: boolean;
  splitSessionAdjusted: boolean;
}

export interface InstitutionalBacktestReportV2 {
  status: InstitutionalBacktestStatusV2;
  edgeOverBenchmarkR: number;
  robustnessScore: number;
  issues: { code: string; detail: string }[];
}

const round2 = (value: number) => Number(value.toFixed(2));

export function evaluateInstitutionalBacktestV2(input: InstitutionalBacktestInputV2): InstitutionalBacktestReportV2 {
  const issues: { code: string; detail: string }[] = [];
  if (input.sampleSize < 200) issues.push({ code: 'BACKTEST_SAMPLE_TOO_SMALL', detail: 'Backtest has fewer than 200 trades.' });
  if (input.outOfSampleExpectancyR <= 0.05) issues.push({ code: 'EXPECTANCY_TOO_LOW', detail: 'Out-of-sample expectancy is too small.' });
  if (input.maxDrawdownPercent > 20) issues.push({ code: 'DRAWDOWN_TOO_HIGH', detail: 'Maximum drawdown exceeds policy.' });
  if (input.walkForwardPositiveRate < 65) issues.push({ code: 'WALK_FORWARD_UNSTABLE', detail: 'Walk-forward positive-window rate is below policy.' });
  if (input.monteCarloSurvivalRate < 80) issues.push({ code: 'MONTE_CARLO_SURVIVAL_LOW', detail: 'Monte Carlo survival rate is below policy.' });
  if (!input.assetAwareFees) issues.push({ code: 'ASSET_AWARE_FEES_MISSING', detail: 'Asset-specific fees are not modeled.' });
  if (!input.splitSessionAdjusted) issues.push({ code: 'SPLIT_SESSION_ADJUSTMENT_MISSING', detail: 'Split/session adjustment is missing.' });

  const edgeOverBenchmarkR = round2(input.outOfSampleExpectancyR - input.benchmarkExpectancyR);
  if (edgeOverBenchmarkR < 0.05) issues.push({ code: 'BENCHMARK_EDGE_TOO_SMALL', detail: 'Edge over benchmark is too small.' });

  const robustnessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Math.min(input.sampleSize / 4, 100) * 0.25 +
        input.walkForwardPositiveRate * 0.25 +
        input.monteCarloSurvivalRate * 0.25 +
        Math.max(0, 100 - input.maxDrawdownPercent * 3) * 0.25
      )
    )
  );

  const blockingIssues = issues.filter((issue) =>
    issue.code === 'BACKTEST_SAMPLE_TOO_SMALL' ||
    issue.code === 'DRAWDOWN_TOO_HIGH' ||
    issue.code === 'MONTE_CARLO_SURVIVAL_LOW' ||
    issue.code === 'SPLIT_SESSION_ADJUSTMENT_MISSING'
  );

  return {
    status: blockingIssues.length > 0 ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    edgeOverBenchmarkR,
    robustnessScore,
    issues
  };
}
