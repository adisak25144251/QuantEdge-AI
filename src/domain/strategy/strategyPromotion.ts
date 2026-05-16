import type { LiveReadinessStatus } from '../live/liveReadiness';
import type { StrategyLabStatus } from './strategyLab';

export type StrategyStage = 'RESEARCH' | 'PAPER' | 'SMALL_LIVE_READY' | 'LIVE_ELIGIBLE';
export type PromotionStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface StrategyPromotionInput {
  currentStage: StrategyStage;
  labStatus: StrategyLabStatus;
  backtestStatus: 'PASS' | 'REVIEW' | 'BLOCK';
  paperStatus: 'PASS' | 'REVIEW' | 'BLOCK';
  liveReadinessStatus: LiveReadinessStatus;
  auditDecisionCount: number;
  minAuditDecisionCount?: number;
}

export interface StrategyPromotionIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface StrategyPromotionResult {
  status: PromotionStatus;
  currentStage: StrategyStage;
  nextStage: StrategyStage;
  issues: StrategyPromotionIssue[];
}

export function evaluateStrategyPromotion(input: StrategyPromotionInput): StrategyPromotionResult {
  const minAuditDecisionCount = input.minAuditDecisionCount ?? 20;
  const issues = collectPromotionIssues(input, minAuditDecisionCount);
  const status = issues.some(issue => issue.severity === 'ERROR')
    ? 'BLOCK'
    : issues.length > 0
      ? 'REVIEW'
      : 'PASS';

  return {
    status,
    currentStage: input.currentStage,
    nextStage: status === 'PASS' ? nextStage(input.currentStage) : input.currentStage,
    issues
  };
}

function collectPromotionIssues(input: StrategyPromotionInput, minAuditDecisionCount: number): StrategyPromotionIssue[] {
  const issues: StrategyPromotionIssue[] = [];

  if (input.labStatus === 'BLOCK') {
    issues.push({ code: 'LAB_EVIDENCE_BLOCKED', severity: 'ERROR', message: 'Strategy lab evidence is blocked.' });
  }
  if (input.backtestStatus === 'BLOCK') {
    issues.push({ code: 'BACKTEST_EVIDENCE_BLOCKED', severity: 'ERROR', message: 'Backtest evidence is blocked.' });
  }
  if (input.labStatus === 'REVIEW' || input.backtestStatus === 'REVIEW') {
    issues.push({ code: 'RESEARCH_EVIDENCE_IN_REVIEW', severity: 'WARNING', message: 'Research evidence still needs review.' });
  }

  if (input.currentStage !== 'RESEARCH' && input.paperStatus === 'BLOCK') {
    issues.push({ code: 'PAPER_EVIDENCE_BLOCKED', severity: 'ERROR', message: 'Paper evidence is blocked.' });
  }
  if (input.currentStage !== 'RESEARCH' && input.paperStatus === 'REVIEW') {
    issues.push({ code: 'PAPER_EVIDENCE_IN_REVIEW', severity: 'WARNING', message: 'Paper evidence still needs review.' });
  }

  if (input.currentStage === 'SMALL_LIVE_READY') {
    if (input.liveReadinessStatus !== 'READY_FOR_SMALL_LIVE') {
      issues.push({ code: 'LIVE_READINESS_NOT_APPROVED', severity: 'ERROR', message: 'Live readiness gate has not approved small manual live.' });
    }
    if (input.auditDecisionCount < minAuditDecisionCount) {
      issues.push({ code: 'AUDIT_SAMPLE_TOO_SMALL', severity: 'ERROR', message: `Need at least ${minAuditDecisionCount} audited decisions.` });
    }
  }

  return issues;
}

function nextStage(stage: StrategyStage): StrategyStage {
  if (stage === 'RESEARCH') return 'PAPER';
  if (stage === 'PAPER') return 'SMALL_LIVE_READY';
  if (stage === 'SMALL_LIVE_READY') return 'LIVE_ELIGIBLE';
  return 'LIVE_ELIGIBLE';
}
