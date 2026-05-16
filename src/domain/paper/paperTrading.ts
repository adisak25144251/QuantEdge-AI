export type PaperTradeSide = 'LONG' | 'SHORT';
export type PaperTradeStatus = 'OPEN' | 'CLOSED';

export interface PaperTradePlan {
  id?: string;
  symbol: string;
  side: PaperTradeSide;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  sizeUnits: number;
  openedAt: string;
}

export interface PaperTrade extends PaperTradePlan {
  id: string;
  status: PaperTradeStatus;
  exitPrice?: number;
  closedAt?: string;
  pnlUsd?: number;
  rMultiple?: number;
}

export interface ClosePaperTradeInput {
  exitPrice: number;
  closedAt: string;
}

export interface PaperTradingStats {
  closedTrades: number;
  winRate: number;
  expectancyR: number;
  profitFactor: number;
  maxDrawdownUsd: number;
  netPnlUsd: number;
}

export type PaperReadinessStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface PaperReadinessIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface PaperReadinessInput {
  stats: PaperTradingStats;
  accountEquity: number;
  minClosedTrades?: number;
  maxDrawdownPercent?: number;
  minProfitFactor?: number;
}

export interface PaperReadinessReport {
  status: PaperReadinessStatus;
  drawdownPercent: number;
  issues: PaperReadinessIssue[];
}

export function recordPaperTrade(plan: PaperTradePlan): PaperTrade {
  assertValidPlan(plan);

  return {
    ...plan,
    id: plan.id ?? buildPaperTradeId(plan),
    status: 'OPEN'
  };
}

export function closePaperTrade(trade: PaperTrade, input: ClosePaperTradeInput): PaperTrade {
  if (!Number.isFinite(input.exitPrice) || input.exitPrice <= 0) {
    throw new Error('Exit price must be a positive number.');
  }

  const pnlUsd = calculatePnlUsd(trade, input.exitPrice);
  const riskUsd = Math.abs(trade.entry - trade.stopLoss) * trade.sizeUnits;
  const rMultiple = riskUsd > 0 ? pnlUsd / riskUsd : 0;

  return {
    ...trade,
    status: 'CLOSED',
    exitPrice: input.exitPrice,
    closedAt: input.closedAt,
    pnlUsd: round(pnlUsd, 2),
    rMultiple: round(rMultiple, 2)
  };
}

export function computePaperStats(trades: PaperTrade[]): PaperTradingStats {
  const closedTrades = trades.filter(trade => trade.status === 'CLOSED');

  if (closedTrades.length === 0) {
    return {
      closedTrades: 0,
      winRate: 0,
      expectancyR: 0,
      profitFactor: 0,
      maxDrawdownUsd: 0,
      netPnlUsd: 0
    };
  }

  const wins = closedTrades.filter(trade => (trade.pnlUsd ?? 0) > 0);
  const grossProfit = closedTrades
    .filter(trade => (trade.pnlUsd ?? 0) > 0)
    .reduce((sum, trade) => sum + (trade.pnlUsd ?? 0), 0);
  const grossLoss = Math.abs(closedTrades
    .filter(trade => (trade.pnlUsd ?? 0) < 0)
    .reduce((sum, trade) => sum + (trade.pnlUsd ?? 0), 0));
  const netPnlUsd = closedTrades.reduce((sum, trade) => sum + (trade.pnlUsd ?? 0), 0);
  const expectancyR = closedTrades.reduce((sum, trade) => sum + (trade.rMultiple ?? 0), 0) / closedTrades.length;

  return {
    closedTrades: closedTrades.length,
    winRate: round((wins.length / closedTrades.length) * 100, 2),
    expectancyR: round(expectancyR, 2),
    profitFactor: grossLoss === 0 ? Number.POSITIVE_INFINITY : round(grossProfit / grossLoss, 2),
    maxDrawdownUsd: round(computeMaxDrawdown(closedTrades), 2),
    netPnlUsd: round(netPnlUsd, 2)
  };
}

export function computePaperReadiness(input: PaperReadinessInput): PaperReadinessReport {
  const issues: PaperReadinessIssue[] = [];
  const minClosedTrades = input.minClosedTrades ?? 50;
  const maxDrawdownPercent = input.maxDrawdownPercent ?? 10;
  const minProfitFactor = input.minProfitFactor ?? 1.2;
  const drawdownPercent = input.accountEquity > 0
    ? round((input.stats.maxDrawdownUsd / input.accountEquity) * 100, 2)
    : 100;

  if (input.stats.closedTrades < minClosedTrades) {
    issues.push({
      code: 'PAPER_SAMPLE_TOO_SMALL',
      severity: 'ERROR',
      message: `Need at least ${minClosedTrades} closed paper trades.`
    });
  }

  if (input.stats.expectancyR <= 0) {
    issues.push({
      code: 'PAPER_EXPECTANCY_NOT_POSITIVE',
      severity: 'ERROR',
      message: 'Paper expectancy must be positive in R.'
    });
  }

  if (drawdownPercent > maxDrawdownPercent) {
    issues.push({
      code: 'PAPER_DRAWDOWN_EXCEEDED',
      severity: 'ERROR',
      message: `Paper drawdown exceeds ${maxDrawdownPercent}%.`
    });
  }

  if (input.stats.profitFactor < minProfitFactor) {
    issues.push({
      code: 'PAPER_PROFIT_FACTOR_LOW',
      severity: 'WARNING',
      message: `Paper profit factor is below ${minProfitFactor}.`
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR')
      ? 'BLOCK'
      : issues.some(issue => issue.severity === 'WARNING')
        ? 'REVIEW'
        : 'PASS',
    drawdownPercent,
    issues
  };
}

function calculatePnlUsd(trade: PaperTrade, exitPrice: number): number {
  if (trade.side === 'LONG') {
    return (exitPrice - trade.entry) * trade.sizeUnits;
  }

  return (trade.entry - exitPrice) * trade.sizeUnits;
}

function computeMaxDrawdown(trades: PaperTrade[]): number {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const trade of trades) {
    equity += trade.pnlUsd ?? 0;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  return maxDrawdown;
}

function buildPaperTradeId(plan: PaperTradePlan): string {
  const openedAt = new Date(plan.openedAt).getTime();
  const timestampPart = Number.isFinite(openedAt)
    ? openedAt.toString(36)
    : sanitizeIdPart(plan.openedAt);

  return `paper-${sanitizeIdPart(plan.symbol)}-${plan.side}-${timestampPart}`;
}

function assertValidPlan(plan: PaperTradePlan): void {
  const values = [plan.entry, plan.stopLoss, plan.takeProfit, plan.sizeUnits];
  if (!values.every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Paper trade plan must contain positive entry, stop, target, and size.');
  }

  if (plan.side === 'LONG' && !(plan.stopLoss < plan.entry && plan.takeProfit > plan.entry)) {
    throw new Error('Long paper trade geometry is invalid.');
  }

  if (plan.side === 'SHORT' && !(plan.stopLoss > plan.entry && plan.takeProfit < plan.entry)) {
    throw new Error('Short paper trade geometry is invalid.');
  }
}

function sanitizeIdPart(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
