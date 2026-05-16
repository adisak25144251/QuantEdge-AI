export type PostTradeReviewStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface PostTradeReviewInput {
  plannedEntry: number;
  plannedStopLoss: number;
  plannedTakeProfit: number;
  actualEntry: number;
  actualExit: number;
  side: 'LONG' | 'SHORT';
  pnlUsd: number;
  riskUsd: number;
  followedPlan: boolean;
  exitReason: 'TP' | 'SL' | 'MANUAL' | 'TIME_EXIT';
}

export interface PostTradeReviewIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface PostTradeReview {
  status: PostTradeReviewStatus;
  rMultiple: number;
  entrySlippagePercent: number;
  planAdherenceScore: number;
  lessons: string[];
  issues: PostTradeReviewIssue[];
}

export function buildPostTradeReview(input: PostTradeReviewInput): PostTradeReview {
  const issues: PostTradeReviewIssue[] = [];
  const rMultiple = input.riskUsd > 0 ? round(input.pnlUsd / input.riskUsd, 2) : 0;
  const entrySlippagePercent = percent(Math.abs(input.actualEntry - input.plannedEntry), input.plannedEntry);

  if (!input.followedPlan) {
    issues.push({ code: 'PLAN_NOT_FOLLOWED', severity: 'WARNING', message: 'Trade execution deviated from the reviewed plan.' });
  }
  if (entrySlippagePercent > 1) {
    issues.push({ code: 'ENTRY_SLIPPAGE_HIGH', severity: 'WARNING', message: 'Actual entry deviated materially from planned entry.' });
  }
  if (input.riskUsd <= 0) {
    issues.push({ code: 'RISK_NOT_DEFINED', severity: 'ERROR', message: 'Trade risk was not defined.' });
  }
  if (rMultiple <= -1.5) {
    issues.push({ code: 'LOSS_EXCEEDED_PLANNED_RISK', severity: 'ERROR', message: 'Loss exceeded planned risk.' });
  }

  const lessons = [
    input.followedPlan ? 'Plan followed: execution discipline was preserved.' : 'Plan deviation: review entry and exit discipline.',
    input.exitReason === 'TP' ? 'Target achieved: document what confirmed the move.' : `Exit reason: ${input.exitReason}.`,
    rMultiple > 0 ? `Positive outcome of ${rMultiple}R.` : `Outcome was ${rMultiple}R; review avoidable risk.`
  ];

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    rMultiple,
    entrySlippagePercent,
    planAdherenceScore: input.followedPlan ? Math.max(0, 100 - entrySlippagePercent * 10) : Math.max(0, 55 - entrySlippagePercent * 10),
    lessons,
    issues
  };
}

function percent(value: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator <= 0) return 100;
  return round((value / denominator) * 100, 2);
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
