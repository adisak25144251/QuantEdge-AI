export type ForwardOutcome = 'TP' | 'SL' | 'OPEN' | 'EXPIRED';
export type ForwardScorecardStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface ForwardSignalResult {
  id: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  maxFavorablePrice: number;
  maxAdversePrice: number;
  finalPrice: number;
  outcome: ForwardOutcome;
  issuedAt: string;
  resolvedAt?: string;
}

export interface ForwardScorecardIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ForwardScorecardOptions {
  minSignals?: number;
  minExpectancyR?: number;
}

export interface ForwardScorecard {
  status: ForwardScorecardStatus;
  totalSignals: number;
  resolvedSignals: number;
  hitRate: number;
  expectancyR: number;
  averageMfeR: number;
  averageMaeR: number;
  averageTimeToResolutionHours: number;
  issues: ForwardScorecardIssue[];
}

export function summarizeForwardTests(results: ForwardSignalResult[], options: ForwardScorecardOptions = {}): ForwardScorecard {
  const minSignals = options.minSignals ?? 30;
  const minExpectancyR = options.minExpectancyR ?? 0;
  const resolved = results.filter(result => result.outcome !== 'OPEN');
  const rMultiples = resolved.map(toRMultiple);
  const hitRate = resolved.length > 0 ? percent(resolved.filter(result => result.outcome === 'TP').length, resolved.length) : 0;
  const expectancyR = rMultiples.length > 0 ? round(avg(rMultiples), 2) : 0;
  const averageMfeR = results.length > 0 ? round(avg(results.map(toMfeR)), 2) : 0;
  const averageMaeR = results.length > 0 ? round(avg(results.map(toMaeR)), 2) : 0;
  const resolutionHours = resolved
    .filter(result => result.resolvedAt)
    .map(result => Math.max(0, (Date.parse(result.resolvedAt as string) - Date.parse(result.issuedAt)) / 3_600_000));
  const issues: ForwardScorecardIssue[] = [];

  if (results.length < minSignals) {
    issues.push({ code: 'FORWARD_SAMPLE_TOO_SMALL', severity: 'WARNING', message: `Need at least ${minSignals} forward-tested signals.` });
  }
  if (expectancyR <= minExpectancyR && resolved.length > 0) {
    issues.push({ code: 'FORWARD_EXPECTANCY_NOT_POSITIVE', severity: 'ERROR', message: 'Forward expectancy must be positive.' });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    totalSignals: results.length,
    resolvedSignals: resolved.length,
    hitRate,
    expectancyR,
    averageMfeR,
    averageMaeR,
    averageTimeToResolutionHours: resolutionHours.length > 0 ? round(avg(resolutionHours), 2) : 0,
    issues
  };
}

function toRMultiple(result: ForwardSignalResult): number {
  if (result.outcome === 'TP') return rewardR(result);
  if (result.outcome === 'SL') return -1;
  return finalR(result);
}

function toMfeR(result: ForwardSignalResult): number {
  const risk = priceRisk(result);
  if (risk <= 0) return 0;
  return result.side === 'LONG'
    ? Math.max(0, (result.maxFavorablePrice - result.entry) / risk)
    : Math.max(0, (result.entry - result.maxFavorablePrice) / risk);
}

function toMaeR(result: ForwardSignalResult): number {
  const risk = priceRisk(result);
  if (risk <= 0) return 0;
  return result.side === 'LONG'
    ? Math.max(0, (result.entry - result.maxAdversePrice) / risk)
    : Math.max(0, (result.maxAdversePrice - result.entry) / risk);
}

function finalR(result: ForwardSignalResult): number {
  const risk = priceRisk(result);
  if (risk <= 0) return 0;
  return result.side === 'LONG'
    ? (result.finalPrice - result.entry) / risk
    : (result.entry - result.finalPrice) / risk;
}

function rewardR(result: ForwardSignalResult): number {
  const risk = priceRisk(result);
  if (risk <= 0) return 0;
  return Math.abs(result.takeProfit - result.entry) / risk;
}

function priceRisk(result: ForwardSignalResult): number {
  return Math.abs(result.entry - result.stopLoss);
}

function avg(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percent(value: number, total: number): number {
  return total > 0 ? round((value / total) * 100, 2) : 0;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
