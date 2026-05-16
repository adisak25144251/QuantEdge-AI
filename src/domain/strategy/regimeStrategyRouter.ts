import { isStrategyAllowedInRegime, type LiveMarketRegime, type StrategyFamily } from '../market/marketRegimeEngine';

export type RegimeStrategyRouterStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface RegimeStrategyCandidate {
  id: string;
  family: StrategyFamily;
  status: RegimeStrategyRouterStatus;
  score: number;
}

export interface RegimeStrategyRouterInput {
  regime: LiveMarketRegime;
  strategies: RegimeStrategyCandidate[];
}

export interface RegimeStrategyRouterIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface RegimeStrategyRoute {
  status: RegimeStrategyRouterStatus;
  selectedStrategyId: string | null;
  blockedStrategies: string[];
  issues: RegimeStrategyRouterIssue[];
}

export function routeStrategyForRegime(input: RegimeStrategyRouterInput): RegimeStrategyRoute {
  const issues: RegimeStrategyRouterIssue[] = [];

  if (input.regime === 'UNKNOWN') {
    issues.push({
      code: 'UNKNOWN_MARKET_REGIME',
      severity: 'ERROR',
      message: 'Cannot route strategy while market regime is unknown.'
    });
  }

  const compatible = input.strategies
    .filter(strategy => strategy.status !== 'BLOCK' && isStrategyAllowedInRegime(strategy.family, input.regime))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || b.score - a.score);
  const blockedStrategies = input.strategies
    .filter(strategy => strategy.status === 'BLOCK' || !isStrategyAllowedInRegime(strategy.family, input.regime))
    .map(strategy => strategy.id);

  if (input.regime !== 'UNKNOWN' && compatible.length === 0) {
    issues.push({
      code: 'NO_COMPATIBLE_STRATEGY',
      severity: 'ERROR',
      message: `No strategy is compatible with ${input.regime}.`
    });
  }

  if (compatible[0]?.status === 'REVIEW') {
    issues.push({
      code: 'SELECTED_STRATEGY_IN_REVIEW',
      severity: 'WARNING',
      message: 'Selected regime strategy still requires review.'
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    selectedStrategyId: issues.some(issue => issue.severity === 'ERROR') ? null : compatible[0]?.id ?? null,
    blockedStrategies,
    issues
  };
}

function statusRank(status: RegimeStrategyRouterStatus): number {
  if (status === 'PASS') return 2;
  if (status === 'REVIEW') return 1;
  return 0;
}
