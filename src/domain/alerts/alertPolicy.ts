export type GateStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface GateAlertInput {
  area: string;
  code: string;
  status: GateStatus;
  detail: string;
}

export interface ActionableAlert {
  area: string;
  code: string;
  severity: AlertSeverity;
  detail: string;
  actionRequired: boolean;
}

export function buildGateAlerts(gates: GateAlertInput[]): ActionableAlert[] {
  return gates
    .filter(gate => gate.status !== 'PASS')
    .map(gate => ({
      area: gate.area,
      code: gate.code,
      severity: (gate.status === 'BLOCK' ? 'CRITICAL' : 'WARNING') as AlertSeverity,
      detail: gate.detail,
      actionRequired: true
    }))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.code.localeCompare(b.code));
}

function severityRank(severity: AlertSeverity): number {
  if (severity === 'CRITICAL') return 3;
  if (severity === 'WARNING') return 2;
  return 1;
}
