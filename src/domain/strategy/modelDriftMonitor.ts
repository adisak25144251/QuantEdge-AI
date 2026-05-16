export type ModelDriftStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type ModelDriftAction = 'KEEP_ACTIVE' | 'REVIEW_STRATEGY' | 'DOWNGRADE_TO_PAPER';

export interface ModelDriftInput {
  baselineExpectancyR: number;
  currentExpectancyR: number;
  baselineHitRate: number;
  currentHitRate: number;
  sampleSize: number;
  minSampleSize?: number;
}

export interface ModelDriftIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ModelDriftReport {
  status: ModelDriftStatus;
  recommendedAction: ModelDriftAction;
  expectancyDeltaR: number;
  hitRateDelta: number;
  issues: ModelDriftIssue[];
}

export function evaluateModelDrift(input: ModelDriftInput): ModelDriftReport {
  const minSampleSize = input.minSampleSize ?? 30;
  const expectancyDeltaR = round(input.currentExpectancyR - input.baselineExpectancyR, 2);
  const hitRateDelta = round(input.currentHitRate - input.baselineHitRate, 2);
  const issues: ModelDriftIssue[] = [];

  if (input.sampleSize < minSampleSize) {
    issues.push({ code: 'DRIFT_SAMPLE_TOO_SMALL', severity: 'WARNING', message: `Need at least ${minSampleSize} forward samples.` });
  }
  if (expectancyDeltaR <= -0.2 || input.currentExpectancyR <= 0) {
    issues.push({ code: 'EXPECTANCY_DRIFT', severity: 'ERROR', message: 'Forward expectancy has materially decayed.' });
  }
  if (hitRateDelta <= -12) {
    issues.push({ code: 'HIT_RATE_DRIFT', severity: 'WARNING', message: 'Forward hit rate has materially decayed.' });
  }

  const status = issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS';
  return {
    status,
    recommendedAction: status === 'BLOCK' ? 'DOWNGRADE_TO_PAPER' : status === 'REVIEW' ? 'REVIEW_STRATEGY' : 'KEEP_ACTIVE',
    expectancyDeltaR,
    hitRateDelta,
    issues
  };
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
