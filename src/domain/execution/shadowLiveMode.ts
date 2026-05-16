export type ShadowLiveStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface ShadowLiveObservation {
  id: string;
  theoreticalPnlUsd: number;
  executablePnlUsd: number;
  theoreticalEntry: number;
  executableEntry: number;
}

export interface ShadowLiveIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ShadowLiveInput {
  observations: ShadowLiveObservation[];
  maxPnlDivergencePercent?: number;
  maxEntryDivergenceBps?: number;
  minObservations?: number;
}

export interface ShadowLiveReport {
  status: ShadowLiveStatus;
  observations: number;
  averagePnlDivergencePercent: number;
  averageEntryDivergenceBps: number;
  theoreticalPnlUsd: number;
  executablePnlUsd: number;
  realOrdersPlaced: false;
  issues: ShadowLiveIssue[];
}

export function evaluateShadowLiveMode(input: ShadowLiveInput): ShadowLiveReport {
  const issues: ShadowLiveIssue[] = [];
  const minObservations = input.minObservations ?? 20;
  const maxPnlDivergencePercent = input.maxPnlDivergencePercent ?? 12;
  const maxEntryDivergenceBps = input.maxEntryDivergenceBps ?? 15;
  const observations = input.observations.length;
  const theoreticalPnlUsd = round(input.observations.reduce((sum, item) => sum + safeNumber(item.theoreticalPnlUsd), 0), 2);
  const executablePnlUsd = round(input.observations.reduce((sum, item) => sum + safeNumber(item.executablePnlUsd), 0), 2);
  const averagePnlDivergencePercent = observations > 0
    ? round(input.observations.reduce((sum, item) => sum + pnlDivergencePercent(item), 0) / observations, 2)
    : 0;
  const averageEntryDivergenceBps = observations > 0
    ? round(input.observations.reduce((sum, item) => sum + entryDivergenceBps(item), 0) / observations, 2)
    : 0;

  if (observations < minObservations) {
    issues.push({
      code: 'SHADOW_SAMPLE_TOO_SMALL',
      severity: 'ERROR',
      message: `Need at least ${minObservations} shadow observations.`
    });
  }

  if (averagePnlDivergencePercent > maxPnlDivergencePercent) {
    issues.push({
      code: 'SHADOW_PNL_DIVERGENCE_HIGH',
      severity: 'ERROR',
      message: `Shadow executable PnL diverges by more than ${maxPnlDivergencePercent}%.`
    });
  }

  if (averageEntryDivergenceBps > maxEntryDivergenceBps) {
    issues.push({
      code: 'SHADOW_ENTRY_DIVERGENCE_HIGH',
      severity: 'WARNING',
      message: `Shadow entries diverge by more than ${maxEntryDivergenceBps} bps.`
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    observations,
    averagePnlDivergencePercent,
    averageEntryDivergenceBps,
    theoreticalPnlUsd,
    executablePnlUsd,
    realOrdersPlaced: false,
    issues
  };
}

function pnlDivergencePercent(item: ShadowLiveObservation): number {
  const denominator = Math.max(Math.abs(safeNumber(item.theoreticalPnlUsd)), 1);
  return Math.abs(safeNumber(item.theoreticalPnlUsd) - safeNumber(item.executablePnlUsd)) / denominator * 100;
}

function entryDivergenceBps(item: ShadowLiveObservation): number {
  const denominator = Math.max(Math.abs(safeNumber(item.theoreticalEntry)), 1);
  return Math.abs(safeNumber(item.theoreticalEntry) - safeNumber(item.executableEntry)) / denominator * 10_000;
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
