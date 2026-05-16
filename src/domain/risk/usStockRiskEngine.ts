export type UsStockRiskStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface UsStockRiskInput {
  symbol: string;
  sector: string;
  accountEquity: number;
  positionUsd: number;
  sectorExposureUsd: number;
  beta: number;
  averageDailyVolumeUsd: number;
  daysToEarnings: number | null;
  overnightHold: boolean;
  shortSell: boolean;
  maxSingleStockExposurePercent?: number;
  maxSectorExposurePercent?: number;
}

export interface UsStockRiskIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface UsStockRiskReport {
  status: UsStockRiskStatus;
  singleStockExposurePercent: number;
  sectorExposurePercent: number;
  liquidityParticipationPercent: number;
  issues: UsStockRiskIssue[];
}

export function evaluateUsStockRisk(input: UsStockRiskInput): UsStockRiskReport {
  const issues: UsStockRiskIssue[] = [];
  const maxSingle = input.maxSingleStockExposurePercent ?? 15;
  const maxSector = input.maxSectorExposurePercent ?? 30;
  const singleStockExposurePercent = percent(input.positionUsd, input.accountEquity);
  const sectorExposurePercent = percent(input.sectorExposureUsd + input.positionUsd, input.accountEquity);
  const liquidityParticipationPercent = percent(input.positionUsd, input.averageDailyVolumeUsd);

  if (singleStockExposurePercent > maxSingle) {
    issues.push({ code: 'SINGLE_STOCK_EXPOSURE_EXCEEDED', severity: 'ERROR', message: `Single-stock exposure exceeds ${maxSingle}%.` });
  }
  if (sectorExposurePercent > maxSector) {
    issues.push({ code: 'SECTOR_EXPOSURE_EXCEEDED', severity: 'ERROR', message: `Sector exposure exceeds ${maxSector}%.` });
  }
  if (input.daysToEarnings !== null && input.daysToEarnings <= 3) {
    issues.push({ code: 'EARNINGS_LOCKOUT', severity: 'ERROR', message: 'Stock is inside earnings lockout window.' });
  }
  if (input.beta > 1.8) {
    issues.push({ code: 'HIGH_BETA_STOCK', severity: 'WARNING', message: 'High beta increases gap and market risk.' });
  }
  if (liquidityParticipationPercent > 1) {
    issues.push({ code: 'LIQUIDITY_PARTICIPATION_HIGH', severity: 'WARNING', message: 'Position is large relative to daily dollar volume.' });
  }
  if (input.overnightHold) {
    issues.push({ code: 'OVERNIGHT_GAP_RISK', severity: 'WARNING', message: 'Overnight hold adds stock gap risk.' });
  }
  if (input.shortSell) {
    issues.push({ code: 'SHORT_BORROW_RISK', severity: 'WARNING', message: 'Short sale requires borrow and locate checks.' });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    singleStockExposurePercent,
    sectorExposurePercent,
    liquidityParticipationPercent,
    issues
  };
}

function percent(value: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator <= 0) return 100;
  return round((value / denominator) * 100, 2);
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
