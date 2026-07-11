export type SetupSide = 'LONG' | 'SHORT';
export type SetupStatus = 'ACTIONABLE' | 'WAIT' | 'INVALIDATED' | 'AVOID' | string;
export type AlertPriority = 'INFORMATIONAL' | 'INTERESTING' | 'ACTIONABLE' | 'INVALIDATED';

export interface SetupIdentityInput {
  symbol: string;
  timeframe: string;
  side: SetupSide;
  entry: number;
  sl: number;
  tp: number;
}

export interface SetupCacheKeyInput {
  symbol: string;
  timeframe: string;
  assetType: string;
}

export interface ExecutionCandidateInput extends Omit<SetupIdentityInput, 'symbol' | 'timeframe'> {
  currentStatus: SetupStatus;
  rr: number | string;
  userConfirmedRisk: boolean;
}

export interface ReadinessView {
  priority: AlertPriority;
  label: string;
  actionText: string;
  canShowExecutionControls: boolean;
}

export interface SetupAlertInput extends SetupIdentityInput {
  currentStatus: SetupStatus;
  statusReason: string;
  rr: number | string;
  confidenceScore?: number;
  conditionsSatisfied?: string[];
  pendingConditions?: string[];
  timestamp?: string;
}

export interface SetupAlertSnapshot {
  id: string;
  symbol: string;
  timeframe: string;
  setupType: string;
  side: SetupSide;
  priority: AlertPriority;
  title: string;
  message: string;
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  confidence: number;
  qualityScore: number;
  conditionsSatisfied: string[];
  pendingConditions: string[];
  invalidationRule: string;
  timestamp: string;
  actionableFlag: boolean;
  riskFilterReason: string | null;
  chartSnapshotUrl: string | null;
}

const normalizeNumber = (value: number): string => {
  if (!Number.isFinite(value)) return 'invalid';
  return Number(value.toFixed(6)).toString();
};

const parseRatio = (rr: number | string): number => {
  if (typeof rr === 'number') return rr;
  const match = rr.match(/([0-9]+(?:\.[0-9]+)?)/g);
  if (!match || match.length === 0) return 0;
  return Number(match[match.length - 1]);
};

export const buildSetupIdentity = (input: SetupIdentityInput): string => {
  return [
    input.symbol.toUpperCase(),
    input.timeframe,
    input.side,
    normalizeNumber(input.entry),
    normalizeNumber(input.sl),
    normalizeNumber(input.tp),
  ].join('-');
};

export const buildSetupCacheKey = (input: SetupCacheKeyInput): string => {
  return [
    input.symbol.trim().toUpperCase(),
    input.timeframe.trim(),
    input.assetType.trim().toUpperCase()
  ].join('|');
};

export const isSetupCacheKeyForSymbol = (key: string, symbol: string): boolean => {
  return key.startsWith(`${symbol.trim().toUpperCase()}|`);
};

export const hasValidRiskGeometry = (side: SetupSide, entry: number, sl: number, tp: number): boolean => {
  if (![entry, sl, tp].every(Number.isFinite)) return false;
  if (entry <= 0 || sl <= 0 || tp <= 0) return false;
  return side === 'LONG'
    ? sl < entry && tp > entry
    : sl > entry && tp < entry;
};

export const canExecuteCandidate = (input: ExecutionCandidateInput): boolean => {
  return input.currentStatus === 'ACTIONABLE'
    && input.userConfirmedRisk
    && parseRatio(input.rr) >= 1.5
    && hasValidRiskGeometry(input.side, input.entry, input.sl, input.tp);
};

export const toProfessionalReadiness = (status: SetupStatus): ReadinessView => {
  switch (status) {
    case 'ACTIONABLE':
      return {
        priority: 'ACTIONABLE',
        label: 'Setup candidate passed review gates',
        actionText: 'Review risk before execution',
        canShowExecutionControls: true,
      };
    case 'INVALIDATED':
      return {
        priority: 'INVALIDATED',
        label: 'Candidate invalidated',
        actionText: 'Do not trade this setup',
        canShowExecutionControls: false,
      };
    case 'AVOID':
      return {
        priority: 'INFORMATIONAL',
        label: 'Market conditions are unfavorable',
        actionText: 'Avoid new exposure',
        canShowExecutionControls: false,
      };
    default:
      return {
        priority: 'INTERESTING',
        label: 'Candidate still needs confirmation',
        actionText: 'Wait for confirmation',
        canShowExecutionControls: false,
      };
  }
};

export const setupDetailsToAlert = (input: SetupAlertInput): SetupAlertSnapshot => {
  const readiness = toProfessionalReadiness(input.currentStatus);
  const rr = parseRatio(input.rr);
  const actionableFlag = readiness.priority === 'ACTIONABLE'
    && hasValidRiskGeometry(input.side, input.entry, input.sl, input.tp)
    && rr >= 1.5;

  return {
    id: buildSetupIdentity(input),
    symbol: input.symbol.toUpperCase(),
    timeframe: input.timeframe,
    setupType: input.side === 'LONG' ? 'Long setup candidate' : 'Short setup candidate',
    side: input.side,
    priority: readiness.priority,
    title: readiness.label,
    message: input.statusReason || readiness.actionText,
    entry: input.entry,
    sl: input.sl,
    tp: input.tp,
    rr,
    confidence: Math.max(0, Math.min(100, Math.round(input.confidenceScore ?? 0))),
    qualityScore: Math.max(0, Math.min(100, Math.round(input.confidenceScore ?? 0))),
    conditionsSatisfied: input.conditionsSatisfied ?? [],
    pendingConditions: input.pendingConditions ?? [],
    invalidationRule: input.side === 'LONG'
      ? `Close below ${normalizeNumber(input.sl)} invalidates this candidate`
      : `Close above ${normalizeNumber(input.sl)} invalidates this candidate`,
    timestamp: input.timestamp ?? new Date().toISOString(),
    actionableFlag,
    riskFilterReason: actionableFlag ? null : readiness.actionText,
    chartSnapshotUrl: null,
  };
};
