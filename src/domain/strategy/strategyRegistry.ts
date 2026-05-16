import type { MarketRegime } from '../backtest/backtestEvidence';
import type { StrategyStage } from './strategyPromotion';

export type StrategyRegistryStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface StrategyRegistryIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface StrategyRegistryInput {
  id: string;
  name: string;
  owner: string;
  stage: StrategyStage;
  allowedRegimes: MarketRegime[];
  promotionStatus: StrategyRegistryStatus;
  driftStatus: StrategyRegistryStatus;
  evidenceStatus: StrategyRegistryStatus;
  backtestTrades: number;
  forwardSignals: number;
  lastReviewedAt: string | null;
  now?: number;
  minBacktestTrades?: number;
  minForwardSignals?: number;
  maxReviewAgeDays?: number;
}

export interface StrategyRegistryEntry extends StrategyRegistryInput {
  status: StrategyRegistryStatus;
  liveEligible: boolean;
  reviewAgeDays: number | null;
  issues: StrategyRegistryIssue[];
}

export interface StrategyRegistrySummary {
  status: StrategyRegistryStatus;
  totalStrategies: number;
  liveEligibleStrategies: number;
  blockedStrategies: number;
  entries: StrategyRegistryEntry[];
  blockingCodes: string[];
}

export function evaluateStrategyRegistryEntry(input: StrategyRegistryInput): StrategyRegistryEntry {
  const issues: StrategyRegistryIssue[] = [];
  const minBacktestTrades = input.minBacktestTrades ?? 100;
  const minForwardSignals = input.minForwardSignals ?? 50;
  const maxReviewAgeDays = input.maxReviewAgeDays ?? 30;
  const reviewAgeDays = computeReviewAgeDays(input.lastReviewedAt, input.now ?? Date.now());

  if (!input.owner.trim()) {
    issues.push({
      code: 'STRATEGY_OWNER_MISSING',
      severity: 'ERROR',
      message: 'Strategy must have a named owner before live eligibility.'
    });
  }

  if (input.allowedRegimes.length === 0) {
    issues.push({
      code: 'ALLOWED_REGIMES_MISSING',
      severity: 'ERROR',
      message: 'Strategy must declare allowed market regimes.'
    });
  }

  if (input.promotionStatus === 'BLOCK') {
    issues.push({
      code: 'PROMOTION_GATE_BLOCKED',
      severity: 'ERROR',
      message: 'Strategy promotion gate is blocked.'
    });
  } else if (input.promotionStatus === 'REVIEW') {
    issues.push({
      code: 'PROMOTION_GATE_IN_REVIEW',
      severity: 'WARNING',
      message: 'Strategy promotion gate still needs review.'
    });
  }

  if (input.driftStatus === 'BLOCK') {
    issues.push({
      code: 'MODEL_DRIFT_BLOCKED',
      severity: 'ERROR',
      message: 'Forward performance drift blocks live eligibility.'
    });
  } else if (input.driftStatus === 'REVIEW') {
    issues.push({
      code: 'MODEL_DRIFT_IN_REVIEW',
      severity: 'WARNING',
      message: 'Forward performance drift requires review.'
    });
  }

  if (input.evidenceStatus === 'BLOCK') {
    issues.push({
      code: 'EVIDENCE_GATE_BLOCKED',
      severity: 'ERROR',
      message: 'Evidence ledger blocks this strategy.'
    });
  } else if (input.evidenceStatus === 'REVIEW') {
    issues.push({
      code: 'EVIDENCE_GATE_IN_REVIEW',
      severity: 'WARNING',
      message: 'Evidence ledger requires review.'
    });
  }

  if (input.backtestTrades < minBacktestTrades) {
    issues.push({
      code: 'BACKTEST_SAMPLE_TOO_SMALL',
      severity: 'ERROR',
      message: `Need at least ${minBacktestTrades} backtest trades.`
    });
  }

  if (input.stage !== 'RESEARCH' && input.forwardSignals < minForwardSignals) {
    issues.push({
      code: 'FORWARD_SAMPLE_TOO_SMALL',
      severity: 'WARNING',
      message: `Need at least ${minForwardSignals} forward signals for mature stages.`
    });
  }

  if (reviewAgeDays === null || reviewAgeDays > maxReviewAgeDays) {
    issues.push({
      code: 'STRATEGY_REVIEW_STALE',
      severity: 'ERROR',
      message: `Strategy review must be fresher than ${maxReviewAgeDays} days.`
    });
  }

  const status = issues.some(issue => issue.severity === 'ERROR')
    ? 'BLOCK'
    : issues.length > 0
      ? 'REVIEW'
      : 'PASS';

  return {
    ...input,
    status,
    liveEligible: status === 'PASS' && (input.stage === 'SMALL_LIVE_READY' || input.stage === 'LIVE_ELIGIBLE'),
    reviewAgeDays,
    issues
  };
}

export function summarizeStrategyRegistry(inputs: StrategyRegistryInput[]): StrategyRegistrySummary {
  const entries = inputs.map(evaluateStrategyRegistryEntry);
  const blockingCodes = Array.from(new Set(entries.flatMap(entry =>
    entry.issues.filter(issue => issue.severity === 'ERROR').map(issue => issue.code)
  )));
  const status = entries.some(entry => entry.status === 'BLOCK')
    ? 'BLOCK'
    : entries.some(entry => entry.status === 'REVIEW')
      ? 'REVIEW'
      : 'PASS';

  return {
    status,
    totalStrategies: entries.length,
    liveEligibleStrategies: entries.filter(entry => entry.liveEligible).length,
    blockedStrategies: entries.filter(entry => entry.status === 'BLOCK').length,
    entries,
    blockingCodes
  };
}

function computeReviewAgeDays(lastReviewedAt: string | null, now: number): number | null {
  if (!lastReviewedAt) return null;
  const reviewedAt = Date.parse(lastReviewedAt);
  if (!Number.isFinite(reviewedAt)) return null;
  return round(Math.max(0, now - reviewedAt) / 86_400_000, 2);
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
