export type SignalReplayStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface SignalDecisionFactor {
  name: string;
  passed: boolean;
  weight: number;
}

export interface SignalReplayForensicsInput {
  signalId: string;
  symbol: string;
  generatedAt: string;
  dataQualityStatus: SignalReplayStatus;
  strategyVersionId: string;
  indicators: Record<string, number>;
  decisionFactors: SignalDecisionFactor[];
  aiRationale: string;
}

export interface SignalReplayIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface SignalReplayForensics {
  status: SignalReplayStatus;
  fingerprint: string;
  passedWeight: number;
  failedFactors: string[];
  issues: SignalReplayIssue[];
}

export function buildSignalReplayForensics(input: SignalReplayForensicsInput): SignalReplayForensics {
  const issues: SignalReplayIssue[] = [];

  if (!input.signalId.trim()) {
    issues.push({ code: 'SIGNAL_ID_MISSING', severity: 'ERROR', message: 'Signal id is required for replay.' });
  }
  if (!input.strategyVersionId.trim()) {
    issues.push({ code: 'STRATEGY_VERSION_MISSING', severity: 'ERROR', message: 'Strategy version id is required for replay.' });
  }
  if (!Number.isFinite(Date.parse(input.generatedAt))) {
    issues.push({ code: 'SIGNAL_TIMESTAMP_INVALID', severity: 'ERROR', message: 'Signal timestamp is invalid.' });
  }
  if (input.dataQualityStatus === 'BLOCK') {
    issues.push({ code: 'REPLAY_DATA_QUALITY_BLOCKED', severity: 'ERROR', message: 'Replay data quality is blocked.' });
  } else if (input.dataQualityStatus === 'REVIEW') {
    issues.push({ code: 'REPLAY_DATA_QUALITY_REVIEW', severity: 'WARNING', message: 'Replay data quality requires review.' });
  }
  if (Object.keys(input.indicators).length === 0) {
    issues.push({ code: 'INDICATOR_SNAPSHOT_MISSING', severity: 'ERROR', message: 'Indicator snapshot is missing.' });
  }
  if (input.decisionFactors.length === 0) {
    issues.push({ code: 'DECISION_FACTORS_MISSING', severity: 'ERROR', message: 'Decision factors are missing.' });
  }
  if (!input.aiRationale.trim()) {
    issues.push({ code: 'AI_RATIONALE_MISSING', severity: 'WARNING', message: 'AI rationale is missing.' });
  }

  const passedWeight = round(input.decisionFactors
    .filter(factor => factor.passed)
    .reduce((sum, factor) => sum + safeNumber(factor.weight), 0), 2);
  const failedFactors = input.decisionFactors.filter(factor => !factor.passed).map(factor => factor.name);

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    fingerprint: `replay-${input.signalId || 'missing'}-${hash(JSON.stringify({
      symbol: input.symbol,
      generatedAt: input.generatedAt,
      strategyVersionId: input.strategyVersionId,
      indicators: input.indicators,
      decisionFactors: input.decisionFactors
    }))}`,
    passedWeight,
    failedFactors,
    issues
  };
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

function hash(value: string): string {
  let hashValue = 0;
  for (let index = 0; index < value.length; index += 1) {
    hashValue = ((hashValue << 5) - hashValue + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hashValue).toString(36);
}
