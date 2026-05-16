import type { TradeSide } from './portfolioRisk';

export type ExposureMapStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type ExposureAssetClass = 'CRYPTO' | 'EQUITY_INDEX' | 'FOREX' | 'COMMODITY' | 'UNKNOWN';

export interface ExposureMapTrade {
  id: string;
  symbol: string;
  side: TradeSide;
  sizeUSD: number;
  status: string;
  assetClass?: ExposureAssetClass;
  correlationCluster?: string;
}

export interface ExposureBucket {
  key: string;
  exposureUsd: number;
  exposurePercent: number;
  tradeCount: number;
}

export interface ExposureMapIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface PortfolioExposureMapInput {
  accountEquity: number;
  trades: ExposureMapTrade[];
  maxGrossExposurePercent?: number;
  maxDirectionExposurePercent?: number;
  maxAssetClassExposurePercent?: number;
  maxClusterExposurePercent?: number;
}

export interface PortfolioExposureMapReport {
  status: ExposureMapStatus;
  openTrades: number;
  grossExposureUsd: number;
  grossExposurePercent: number;
  byDirection: Record<TradeSide, ExposureBucket>;
  byAssetClass: Partial<Record<ExposureAssetClass, ExposureBucket>>;
  byCluster: Record<string, ExposureBucket>;
  issues: ExposureMapIssue[];
}

export function buildPortfolioExposureMap(input: PortfolioExposureMapInput): PortfolioExposureMapReport {
  const issues: ExposureMapIssue[] = [];
  const openTrades = input.trades.filter(trade => trade.status === 'OPEN');
  const grossExposureUsd = round(openTrades.reduce((sum, trade) => sum + safeNumber(trade.sizeUSD), 0), 2);
  const grossExposurePercent = percent(grossExposureUsd, input.accountEquity);
  const byDirection = {
    LONG: buildBucket('LONG', openTrades.filter(trade => trade.side === 'LONG'), input.accountEquity),
    SHORT: buildBucket('SHORT', openTrades.filter(trade => trade.side === 'SHORT'), input.accountEquity)
  };
  const byAssetClass = groupBuckets(openTrades, input.accountEquity, trade => trade.assetClass ?? inferAssetClass(trade.symbol));
  const byCluster = groupBuckets(openTrades, input.accountEquity, trade => trade.correlationCluster ?? inferCluster(trade.symbol));

  const maxGrossExposurePercent = input.maxGrossExposurePercent ?? 150;
  const maxDirectionExposurePercent = input.maxDirectionExposurePercent ?? 80;
  const maxAssetClassExposurePercent = input.maxAssetClassExposurePercent ?? 70;
  const maxClusterExposurePercent = input.maxClusterExposurePercent ?? 60;

  if (grossExposurePercent > maxGrossExposurePercent) {
    issues.push({
      code: 'GROSS_EXPOSURE_EXCEEDED',
      severity: 'ERROR',
      message: `Gross exposure exceeds ${maxGrossExposurePercent}% of account equity.`
    });
  }

  for (const bucket of Object.values(byDirection)) {
    if (bucket.exposurePercent > maxDirectionExposurePercent) {
      issues.push({
        code: 'DIRECTION_EXPOSURE_EXCEEDED',
        severity: 'ERROR',
        message: `${bucket.key} exposure exceeds ${maxDirectionExposurePercent}% of account equity.`
      });
    }
  }

  for (const bucket of Object.values(byAssetClass)) {
    if (bucket.exposurePercent > maxAssetClassExposurePercent) {
      issues.push({
        code: 'ASSET_CLASS_EXPOSURE_EXCEEDED',
        severity: 'ERROR',
        message: `${bucket.key} exposure exceeds ${maxAssetClassExposurePercent}% of account equity.`
      });
    }
  }

  for (const bucket of Object.values(byCluster)) {
    if (bucket.exposurePercent > maxClusterExposurePercent) {
      issues.push({
        code: 'CLUSTER_EXPOSURE_EXCEEDED',
        severity: 'ERROR',
        message: `${bucket.key} exposure exceeds ${maxClusterExposurePercent}% of account equity.`
      });
    }
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    openTrades: openTrades.length,
    grossExposureUsd,
    grossExposurePercent,
    byDirection,
    byAssetClass,
    byCluster,
    issues
  };
}

function groupBuckets<T extends string>(
  trades: ExposureMapTrade[],
  accountEquity: number,
  getKey: (trade: ExposureMapTrade) => T
): Record<T, ExposureBucket> {
  const grouped = {} as Record<T, ExposureMapTrade[]>;
  for (const trade of trades) {
    const key = getKey(trade);
    grouped[key] = [...(grouped[key] ?? []), trade];
  }

  return Object.entries(grouped).reduce((acc, [key, bucketTrades]) => {
    acc[key as T] = buildBucket(key, bucketTrades as ExposureMapTrade[], accountEquity);
    return acc;
  }, {} as Record<T, ExposureBucket>);
}

function buildBucket(key: string, trades: ExposureMapTrade[], accountEquity: number): ExposureBucket {
  const exposureUsd = round(trades.reduce((sum, trade) => sum + safeNumber(trade.sizeUSD), 0), 2);
  return {
    key,
    exposureUsd,
    exposurePercent: percent(exposureUsd, accountEquity),
    tradeCount: trades.length
  };
}

function inferAssetClass(symbol: string): ExposureAssetClass {
  const normalized = symbol.toUpperCase();
  if (normalized.endsWith('USDT') || normalized.endsWith('USDC')) return 'CRYPTO';
  if (['US500', 'US100', 'US30', 'SPX', 'NDX'].includes(normalized)) return 'EQUITY_INDEX';
  if (['XAUUSD', 'XAGUSD', 'WTI', 'BRENT'].includes(normalized)) return 'COMMODITY';
  if (/^[A-Z]{6}$/.test(normalized)) return 'FOREX';
  return 'UNKNOWN';
}

function inferCluster(symbol: string): string {
  const normalized = symbol.toUpperCase();
  if (['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'].includes(normalized)) return 'crypto majors';
  if (['US500', 'US100', 'US30', 'SPX', 'NDX'].includes(normalized)) return 'us equity beta';
  if (['XAUUSD', 'XAGUSD'].includes(normalized)) return 'precious metals';
  return normalized;
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
