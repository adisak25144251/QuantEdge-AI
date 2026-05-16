export type DeploymentObservabilityStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface DeploymentObservabilityInput {
  buildVersion: string;
  commitSha: string;
  structuredLogsEnabled: boolean;
  errorTrackingEnabled: boolean;
  uptimeMonitorEnabled: boolean;
  latencyP95Ms: number;
  failingEndpointCount: number;
  releaseChecklistCompleted: boolean;
}

export interface DeploymentCheck {
  code: string;
  status: DeploymentObservabilityStatus;
  detail: string;
}

export interface DeploymentObservabilityReport {
  status: DeploymentObservabilityStatus;
  checks: DeploymentCheck[];
  generatedAt: string;
}

export function evaluateDeploymentObservability(input: DeploymentObservabilityInput): DeploymentObservabilityReport {
  const checks: DeploymentCheck[] = [
    check('BUILD_VERSION', Boolean(input.buildVersion), 'Build version is present.', 'Build version is missing.', 'BLOCK'),
    check('COMMIT_SHA', Boolean(input.commitSha), 'Commit SHA is present.', 'Commit SHA is missing.', 'REVIEW'),
    check('STRUCTURED_LOGS', input.structuredLogsEnabled, 'Structured logs are enabled.', 'Structured logs are not enabled.', 'REVIEW'),
    check('ERROR_TRACKING', input.errorTrackingEnabled, 'Error tracking is enabled.', 'Error tracking is not enabled.', 'REVIEW'),
    check('UPTIME_MONITOR', input.uptimeMonitorEnabled, 'Uptime monitoring is enabled.', 'Uptime monitoring is not enabled.', 'REVIEW'),
    {
      code: 'LATENCY_P95',
      status: input.latencyP95Ms <= 1_000 ? 'PASS' : input.latencyP95Ms <= 1_500 ? 'REVIEW' : 'BLOCK',
      detail: `P95 latency is ${input.latencyP95Ms}ms.`
    },
    {
      code: 'ENDPOINT_FAILURES',
      status: input.failingEndpointCount === 0 ? 'PASS' : 'BLOCK',
      detail: `${input.failingEndpointCount} endpoints are failing.`
    },
    check('RELEASE_CHECKLIST', input.releaseChecklistCompleted, 'Release checklist is completed.', 'Release checklist is incomplete.', 'BLOCK')
  ];

  return {
    status: checks.some(item => item.status === 'BLOCK') ? 'BLOCK' : checks.some(item => item.status === 'REVIEW') ? 'REVIEW' : 'PASS',
    checks,
    generatedAt: new Date().toISOString()
  };
}

function check(
  code: string,
  passed: boolean,
  passDetail: string,
  failDetail: string,
  failStatus: DeploymentObservabilityStatus
): DeploymentCheck {
  return {
    code,
    status: passed ? 'PASS' : failStatus,
    detail: passed ? passDetail : failDetail
  };
}
