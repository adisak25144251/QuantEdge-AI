export type ReleaseReadinessStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface ReleaseReadinessInput {
  testsPassing: boolean;
  lintPassing: boolean;
  buildPassing: boolean;
  smokePassing: boolean;
  securityStatus: ReleaseReadinessStatus;
  deploymentStatus: ReleaseReadinessStatus;
  liveTradingLocked: boolean;
  rollbackPlanReady: boolean;
  environmentReviewed: boolean;
}

export interface ReleaseReadinessCheck {
  code: string;
  status: ReleaseReadinessStatus;
  detail: string;
}

export interface ReleaseReadinessReport {
  status: ReleaseReadinessStatus;
  releaseAllowed: boolean;
  checks: ReleaseReadinessCheck[];
}

export function evaluateReleaseReadiness(input: ReleaseReadinessInput): ReleaseReadinessReport {
  const checks: ReleaseReadinessCheck[] = [
    boolCheck('TESTS', input.testsPassing, 'Automated tests passed.', 'Automated tests are not passing.', 'BLOCK'),
    boolCheck('LINT', input.lintPassing, 'Type/lint checks passed.', 'Type/lint checks are not passing.', 'BLOCK'),
    boolCheck('BUILD', input.buildPassing, 'Production build passed.', 'Production build is not passing.', 'BLOCK'),
    boolCheck('SMOKE', input.smokePassing, 'Smoke tests passed.', 'Smoke tests are not passing.', 'BLOCK'),
    statusCheck('SECURITY', input.securityStatus, 'Security posture'),
    statusCheck('DEPLOYMENT', input.deploymentStatus, 'Deployment observability'),
    boolCheck('LIVE_TRADING_LOCK', input.liveTradingLocked, 'Live API trading is locked.', 'Live API trading must stay locked for release.', 'BLOCK'),
    boolCheck('ROLLBACK_PLAN', input.rollbackPlanReady, 'Rollback plan is ready.', 'Rollback plan is missing.', 'BLOCK'),
    boolCheck('ENVIRONMENT_REVIEW', input.environmentReviewed, 'Environment has been reviewed.', 'Environment review is incomplete.', 'REVIEW')
  ];
  const status = checks.some(check => check.status === 'BLOCK')
    ? 'BLOCK'
    : checks.some(check => check.status === 'REVIEW')
      ? 'REVIEW'
      : 'PASS';

  return {
    status,
    releaseAllowed: status === 'PASS',
    checks
  };
}

function boolCheck(
  code: string,
  passed: boolean,
  passDetail: string,
  failDetail: string,
  failStatus: ReleaseReadinessStatus
): ReleaseReadinessCheck {
  return { code, status: passed ? 'PASS' : failStatus, detail: passed ? passDetail : failDetail };
}

function statusCheck(code: string, status: ReleaseReadinessStatus, label: string): ReleaseReadinessCheck {
  return {
    code,
    status,
    detail: `${label} is ${status}.`
  };
}
