export type UsStockIndicatorStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface UsStockIndicatorInput {
  symbol: string;
  closes: number[];
  benchmarkCloses: number[];
  opens: number[];
  volumes: number[];
  sectorStrengthPercent: number;
}

export interface UsStockIndicatorIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface UsStockIndicatorReport {
  status: UsStockIndicatorStatus;
  relativeStrengthPercent: number;
  gapPercent: number;
  relativeVolume: number;
  volumeConfirmation: 'CONFIRMED' | 'WEAK';
  sectorAlignment: 'ALIGNED' | 'DIVERGENT';
  issues: UsStockIndicatorIssue[];
}

export function analyzeUsStockIndicators(input: UsStockIndicatorInput): UsStockIndicatorReport {
  const issues: UsStockIndicatorIssue[] = [];

  if (input.closes.length < 2 || input.benchmarkCloses.length < 2 || input.opens.length === 0 || input.volumes.length < 2) {
    issues.push({ code: 'INSUFFICIENT_STOCK_INDICATORS', severity: 'ERROR', message: 'Not enough stock data to compute indicators.' });
  }

  const stockReturn = pctChange(first(input.closes), last(input.closes));
  const benchmarkReturn = pctChange(first(input.benchmarkCloses), last(input.benchmarkCloses));
  const relativeStrengthPercent = round(stockReturn - benchmarkReturn, 2);
  const gapPercent = round(pctChange(input.closes[input.closes.length - 2] ?? first(input.closes), last(input.opens)), 2);
  const averageVolume = input.volumes.slice(0, -1).reduce((sum, value) => sum + safe(value), 0) / Math.max(1, input.volumes.length - 1);
  const relativeVolume = averageVolume > 0 ? round(last(input.volumes) / averageVolume, 2) : 0;
  const volumeConfirmation = relativeVolume >= 1.2 ? 'CONFIRMED' : 'WEAK';
  const sectorAlignment = input.sectorStrengthPercent >= 0 ? 'ALIGNED' : 'DIVERGENT';

  if (relativeStrengthPercent < 0) {
    issues.push({ code: 'RELATIVE_STRENGTH_WEAK', severity: 'WARNING', message: 'Stock is underperforming the benchmark.' });
  }
  if (volumeConfirmation === 'WEAK') {
    issues.push({ code: 'VOLUME_CONFIRMATION_WEAK', severity: 'WARNING', message: 'Latest volume does not confirm the move.' });
  }
  if (sectorAlignment === 'DIVERGENT') {
    issues.push({ code: 'SECTOR_DIVERGENCE', severity: 'WARNING', message: 'Sector strength is not aligned.' });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    relativeStrengthPercent,
    gapPercent,
    relativeVolume,
    volumeConfirmation,
    sectorAlignment,
    issues
  };
}

function first(values: number[]): number {
  return safe(values[0]);
}

function last(values: number[]): number {
  return safe(values[values.length - 1]);
}

function pctChange(start: number, end: number): number {
  if (!Number.isFinite(start) || start === 0) return 0;
  return ((end - start) / Math.abs(start)) * 100;
}

function safe(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
