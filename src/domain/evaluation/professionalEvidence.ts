import type { BacktestEvidenceSummary, WalkForwardStabilityReport } from '../backtest/backtestEvidence';
import type { ForwardScorecard } from '../forward/forwardTestScorecard';

export interface ProfessionalEvidenceInput {
  backtest: BacktestEvidenceSummary | null;
  walkForward: WalkForwardStabilityReport | null;
  forward: ForwardScorecard | null;
  averageSlippageBps: number | null;
  maxAllowedSlippageBps?: number;
}

export interface ProfessionalEvidenceReport {
  status: 'PASS' | 'REVIEW' | 'BLOCK';
  precisionPercent: number | null;
  expectancyR: number | null;
  maxDrawdownPercent: number | null;
  averageSlippageBps: number | null;
  issues: string[];
}

export function evaluateProfessionalEvidence(input: ProfessionalEvidenceInput): ProfessionalEvidenceReport {
  const issues: string[] = [];
  const maxSlippage = input.maxAllowedSlippageBps ?? 25;
  const precision = input.forward && input.forward.resolvedSignals >= 30 ? input.forward.hitRate : null;
  const expectancy = input.backtest && input.backtest.outOfSampleTrades >= 30
    ? input.backtest.outOfSampleExpectancyR
    : null;
  const drawdown = input.backtest?.maxDrawdownPercent ?? null;

  if (!input.backtest || input.backtest.outOfSampleTrades < 30) issues.push('OOS_SAMPLE_TOO_SMALL');
  if (expectancy === null || expectancy <= 0) issues.push('OOS_EXPECTANCY_NOT_POSITIVE');
  if (!input.walkForward || input.walkForward.status !== 'PASS') issues.push('WALK_FORWARD_NOT_ROBUST');
  if (!input.forward || input.forward.resolvedSignals < 30) issues.push('FORWARD_SAMPLE_TOO_SMALL');
  if (input.forward?.status === 'BLOCK') issues.push('FORWARD_EVIDENCE_BLOCKED');
  if (input.averageSlippageBps === null) issues.push('SLIPPAGE_DATA_REQUIRED');
  else if (input.averageSlippageBps > maxSlippage) issues.push('SLIPPAGE_LIMIT_EXCEEDED');
  if (drawdown === null || drawdown > 20) issues.push('DRAWDOWN_LIMIT_EXCEEDED');

  const hardBlock = issues.some(issue =>
    issue === 'OOS_EXPECTANCY_NOT_POSITIVE' ||
    issue === 'WALK_FORWARD_NOT_ROBUST' ||
    issue === 'FORWARD_EVIDENCE_BLOCKED' ||
    issue === 'SLIPPAGE_LIMIT_EXCEEDED' ||
    issue === 'DRAWDOWN_LIMIT_EXCEEDED'
  );

  return {
    status: hardBlock ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    precisionPercent: precision,
    expectancyR: expectancy,
    maxDrawdownPercent: drawdown,
    averageSlippageBps: input.averageSlippageBps,
    issues
  };
}
