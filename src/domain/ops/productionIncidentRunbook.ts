export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3';
export type IncidentStatus = 'OPEN' | 'MITIGATED' | 'RESOLVED';
export type IncidentRunbookStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface ProductionIncident {
  id: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  owner: string;
  openedAt: string;
  resolvedAt: string | null;
  rollbackPlan: string;
  customerImpact: boolean;
}

export interface ProductionIncidentRunbookInput {
  incidents: ProductionIncident[];
  now?: number;
  maxOpenSev2?: number;
  maxResolutionMinutes?: number;
}

export interface IncidentRunbookIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ProductionIncidentRunbook {
  status: IncidentRunbookStatus;
  openIncidents: number;
  severeOpenIncidents: number;
  meanResolutionMinutes: number;
  issues: IncidentRunbookIssue[];
}

export function buildProductionIncidentRunbook(input: ProductionIncidentRunbookInput): ProductionIncidentRunbook {
  const issues: IncidentRunbookIssue[] = [];
  const now = input.now ?? Date.now();
  const maxOpenSev2 = input.maxOpenSev2 ?? 0;
  const maxResolutionMinutes = input.maxResolutionMinutes ?? 90;
  const openIncidents = input.incidents.filter(incident => incident.status !== 'RESOLVED');
  const severeOpenIncidents = openIncidents.filter(incident => incident.severity === 'SEV1' || incident.severity === 'SEV2');
  const resolvedDurations = input.incidents
    .filter(incident => incident.resolvedAt)
    .map(incident => durationMinutes(incident.openedAt, incident.resolvedAt ?? incident.openedAt));
  const meanResolutionMinutes = resolvedDurations.length > 0
    ? round(resolvedDurations.reduce((sum, value) => sum + value, 0) / resolvedDurations.length, 2)
    : 0;

  if (severeOpenIncidents.length > maxOpenSev2) {
    issues.push({ code: 'SEVERE_INCIDENT_OPEN', severity: 'ERROR', message: 'A SEV1/SEV2 incident is still open.' });
  }

  for (const incident of input.incidents) {
    if (!incident.owner.trim()) {
      issues.push({ code: 'INCIDENT_OWNER_MISSING', severity: 'ERROR', message: `Incident ${incident.id} has no owner.` });
    }
    if (!incident.rollbackPlan.trim()) {
      issues.push({ code: 'ROLLBACK_PLAN_MISSING', severity: 'ERROR', message: `Incident ${incident.id} has no rollback plan.` });
    }
    if (incident.status !== 'RESOLVED') {
      const ageMinutes = durationMinutes(incident.openedAt, new Date(now).toISOString());
      if (ageMinutes > maxResolutionMinutes) {
        issues.push({ code: 'INCIDENT_SLA_EXCEEDED', severity: 'ERROR', message: `Incident ${incident.id} exceeds response SLA.` });
      }
    }
    if (incident.customerImpact && incident.status !== 'RESOLVED') {
      issues.push({ code: 'CUSTOMER_IMPACT_OPEN', severity: 'WARNING', message: `Incident ${incident.id} has open customer impact.` });
    }
  }

  if (meanResolutionMinutes > maxResolutionMinutes) {
    issues.push({ code: 'MEAN_RESOLUTION_SLA_EXCEEDED', severity: 'WARNING', message: 'Mean incident resolution exceeds SLA.' });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    openIncidents: openIncidents.length,
    severeOpenIncidents: severeOpenIncidents.length,
    meanResolutionMinutes,
    issues
  };
}

function durationMinutes(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, (endMs - startMs) / 60_000);
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
