export type DataQualityStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface DataQualityIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface DataSourceQualityReport {
  source: string;
  symbol: string;
  status: DataQualityStatus;
  candleCount: number;
  issues: DataQualityIssue[];
}

export interface DataQualitySummary {
  status: DataQualityStatus;
  sourceCount: number;
  totalCandles: number;
  cleanSourceRate: number;
  issueCodes: string[];
  bySource: Record<string, { symbols: number; candles: number; blocked: number; review: number }>;
}

export function summarizeDataQuality(reports: DataSourceQualityReport[]): DataQualitySummary {
  const sourceCount = new Set(reports.map(report => report.source)).size;
  const totalCandles = reports.reduce((sum, report) => sum + Math.max(0, report.candleCount), 0);
  const cleanReports = reports.filter(report => report.status === 'PASS' && report.issues.length === 0).length;
  const issues = reports.flatMap(report => report.issues);
  const issueCodes = Array.from(new Set(issues.map(issue => issue.code))).sort();
  const bySource = reports.reduce<DataQualitySummary['bySource']>((acc, report) => {
    acc[report.source] ??= { symbols: 0, candles: 0, blocked: 0, review: 0 };
    acc[report.source].symbols += 1;
    acc[report.source].candles += Math.max(0, report.candleCount);
    if (report.status === 'BLOCK') acc[report.source].blocked += 1;
    if (report.status === 'REVIEW') acc[report.source].review += 1;
    return acc;
  }, {});

  return {
    status: issues.some(issue => issue.severity === 'ERROR') || reports.some(report => report.status === 'BLOCK')
      ? 'BLOCK'
      : issues.length > 0 || reports.some(report => report.status === 'REVIEW')
        ? 'REVIEW'
        : 'PASS',
    sourceCount,
    totalCandles,
    cleanSourceRate: reports.length > 0 ? round((cleanReports / reports.length) * 100, 2) : 0,
    issueCodes,
    bySource
  };
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
