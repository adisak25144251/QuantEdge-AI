import type { ExecutionMode, GateStatus, LiveReadinessStatus } from './liveReadiness';

export type LiveLaunchStatus = 'LOCKED' | 'PAPER_ONLY' | 'SMALL_MANUAL_LIVE_READY';

export interface LiveLaunchGate {
  code: string;
  status: GateStatus;
  label: string;
  detail: string;
}

export interface LiveLaunchChecklistInput {
  liveReadinessStatus: LiveReadinessStatus;
  executionMode: ExecutionMode;
  apiTradingEnabled: boolean;
  aiBackendConfigured: boolean;
  emergencyStopEnabled: boolean;
  auditDecisionCount: number;
  latestBuildVerified: boolean;
}

export interface LiveLaunchChecklistResult {
  status: LiveLaunchStatus;
  label: string;
  summary: string;
  gates: LiveLaunchGate[];
}

const MIN_AUDIT_DECISIONS = 10;

export function evaluateLiveLaunchChecklist(input: LiveLaunchChecklistInput): LiveLaunchChecklistResult {
  const gates: LiveLaunchGate[] = [
    evaluateReadinessGate(input.liveReadinessStatus),
    evaluateApiTradingGate(input.apiTradingEnabled, input.executionMode),
    input.aiBackendConfigured
      ? gate('AI_BACKEND_CONFIGURED', 'PASS', 'AI backend', 'Server-side AI backend is configured.')
      : gate('AI_BACKEND_OPTIONAL_REVIEW', 'REVIEW', 'AI backend', 'AI backend is not configured; live launch can continue only without AI-dependent guidance.'),
    input.emergencyStopEnabled
      ? gate('EMERGENCY_STOP_READY', 'PASS', 'Emergency stop', 'Manual emergency stop policy is enabled.')
      : gate('EMERGENCY_STOP_MISSING', 'BLOCK', 'Emergency stop', 'Emergency stop policy must exist before live escalation.'),
    input.auditDecisionCount >= MIN_AUDIT_DECISIONS
      ? gate('AUDIT_TRAIL_READY', 'PASS', 'Audit trail', `${input.auditDecisionCount} execution decisions are available for review.`)
      : gate('AUDIT_TRAIL_TOO_SMALL', 'REVIEW', 'Audit trail', `Need at least ${MIN_AUDIT_DECISIONS} recorded execution decisions before live escalation.`),
    input.latestBuildVerified
      ? gate('BUILD_VERIFIED', 'PASS', 'Build verification', 'Latest test, lint, build, and smoke checks were verified.')
      : gate('BUILD_NOT_VERIFIED', 'BLOCK', 'Build verification', 'Latest build verification is missing.')
  ];

  const hasBlock = gates.some(item => item.status === 'BLOCK');
  const status: LiveLaunchStatus = hasBlock
    ? 'LOCKED'
    : input.liveReadinessStatus === 'PAPER_ONLY'
      ? 'PAPER_ONLY'
      : 'SMALL_MANUAL_LIVE_READY';

  return {
    status,
    label: statusToLabel(status),
    summary: statusToSummary(status),
    gates
  };
}

function evaluateReadinessGate(status: LiveReadinessStatus): LiveLaunchGate {
  if (status === 'NOT_READY') {
    return gate('LIVE_READINESS_BLOCKED', 'BLOCK', 'Live readiness', 'Live readiness still has hard blockers.');
  }

  if (status === 'PAPER_ONLY') {
    return gate('PAPER_ONLY_MODE', 'REVIEW', 'Live readiness', 'Evidence supports paper mode only.');
  }

  return gate('LIVE_READINESS_READY', 'PASS', 'Live readiness', 'Readiness gates support small manual live sizing.');
}

function evaluateApiTradingGate(apiTradingEnabled: boolean, executionMode: ExecutionMode): LiveLaunchGate {
  if (apiTradingEnabled || executionMode === 'API_CONNECTED') {
    return gate('API_TRADING_ENABLED', 'BLOCK', 'Execution lock', 'API trading must remain disabled until a separate audited execution phase.');
  }

  if (executionMode !== 'MANUAL_ONLY') {
    return gate('MANUAL_EXECUTION_NOT_ACTIVE', 'BLOCK', 'Execution lock', 'Manual-only execution mode must be active.');
  }

  return gate('MANUAL_ONLY_LOCK', 'PASS', 'Execution lock', 'Manual-only execution lock is active.');
}

function gate(code: string, status: GateStatus, label: string, detail: string): LiveLaunchGate {
  return { code, status, label, detail };
}

function statusToLabel(status: LiveLaunchStatus): string {
  switch (status) {
    case 'SMALL_MANUAL_LIVE_READY':
      return 'Small manual live ready';
    case 'PAPER_ONLY':
      return 'Paper only';
    default:
      return 'Locked';
  }
}

function statusToSummary(status: LiveLaunchStatus): string {
  switch (status) {
    case 'SMALL_MANUAL_LIVE_READY':
      return 'Launch locks allow only small, manual live execution. API trading remains disabled.';
    case 'PAPER_ONLY':
      return 'System may continue paper trading, but evidence is not sufficient for live escalation.';
    default:
      return 'Live launch is locked by one or more hard gates.';
  }
}
