export type ExplanationStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type ExplanationArea = 'TECHNICAL' | 'REGIME' | 'VOLATILITY' | 'RISK' | 'DATA';

export interface SignalExplanationInput {
  technicalScore: number;
  regimeAligned: boolean;
  volatilityState: 'LOW' | 'NORMAL' | 'ELEVATED' | 'SHOCK';
  riskReward: number;
  dataQualityStatus: ExplanationStatus;
  confidenceScore: number;
  confirmations: string[];
  missingConfirmations: string[];
}

export interface ExplanationBucket {
  area: ExplanationArea;
  score: number;
  status: ExplanationStatus;
  rationale: string;
}

export interface ExplanationIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface SignalExplanationReport {
  status: ExplanationStatus;
  summaryScore: number;
  buckets: ExplanationBucket[];
  issues: ExplanationIssue[];
}

export function buildSignalExplanation(input: SignalExplanationInput): SignalExplanationReport {
  const technicalScore = safeNumber(input.technicalScore);
  const riskReward = safeNumber(input.riskReward);
  const confidenceScore = safeNumber(input.confidenceScore);
  const buckets: ExplanationBucket[] = [
    bucket('TECHNICAL', technicalScore, `Confirmed by ${input.confirmations.length} technical conditions.`),
    bucket('REGIME', input.regimeAligned ? 85 : 35, input.regimeAligned ? 'Strategy is aligned with current regime.' : 'Strategy is not aligned with current regime.'),
    bucket('VOLATILITY', volatilityScore(input.volatilityState), `Volatility state is ${input.volatilityState}.`),
    bucket('RISK', riskReward >= 1.5 ? Math.min(100, riskReward * 30) : riskReward * 35, `Risk/reward is ${riskReward.toFixed(2)}R.`),
    bucket('DATA', input.dataQualityStatus === 'PASS' ? 90 : input.dataQualityStatus === 'REVIEW' ? 55 : 10, `Data quality status is ${input.dataQualityStatus}.`)
  ];
  const issues = collectIssues({ ...input, technicalScore, riskReward, confidenceScore });
  const summaryScore = round((buckets.reduce((sum, item) => sum + item.score, 0) / buckets.length) * 0.75 + clamp(confidenceScore, 0, 100) * 0.25, 1);

  return {
    status: issues.some(issue => issue.severity === 'ERROR')
      ? 'BLOCK'
      : issues.length > 0 || summaryScore < 70
        ? 'REVIEW'
        : 'PASS',
    summaryScore,
    buckets,
    issues
  };
}

function collectIssues(input: SignalExplanationInput): ExplanationIssue[] {
  const issues: ExplanationIssue[] = [];
  if (input.dataQualityStatus === 'BLOCK') {
    issues.push({ code: 'DATA_QUALITY_BLOCKED', severity: 'ERROR', message: 'Signal explanation cannot pass with blocked market data.' });
  }
  if (input.riskReward < 1.5) {
    issues.push({ code: 'RISK_REWARD_TOO_LOW', severity: 'ERROR', message: 'Risk/reward is below the execution threshold.' });
  }
  if (!input.regimeAligned) {
    issues.push({ code: 'REGIME_NOT_ALIGNED', severity: 'WARNING', message: 'Signal is not aligned with the current market regime.' });
  }
  if (input.volatilityState === 'SHOCK') {
    issues.push({ code: 'VOLATILITY_SHOCK', severity: 'WARNING', message: 'Volatility shock requires extra confirmation.' });
  }
  if (input.missingConfirmations.length > input.confirmations.length) {
    issues.push({ code: 'CONFIRMATION_DEFICIT', severity: 'WARNING', message: 'Missing confirmations exceed confirmed evidence.' });
  }
  return issues;
}

function bucket(area: ExplanationArea, rawScore: number, rationale: string): ExplanationBucket {
  const score = round(clamp(safeNumber(rawScore), 0, 100), 1);
  return {
    area,
    score,
    status: score >= 70 ? 'PASS' : score >= 45 ? 'REVIEW' : 'BLOCK',
    rationale
  };
}

function volatilityScore(state: SignalExplanationInput['volatilityState']): number {
  if (state === 'NORMAL') return 88;
  if (state === 'LOW') return 72;
  if (state === 'ELEVATED') return 62;
  return 25;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
