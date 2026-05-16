export type DataSourceRedundancyStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface DataSourceSnapshot {
  name: string;
  status: DataSourceRedundancyStatus;
  latestClose: number | null;
  latencyMs: number;
  lastUpdatedAt: number;
}

export interface DataSourceRedundancyIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface DataSourceRedundancyInput {
  sources: DataSourceSnapshot[];
  now?: number;
  maxPriceDivergencePercent?: number;
  staleAfterMs?: number;
}

export interface DataSourceRedundancyReport {
  status: DataSourceRedundancyStatus;
  selectedSource: string | null;
  healthySources: number;
  maxDivergencePercent: number;
  issues: DataSourceRedundancyIssue[];
}

export function evaluateDataSourceRedundancy(input: DataSourceRedundancyInput): DataSourceRedundancyReport {
  const issues: DataSourceRedundancyIssue[] = [];
  const now = input.now ?? Date.now();
  const staleAfterMs = input.staleAfterMs ?? 3 * 60_000;
  const maxPriceDivergencePercent = input.maxPriceDivergencePercent ?? 0.25;

  const usableSources = input.sources.filter(source => {
    const hasPrice = Number.isFinite(source.latestClose ?? Number.NaN) && Number(source.latestClose) > 0;
    const fresh = now - source.lastUpdatedAt <= staleAfterMs;
    return source.status === 'PASS' && hasPrice && fresh;
  });

  const staleSources = input.sources.filter(source => now - source.lastUpdatedAt > staleAfterMs);
  if (staleSources.length > 0) {
    issues.push({
      code: 'STALE_DATA_SOURCE',
      severity: usableSources.length === 0 ? 'ERROR' : 'WARNING',
      message: 'At least one market-data source is stale.'
    });
  }

  if (usableSources.length === 0) {
    issues.push({
      code: 'NO_HEALTHY_DATA_SOURCE',
      severity: 'ERROR',
      message: 'No healthy redundant market-data source is available.'
    });
  }

  if (input.sources.length < 2) {
    issues.push({
      code: 'SINGLE_DATA_SOURCE_ONLY',
      severity: 'WARNING',
      message: 'Only one market-data source is configured.'
    });
  }

  const maxDivergencePercent = computeMaxDivergencePercent(usableSources);
  if (usableSources.length >= 2 && maxDivergencePercent > maxPriceDivergencePercent) {
    issues.push({
      code: 'SOURCE_PRICE_DIVERGENCE',
      severity: 'WARNING',
      message: `Source prices diverge by more than ${maxPriceDivergencePercent}%.`
    });
  }

  const selected = [...usableSources].sort((a, b) => a.latencyMs - b.latencyMs || b.lastUpdatedAt - a.lastUpdatedAt)[0] ?? null;
  const status = issues.some(issue => issue.severity === 'ERROR')
    ? 'BLOCK'
    : issues.length > 0
      ? 'REVIEW'
      : 'PASS';

  return {
    status,
    selectedSource: selected?.name ?? null,
    healthySources: usableSources.length,
    maxDivergencePercent,
    issues
  };
}

function computeMaxDivergencePercent(sources: DataSourceSnapshot[]): number {
  const prices = sources
    .map(source => Number(source.latestClose))
    .filter(price => Number.isFinite(price) && price > 0);
  if (prices.length < 2) return 0;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const midpoint = (min + max) / 2;
  return midpoint > 0 ? round(((max - min) / midpoint) * 100, 3) : 0;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
