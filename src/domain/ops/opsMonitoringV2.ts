export type OpsMonitoringStatusV2 = 'PASS' | 'REVIEW' | 'BLOCK';

export interface OpsMonitoringInputV2 {
  dataLatencyMs: number;
  endpointUptimePercent: number;
  apiQuotaUsedPercent: number;
  openSevIncidents: number;
  releaseChecklistStatus: OpsMonitoringStatusV2;
}

export interface OpsMonitoringReportV2 {
  status: OpsMonitoringStatusV2;
  opsReady: boolean;
  reliabilityScore: number;
  issues: string[];
}

export function evaluateOpsMonitoringV2(input: OpsMonitoringInputV2): OpsMonitoringReportV2 {
  const issues: string[] = [];
  if (input.dataLatencyMs > 5_000) issues.push('DATA_LATENCY_HIGH');
  if (input.endpointUptimePercent < 99.5) issues.push('UPTIME_BELOW_SLO');
  if (input.apiQuotaUsedPercent > 90) issues.push('API_QUOTA_NEAR_LIMIT');
  if (input.openSevIncidents > 0) issues.push('OPEN_SEV_INCIDENTS');
  if (input.releaseChecklistStatus !== 'PASS') issues.push(`RELEASE_${input.releaseChecklistStatus}`);

  const reliabilityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        input.endpointUptimePercent -
        Math.max(0, input.dataLatencyMs - 1_000) / 200 -
        Math.max(0, input.apiQuotaUsedPercent - 70) -
        input.openSevIncidents * 30
      )
    )
  );
  const blocking = issues.some((issue) =>
    issue === 'DATA_LATENCY_HIGH' ||
    issue === 'UPTIME_BELOW_SLO' ||
    issue === 'OPEN_SEV_INCIDENTS' ||
    issue === 'RELEASE_BLOCK'
  );

  return {
    status: blocking ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    opsReady: !blocking && issues.length === 0,
    reliabilityScore,
    issues
  };
}
