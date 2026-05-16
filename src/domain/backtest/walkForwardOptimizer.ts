import { evaluateWalkForwardStability, type WalkForwardWindowResult } from './backtestEvidence';

export type WalkForwardOptimizerStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface WalkForwardParameterCandidate {
  id: string;
  parameters: Record<string, number | string | boolean>;
  windows: WalkForwardWindowResult[];
}

export interface OptimizedWalkForwardCandidate extends WalkForwardParameterCandidate {
  status: WalkForwardOptimizerStatus;
  robustnessScore: number;
  positiveWindowRate: number;
  averageExpectancyR: number;
  maxDrawdownPercent: number;
  issues: string[];
}

export interface WalkForwardOptimizerIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface WalkForwardOptimizerInput {
  candidates: WalkForwardParameterCandidate[];
  minTradesPerWindow?: number;
  minPositiveWindowRate?: number;
  maxDrawdownPercent?: number;
}

export interface WalkForwardOptimizerResult {
  status: WalkForwardOptimizerStatus;
  bestCandidate: OptimizedWalkForwardCandidate | null;
  candidates: OptimizedWalkForwardCandidate[];
  issues: WalkForwardOptimizerIssue[];
}

export function optimizeWalkForwardParameters(input: WalkForwardOptimizerInput): WalkForwardOptimizerResult {
  const candidates = input.candidates
    .map(candidate => scoreCandidate(candidate, input))
    .sort((a, b) => b.robustnessScore - a.robustnessScore || b.averageExpectancyR - a.averageExpectancyR);
  const bestCandidate = candidates.find(candidate => candidate.status === 'PASS') ?? null;
  const issues: WalkForwardOptimizerIssue[] = [];

  if (input.candidates.length === 0) {
    issues.push({
      code: 'NO_PARAMETER_CANDIDATES',
      severity: 'ERROR',
      message: 'No walk-forward parameter candidates were provided.'
    });
  }

  if (!bestCandidate) {
    issues.push({
      code: 'NO_ROBUST_PARAMETER_SET',
      severity: 'ERROR',
      message: 'No parameter set passed walk-forward robustness gates.'
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : 'PASS',
    bestCandidate,
    candidates,
    issues
  };
}

function scoreCandidate(
  candidate: WalkForwardParameterCandidate,
  input: WalkForwardOptimizerInput
): OptimizedWalkForwardCandidate {
  const stability = evaluateWalkForwardStability(candidate.windows, {
    minTradesPerWindow: input.minTradesPerWindow,
    minPositiveWindowRate: input.minPositiveWindowRate,
    maxDrawdownPercent: input.maxDrawdownPercent
  });
  const positiveWindowComponent = stability.positiveWindowRate;
  const expectancyComponent = clamp(stability.averageWindowExpectancyR * 100, 0, 100);
  const drawdownLimit = input.maxDrawdownPercent ?? 20;
  const drawdownComponent = clamp(100 - (stability.maxWindowDrawdownPercent / Math.max(drawdownLimit, 1)) * 100, 0, 100);
  const sampleComponent = candidate.windows.every(window => window.trades >= (input.minTradesPerWindow ?? 20)) ? 100 : 0;
  const robustnessScore = stability.status === 'PASS'
    ? 100
    : round((positiveWindowComponent * 0.35) + (expectancyComponent * 0.3) + (drawdownComponent * 0.2) + (sampleComponent * 0.15), 2);

  return {
    ...candidate,
    status: stability.status,
    robustnessScore,
    positiveWindowRate: stability.positiveWindowRate,
    averageExpectancyR: stability.averageWindowExpectancyR,
    maxDrawdownPercent: stability.maxWindowDrawdownPercent,
    issues: stability.issues.map(issue => issue.code)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
