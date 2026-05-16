export type StrategyLabStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface StrategyCandidateInput {
  id: string;
  name: string;
  sampleSize: number;
  outOfSampleExpectancyR: number;
  maxDrawdownPercent: number;
  walkForwardPositiveRate: number;
  coveredRegimes: number;
  paperExpectancyR?: number;
}

export interface StrategyLabIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface RankedStrategyCandidate extends StrategyCandidateInput {
  score: number;
  status: StrategyLabStatus;
  issues: StrategyLabIssue[];
}

export interface AntiOverfitInput {
  inSampleExpectancyR: number;
  outOfSampleExpectancyR: number;
  sampleSize: number;
  walkForwardPositiveRate: number;
  coveredRegimes: number;
}

export interface AntiOverfitReport {
  status: StrategyLabStatus;
  score: number;
  issues: StrategyLabIssue[];
}

export interface StrategyComparison {
  candidates: RankedStrategyCandidate[];
  best: RankedStrategyCandidate | null;
  passCount: number;
  blockedCandidateIds: string[];
}

export function rankStrategyCandidates(candidates: StrategyCandidateInput[]): RankedStrategyCandidate[] {
  return candidates
    .map(candidate => {
      const issues = evaluateCandidateIssues(candidate);
      const score = computeCandidateScore(candidate, issues);
      return {
        ...candidate,
        score,
        status: toStatus(issues),
        issues
      };
    })
    .sort((a, b) => b.score - a.score || a.maxDrawdownPercent - b.maxDrawdownPercent);
}

export function computeAntiOverfitScore(input: AntiOverfitInput): AntiOverfitReport {
  const issues: StrategyLabIssue[] = [];
  const divergence = input.inSampleExpectancyR - input.outOfSampleExpectancyR;

  if (input.sampleSize < 100) {
    issues.push({
      code: 'SAMPLE_TOO_SMALL',
      severity: 'ERROR',
      message: 'Strategy needs at least 100 trades before live consideration.'
    });
  }

  if (divergence > 0.35 || input.outOfSampleExpectancyR <= 0) {
    issues.push({
      code: 'IN_SAMPLE_DIVERGENCE',
      severity: 'ERROR',
      message: 'In-sample edge does not transfer cleanly to out-of-sample evidence.'
    });
  }

  if (input.walkForwardPositiveRate < 70) {
    issues.push({
      code: 'WEAK_WALK_FORWARD_STABILITY',
      severity: 'ERROR',
      message: 'Walk-forward positive window rate is below institutional robustness threshold.'
    });
  }

  if (input.coveredRegimes < 3) {
    issues.push({
      code: 'LOW_REGIME_COVERAGE',
      severity: 'WARNING',
      message: 'Strategy should be tested across at least three market regimes.'
    });
  }

  const score = clamp(
    100
      - Math.max(0, divergence) * 80
      - Math.max(0, 100 - input.sampleSize) * 0.35
      - Math.max(0, 70 - input.walkForwardPositiveRate) * 0.8
      - Math.max(0, 3 - input.coveredRegimes) * 8,
    0,
    100
  );

  return {
    status: toStatus(issues),
    score: round(score, 1),
    issues
  };
}

export function compareStrategies(candidates: StrategyCandidateInput[]): StrategyComparison {
  const ranked = rankStrategyCandidates(candidates);
  return {
    candidates: ranked,
    best: ranked[0] ?? null,
    passCount: ranked.filter(candidate => candidate.status === 'PASS').length,
    blockedCandidateIds: ranked.filter(candidate => candidate.status === 'BLOCK').map(candidate => candidate.id)
  };
}

function evaluateCandidateIssues(candidate: StrategyCandidateInput): StrategyLabIssue[] {
  const issues: StrategyLabIssue[] = [];

  if (candidate.sampleSize < 100) {
    issues.push({
      code: 'SAMPLE_TOO_SMALL',
      severity: 'ERROR',
      message: 'Candidate needs at least 100 trades.'
    });
  }

  if (candidate.outOfSampleExpectancyR <= 0) {
    issues.push({
      code: 'OOS_EXPECTANCY_NOT_POSITIVE',
      severity: 'ERROR',
      message: 'Out-of-sample expectancy must be positive.'
    });
  }

  if (candidate.maxDrawdownPercent > 20) {
    issues.push({
      code: 'DRAWDOWN_TOO_HIGH',
      severity: 'ERROR',
      message: 'Maximum drawdown is above the live-readiness cap.'
    });
  }

  if (candidate.walkForwardPositiveRate < 70) {
    issues.push({
      code: 'WEAK_WALK_FORWARD_STABILITY',
      severity: 'ERROR',
      message: 'Walk-forward evidence is not stable enough.'
    });
  }

  if (candidate.coveredRegimes < 3) {
    issues.push({
      code: 'LOW_REGIME_COVERAGE',
      severity: 'WARNING',
      message: 'Candidate lacks broad regime coverage.'
    });
  }

  if (Number.isFinite(candidate.paperExpectancyR ?? Number.NaN) && Number(candidate.paperExpectancyR) <= 0) {
    issues.push({
      code: 'PAPER_EXPECTANCY_NOT_POSITIVE',
      severity: 'WARNING',
      message: 'Paper evidence has not confirmed positive expectancy.'
    });
  }

  return issues;
}

function computeCandidateScore(candidate: StrategyCandidateInput, issues: StrategyLabIssue[]): number {
  const evidenceScore =
    Math.min(candidate.sampleSize, 250) / 250 * 24
    + clamp(candidate.outOfSampleExpectancyR, -0.2, 0.4) * 80
    + clamp(candidate.walkForwardPositiveRate, 0, 100) * 0.24
    + Math.min(candidate.coveredRegimes, 4) * 6
    + Math.max(0, 20 - candidate.maxDrawdownPercent) * 1.2
    + Math.max(0, candidate.paperExpectancyR ?? 0) * 30;
  const penalty = issues.reduce((sum, issue) => sum + (issue.severity === 'ERROR' ? 20 : 7), 0);

  return round(clamp(evidenceScore - penalty, 0, 100), 1);
}

function toStatus(issues: StrategyLabIssue[]): StrategyLabStatus {
  if (issues.some(issue => issue.severity === 'ERROR')) return 'BLOCK';
  if (issues.some(issue => issue.severity === 'WARNING')) return 'REVIEW';
  return 'PASS';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
