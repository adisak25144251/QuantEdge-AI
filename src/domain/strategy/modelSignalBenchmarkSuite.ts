export type BenchmarkStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface SignalBenchmarkMetrics {
  expectancyR: number;
  hitRate: number;
  maxDrawdownPercent: number;
}

export interface SignalBenchmarkInput {
  samples: number;
  ai: SignalBenchmarkMetrics;
  baseline: SignalBenchmarkMetrics | null;
  minSamples?: number;
  minExpectancyLiftR?: number;
  maxAiDrawdownPercent?: number;
}

export interface BenchmarkIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface SignalBenchmarkReport {
  status: BenchmarkStatus;
  expectancyLiftR: number | null;
  hitRateLift: number | null;
  drawdownDeltaPercent: number | null;
  aiOutperformsBaseline: boolean;
  issues: BenchmarkIssue[];
}

export function benchmarkSignals(input: SignalBenchmarkInput): SignalBenchmarkReport {
  const issues: BenchmarkIssue[] = [];
  const minSamples = input.minSamples ?? 100;
  const minExpectancyLiftR = input.minExpectancyLiftR ?? 0.05;
  const maxAiDrawdownPercent = input.maxAiDrawdownPercent ?? 20;
  if (!input.baseline) {
    return {
      status: 'BLOCK',
      expectancyLiftR: null,
      hitRateLift: null,
      drawdownDeltaPercent: null,
      aiOutperformsBaseline: false,
      issues: [{
        code: 'BASELINE_EVIDENCE_REQUIRED',
        severity: 'ERROR',
        message: 'Measured baseline evidence is required before claiming incremental performance.'
      }]
    };
  }
  const expectancyLiftR = round(input.ai.expectancyR - input.baseline.expectancyR, 2);
  const hitRateLift = round(input.ai.hitRate - input.baseline.hitRate, 2);
  const drawdownDeltaPercent = round(input.ai.maxDrawdownPercent - input.baseline.maxDrawdownPercent, 2);
  const aiOutperformsBaseline = expectancyLiftR >= minExpectancyLiftR && input.ai.maxDrawdownPercent <= maxAiDrawdownPercent;

  if (input.samples < minSamples) {
    issues.push({ code: 'BENCHMARK_SAMPLE_TOO_SMALL', severity: 'ERROR', message: `Need at least ${minSamples} benchmark samples.` });
  }

  if (!aiOutperformsBaseline) {
    issues.push({ code: 'AI_UNDERPERFORMS_BASELINE', severity: 'ERROR', message: 'AI signal does not materially outperform the baseline.' });
  }

  if (hitRateLift < 0) {
    issues.push({ code: 'AI_HIT_RATE_BELOW_BASELINE', severity: 'WARNING', message: 'AI hit rate is below baseline rule hit rate.' });
  }

  if (drawdownDeltaPercent > 5) {
    issues.push({ code: 'AI_DRAWDOWN_WORSE_THAN_BASELINE', severity: 'WARNING', message: 'AI drawdown is materially worse than baseline.' });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    expectancyLiftR,
    hitRateLift,
    drawdownDeltaPercent,
    aiOutperformsBaseline,
    issues
  };
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
