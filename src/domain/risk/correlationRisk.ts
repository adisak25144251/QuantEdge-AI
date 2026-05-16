import type { TradeSide } from './portfolioRisk';

export type CorrelationRiskStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface CorrelationTradeLike {
  id: string;
  symbol: string;
  side: TradeSide;
  sizeUSD: number;
  status: string;
}

export interface CorrelationCandidate {
  symbol: string;
  side: TradeSide;
  sizeUsd: number;
}

export interface CorrelationPair {
  a: string;
  b: string;
  value: number;
}

export interface CorrelationRiskInput {
  accountEquity: number;
  currentTrades: CorrelationTradeLike[];
  candidate: CorrelationCandidate;
  correlations: CorrelationPair[];
  minCorrelation?: number;
  maxCorrelatedExposurePercent?: number;
}

export interface CorrelationRiskIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface CorrelationRiskResult {
  status: CorrelationRiskStatus;
  correlatedExposureUsd: number;
  correlatedExposurePercent: number;
  correlatedSymbols: string[];
  issues: CorrelationRiskIssue[];
}

export function evaluateCorrelationRisk(input: CorrelationRiskInput): CorrelationRiskResult {
  const minCorrelation = input.minCorrelation ?? 0.75;
  const maxCorrelatedExposurePercent = input.maxCorrelatedExposurePercent ?? 50;
  const openSameDirection = input.currentTrades.filter(trade => trade.status === 'OPEN' && trade.side === input.candidate.side);
  const correlatedTrades = openSameDirection.filter(trade =>
    getCorrelation(input.correlations, trade.symbol, input.candidate.symbol) >= minCorrelation
  );
  const issues: CorrelationRiskIssue[] = [];

  const hasOpenExposure = input.currentTrades.some(trade => trade.status === 'OPEN');
  const missingCorrelationData = hasOpenExposure && correlatedTrades.length === 0 && input.correlations.length === 0;
  const correlatedExposureUsd = correlatedTrades.reduce((sum, trade) => sum + safeNumber(trade.sizeUSD), 0) + input.candidate.sizeUsd;
  const correlatedExposurePercent = percent(correlatedExposureUsd, input.accountEquity);

  if (missingCorrelationData) {
    issues.push({
      code: 'CORRELATION_DATA_MISSING',
      severity: 'WARNING',
      message: 'Correlation matrix is missing; review portfolio dependency manually.'
    });
  }

  if (correlatedTrades.length > 0 && correlatedExposurePercent > maxCorrelatedExposurePercent) {
    issues.push({
      code: 'CORRELATED_EXPOSURE_EXCEEDED',
      severity: 'ERROR',
      message: `Correlated same-direction exposure exceeds ${maxCorrelatedExposurePercent}% of equity.`
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR')
      ? 'BLOCK'
      : issues.length > 0
        ? 'REVIEW'
        : 'PASS',
    correlatedExposureUsd: round(correlatedExposureUsd, 2),
    correlatedExposurePercent,
    correlatedSymbols: correlatedTrades.map(trade => trade.symbol),
    issues
  };
}

function getCorrelation(correlations: CorrelationPair[], a: string, b: string): number {
  const pair = correlations.find(item =>
    (item.a === a && item.b === b) || (item.a === b && item.b === a)
  );
  return pair ? Math.abs(pair.value) : 0;
}

function percent(value: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator <= 0) return 100;
  return round((value / denominator) * 100, 2);
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
