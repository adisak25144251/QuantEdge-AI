import type { CorrelationPair } from './correlationRisk';

export type CorrelationMatrixStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface CorrelationMatrixIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface CorrelationMatrix {
  status: CorrelationMatrixStatus;
  pairs: CorrelationPair[];
  issues: CorrelationMatrixIssue[];
}

export function buildCorrelationMatrix(closeSeriesBySymbol: Record<string, number[]>, minPrices = 3): CorrelationMatrix {
  const symbols = Object.keys(closeSeriesBySymbol).sort();
  const issues: CorrelationMatrixIssue[] = [];
  const pairs: CorrelationPair[] = [];

  for (const symbol of symbols) {
    if ((closeSeriesBySymbol[symbol]?.length ?? 0) < minPrices) {
      issues.push({
        code: 'INSUFFICIENT_CORRELATION_HISTORY',
        severity: 'WARNING',
        message: `${symbol} does not have enough prices for correlation.`
      });
    }
  }

  for (let i = 0; i < symbols.length; i += 1) {
    for (let j = i + 1; j < symbols.length; j += 1) {
      const a = symbols[i];
      const b = symbols[j];
      const aChanges = changes(closeSeriesBySymbol[a] ?? []);
      const bChanges = changes(closeSeriesBySymbol[b] ?? []);
      const length = Math.min(aChanges.length, bChanges.length);
      if (length < minPrices - 1) continue;
      pairs.push({ a, b, value: round(correlation(aChanges.slice(-length), bChanges.slice(-length)), 4) });
    }
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    pairs,
    issues
  };
}

function changes(values: number[]): number[] {
  return values.slice(1).map((value, index) => value - values[index]);
}

function correlation(a: number[], b: number[]): number {
  const meanA = avg(a);
  const meanB = avg(b);
  const numerator = a.reduce((sum, value, index) => sum + (value - meanA) * (b[index] - meanB), 0);
  const denominatorA = Math.sqrt(a.reduce((sum, value) => sum + (value - meanA) ** 2, 0));
  const denominatorB = Math.sqrt(b.reduce((sum, value) => sum + (value - meanB) ** 2, 0));
  if (denominatorA > 0 && denominatorB > 0) return numerator / (denominatorA * denominatorB);
  if (a.every(value => value === a[0]) && b.every(value => value === b[0])) {
    return Math.sign((a[0] ?? 0) * (b[0] ?? 0));
  }
  return 0;
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
