export type ForwardShadowEvidenceStatusV2 = 'PASS' | 'REVIEW' | 'BLOCK';

export interface ForwardShadowEvidenceInputV2 {
  forwardSignals: number;
  forwardExpectancyR: number;
  shadowObservations: number;
  executablePnlDriftPercent: number;
  missedFillRatePercent: number;
  scoreDecayPercent: number;
}

export interface ForwardShadowEvidenceReportV2 {
  status: ForwardShadowEvidenceStatusV2;
  shadowReady: boolean;
  executionEvidenceScore: number;
  issues: string[];
}

export function evaluateForwardShadowEvidenceV2(input: ForwardShadowEvidenceInputV2): ForwardShadowEvidenceReportV2 {
  const issues: string[] = [];
  const forwardSignals = safeNumber(input.forwardSignals);
  const forwardExpectancyR = safeNumber(input.forwardExpectancyR);
  const shadowObservations = safeNumber(input.shadowObservations);
  const executablePnlDriftPercent = safeNumber(input.executablePnlDriftPercent);
  const missedFillRatePercent = safeNumber(input.missedFillRatePercent);
  const scoreDecayPercent = safeNumber(input.scoreDecayPercent);

  if (forwardSignals < 50) issues.push('FORWARD_SAMPLE_TOO_SMALL');
  if (forwardExpectancyR <= 0.05) issues.push('FORWARD_EXPECTANCY_TOO_LOW');
  if (shadowObservations < 30) issues.push('SHADOW_SAMPLE_TOO_SMALL');
  if (executablePnlDriftPercent > 8) issues.push('EXECUTABLE_PNL_DRIFT_HIGH');
  if (missedFillRatePercent > 8) issues.push('MISSED_FILL_RATE_HIGH');
  if (scoreDecayPercent > 20) issues.push('SIGNAL_SCORE_DECAY_HIGH');

  const executionEvidenceScore = Math.max(
    0,
    Math.min(100, Math.round(100 - executablePnlDriftPercent * 3 - missedFillRatePercent * 3 - scoreDecayPercent))
  );
  const blocking = issues.some((issue) =>
    issue === 'FORWARD_SAMPLE_TOO_SMALL' ||
    issue === 'SHADOW_SAMPLE_TOO_SMALL' ||
    issue === 'EXECUTABLE_PNL_DRIFT_HIGH'
  );

  return {
    status: blocking ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    shadowReady: !blocking && issues.length === 0,
    executionEvidenceScore,
    issues
  };
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
