export type CapitalAllocationStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface CapitalAllocationStrategyInput {
  id: string;
  healthStatus: CapitalAllocationStatus;
  confidenceScore: number;
  volatilityPercent: number;
  correlationPenalty: number;
  drawdownPercent: number;
}

export interface CapitalAllocationInput {
  accountEquity: number;
  strategies: CapitalAllocationStrategyInput[];
  maxTotalAllocationPercent?: number;
  maxStrategyAllocationPercent?: number;
}

export interface StrategyAllocation {
  strategyId: string;
  allocationUsd: number;
  allocationPercent: number;
  score: number;
}

export interface CapitalAllocationIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface CapitalAllocationReport {
  status: CapitalAllocationStatus;
  totalAllocatedUsd: number;
  totalAllocatedPercent: number;
  allocations: StrategyAllocation[];
  issues: CapitalAllocationIssue[];
}

export function allocateCapital(input: CapitalAllocationInput): CapitalAllocationReport {
  const issues: CapitalAllocationIssue[] = [];
  const maxTotalAllocationPercent = input.maxTotalAllocationPercent ?? 25;
  const maxStrategyAllocationPercent = input.maxStrategyAllocationPercent ?? 15;

  if (!Number.isFinite(input.accountEquity) || input.accountEquity <= 0) {
    issues.push({ code: 'INVALID_ACCOUNT_EQUITY', severity: 'ERROR', message: 'Account equity must be positive.' });
  }

  const scored = input.strategies
    .map(strategy => ({ strategy, score: scoreStrategy(strategy) }))
    .filter(item => item.strategy.healthStatus !== 'BLOCK' && item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    issues.push({ code: 'NO_ALLOCATABLE_STRATEGY', severity: 'ERROR', message: 'No strategy is healthy enough for capital allocation.' });
  }

  const totalScore = scored.reduce((sum, item) => sum + item.score, 0);
  const totalBudgetUsd = Math.max(0, safeNumber(input.accountEquity) * (maxTotalAllocationPercent / 100));
  const allocations = scored.map(item => {
    const rawPercent = totalScore > 0 ? (item.score / totalScore) * maxTotalAllocationPercent : 0;
    const allocationPercent = round(Math.min(maxStrategyAllocationPercent, rawPercent), 2);
    return {
      strategyId: item.strategy.id,
      allocationUsd: round(safeNumber(input.accountEquity) * (allocationPercent / 100), 2),
      allocationPercent,
      score: round(item.score, 2)
    };
  });
  const totalAllocatedUsd = round(Math.min(totalBudgetUsd, allocations.reduce((sum, item) => sum + item.allocationUsd, 0)), 2);
  const totalAllocatedPercent = safeNumber(input.accountEquity) > 0 ? round((totalAllocatedUsd / input.accountEquity) * 100, 2) : 0;

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    totalAllocatedUsd,
    totalAllocatedPercent,
    allocations,
    issues
  };
}

function scoreStrategy(strategy: CapitalAllocationStrategyInput): number {
  const confidence = clamp(strategy.confidenceScore, 0, 100);
  const volatilityPenalty = clamp(strategy.volatilityPercent * 8, 0, 35);
  const correlationPenalty = clamp(strategy.correlationPenalty * 35, 0, 35);
  const drawdownPenalty = clamp(strategy.drawdownPercent * 1.4, 0, 35);
  const reviewPenalty = strategy.healthStatus === 'REVIEW' ? 15 : 0;
  return clamp(confidence - volatilityPenalty - correlationPenalty - drawdownPenalty - reviewPenalty, 0, 100);
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
