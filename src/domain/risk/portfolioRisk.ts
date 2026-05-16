export type PortfolioRiskStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type TradeSide = 'LONG' | 'SHORT';

export interface PortfolioRiskIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface OpenTradeLike {
  id: string;
  symbol: string;
  side: TradeSide;
  entry: number;
  sl: number;
  tp: number;
  sizeUSD: number;
  sizeUnits: number;
  status: string;
}

export interface CandidateExposure {
  symbol: string;
  side: TradeSide;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  sizeUnits: number;
  sizeUsd: number;
}

export interface OpenRiskSummary {
  openTrades: number;
  openRiskUsd: number;
  portfolioHeatPercent: number;
  longExposureUsd: number;
  shortExposureUsd: number;
  grossExposureUsd: number;
}

export interface PortfolioRiskInput {
  accountEquity: number;
  trades: OpenTradeLike[];
}

export interface EvaluatePortfolioRiskInput {
  accountEquity: number;
  currentTrades: OpenTradeLike[];
  candidate: CandidateExposure;
  maxPortfolioHeatPercent?: number;
  maxSameDirectionExposurePercent?: number;
}

export interface PortfolioRiskResult {
  status: PortfolioRiskStatus;
  issues: PortfolioRiskIssue[];
  currentHeatPercent: number;
  projectedHeatPercent: number;
  projectedSameDirectionExposurePercent: number;
}

export interface ExecutionAuditInput {
  setupId: string;
  symbol: string;
  side: TradeSide;
  action: 'RECORD_PLAN' | 'BLOCK_PLAN' | 'CLOSE_PLAN';
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK';
  riskGateStatus: PortfolioRiskStatus;
  portfolioGateStatus: PortfolioRiskStatus;
  issueCodes: string[];
  timestamp: string;
}

export interface ExecutionAuditEntry extends ExecutionAuditInput {
  id: string;
}

export interface AuditIssueCount {
  code: string;
  count: number;
}

export interface ExecutionAuditSummary {
  totalDecisions: number;
  allowCount: number;
  reviewCount: number;
  blockCount: number;
  blockRate: number;
  topIssueCodes: AuditIssueCount[];
}

export function summarizeOpenRisk(input: PortfolioRiskInput): OpenRiskSummary {
  const openTrades = input.trades.filter(trade => trade.status === 'OPEN');
  const openRiskUsd = openTrades.reduce((sum, trade) => sum + calculateTradeRiskUsd(trade), 0);
  const longExposureUsd = openTrades
    .filter(trade => trade.side === 'LONG')
    .reduce((sum, trade) => sum + safeNumber(trade.sizeUSD), 0);
  const shortExposureUsd = openTrades
    .filter(trade => trade.side === 'SHORT')
    .reduce((sum, trade) => sum + safeNumber(trade.sizeUSD), 0);

  return {
    openTrades: openTrades.length,
    openRiskUsd: round(openRiskUsd, 2),
    portfolioHeatPercent: percent(openRiskUsd, input.accountEquity),
    longExposureUsd: round(longExposureUsd, 2),
    shortExposureUsd: round(shortExposureUsd, 2),
    grossExposureUsd: round(longExposureUsd + shortExposureUsd, 2)
  };
}

export function evaluatePortfolioRisk(input: EvaluatePortfolioRiskInput): PortfolioRiskResult {
  const issues: PortfolioRiskIssue[] = [];
  const maxPortfolioHeatPercent = input.maxPortfolioHeatPercent ?? 6;
  const maxSameDirectionExposurePercent = input.maxSameDirectionExposurePercent ?? 60;
  const summary = summarizeOpenRisk({
    accountEquity: input.accountEquity,
    trades: input.currentTrades
  });
  const candidateRiskUsd = calculateCandidateRiskUsd(input.candidate);
  const projectedHeatPercent = percent(summary.openRiskUsd + candidateRiskUsd, input.accountEquity);
  const sameDirectionExposureUsd = (input.candidate.side === 'LONG' ? summary.longExposureUsd : summary.shortExposureUsd) + input.candidate.sizeUsd;
  const projectedSameDirectionExposurePercent = percent(sameDirectionExposureUsd, input.accountEquity);

  if (projectedHeatPercent > maxPortfolioHeatPercent) {
    issues.push({
      code: 'PORTFOLIO_HEAT_EXCEEDED',
      severity: 'ERROR',
      message: `Projected portfolio heat exceeds ${maxPortfolioHeatPercent}%.`
    });
  }

  if (projectedSameDirectionExposurePercent > maxSameDirectionExposurePercent) {
    issues.push({
      code: 'DIRECTIONAL_EXPOSURE_EXCEEDED',
      severity: 'ERROR',
      message: `Projected ${input.candidate.side} exposure exceeds ${maxSameDirectionExposurePercent}% of account equity.`
    });
  }

  const duplicateSymbol = input.currentTrades.some(trade =>
    trade.status === 'OPEN' &&
    trade.symbol === input.candidate.symbol
  );

  if (duplicateSymbol) {
    issues.push({
      code: 'DUPLICATE_SYMBOL_EXPOSURE',
      severity: 'WARNING',
      message: 'There is already an open plan for this symbol.'
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR')
      ? 'BLOCK'
      : issues.some(issue => issue.severity === 'WARNING')
        ? 'REVIEW'
        : 'PASS',
    issues,
    currentHeatPercent: summary.portfolioHeatPercent,
    projectedHeatPercent,
    projectedSameDirectionExposurePercent
  };
}

export function createExecutionAuditEntry(input: ExecutionAuditInput): ExecutionAuditEntry {
  return {
    ...input,
    id: `audit-${input.setupId}-${input.timestamp}`
  };
}

export function summarizeExecutionAudit(entries: ExecutionAuditEntry[]): ExecutionAuditSummary {
  const totalDecisions = entries.length;
  const allowCount = entries.filter(entry => entry.decision === 'ALLOW').length;
  const reviewCount = entries.filter(entry => entry.decision === 'REVIEW').length;
  const blockCount = entries.filter(entry => entry.decision === 'BLOCK').length;
  const issueCounts = new Map<string, { count: number; firstSeen: number }>();
  let issueIndex = 0;

  for (const entry of entries) {
    for (const code of entry.issueCodes) {
      const existing = issueCounts.get(code);
      if (existing) {
        issueCounts.set(code, { ...existing, count: existing.count + 1 });
      } else {
        issueCounts.set(code, { count: 1, firstSeen: issueIndex });
        issueIndex += 1;
      }
    }
  }

  return {
    totalDecisions,
    allowCount,
    reviewCount,
    blockCount,
    blockRate: totalDecisions > 0 ? round((blockCount / totalDecisions) * 100, 2) : 0,
    topIssueCodes: Array.from(issueCounts.entries())
      .map(([code, value]) => ({ code, count: value.count, firstSeen: value.firstSeen }))
      .sort((a, b) => b.count - a.count || a.firstSeen - b.firstSeen)
      .map(({ code, count }) => ({ code, count }))
      .slice(0, 5)
  };
}

function calculateTradeRiskUsd(trade: OpenTradeLike): number {
  const priceRisk = Math.abs(safeNumber(trade.entry) - safeNumber(trade.sl));
  return priceRisk * safeNumber(trade.sizeUnits);
}

function calculateCandidateRiskUsd(candidate: CandidateExposure): number {
  const priceRisk = Math.abs(safeNumber(candidate.entry) - safeNumber(candidate.stopLoss));
  return priceRisk * safeNumber(candidate.sizeUnits);
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
