export type UsStockTradingPlanInput = {
  ticker: string;
  price: number | null;
  marketCap: number | null;
  averageVolume: number | null;
  rsi: number | null;
  score: number;
  finalView: string;
  dailyScanStatus: 'PASS' | 'REVIEW' | 'BLOCK';
  smallCapGroup: string;
  smallCapRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  entryZone: string;
  stopLossZone: string;
  targetZone: string;
  riskReward: number | null;
  warnings: string[];
};

export type UsPortfolioSize = 500 | 1000 | 3000;

export type UsStockPositionSize = {
  portfolioValue: UsPortfolioSize;
  riskBudgetLow: number;
  riskBudgetHigh: number;
  allocationCapPercent: number;
  allocationCapDollars: number;
  shares: number | null;
  dollars: number | null;
  maxLossDollars: number | null;
};

export type UsStockTradingPlan = {
  ticker: string;
  entryTrigger: string;
  buyZone: string;
  stopLoss: string;
  target1: string;
  target2: string;
  riskReward: string;
  riskClass: 'Microcap' | 'Quality small-cap' | 'Speculative / review' | 'No entry';
  positionSizes: UsStockPositionSize[];
  addRule: string;
  takeProfitRule: string;
  cutLossRule: string;
  finalView: string;
};

const PORTFOLIOS: UsPortfolioSize[] = [500, 1000, 3000];

export function buildUsStockTradingPlan(input: UsStockTradingPlanInput): UsStockTradingPlan {
  const noEntry = isNoEntry(input);
  const entryPrice = input.price !== null && input.price > 0 ? round(input.price * 1.03) : null;
  const stopPrice = input.price !== null && input.price > 0 ? round(input.price * 0.92) : null;
  const target1 = input.price !== null && input.price > 0 ? round(input.price * 1.15) : null;
  const target2 = input.price !== null && input.price > 0 ? round(input.price * 1.3) : null;
  const perShareRisk = entryPrice !== null && stopPrice !== null ? round(entryPrice - stopPrice) : null;
  const allocationCapPercent = noEntry ? 0 : getAllocationCapPercent(input);

  return {
    ticker: input.ticker.toUpperCase(),
    entryTrigger: noEntry
      ? 'No Entry / Wait Pullback: setup is blocked, extended, or missing price data.'
      : `Close/retest above ${formatPrice(entryPrice)} with RVOL confirmation and no failed breakout.`,
    buyZone: input.price !== null && input.price > 0 ? `${formatPrice(input.price * 0.98)}-${formatPrice(input.price * 1.03)}` : 'Data required',
    stopLoss: stopPrice !== null ? `${formatPrice(stopPrice)} or below failed retest low` : 'Data required',
    target1: target1 !== null ? formatPrice(target1) : 'Data required',
    target2: target2 !== null ? formatPrice(target2) : 'Data required',
    riskReward: input.riskReward === null ? 'Data required' : `${input.riskReward.toFixed(2)}R`,
    riskClass: noEntry ? 'No entry' : classifyRisk(input),
    positionSizes: PORTFOLIOS.map(portfolioValue => buildPositionSize(portfolioValue, entryPrice, perShareRisk, allocationCapPercent, noEntry)),
    addRule: noEntry
      ? 'Do not add. Wait for a new base or clean retest first.'
      : 'Add only after breakout + retest holds, volume confirms, RSI is not overheated, and total exposure remains under allocation cap.',
    takeProfitRule: 'If profit rises 20-30% quickly, sell partial to recover risk or move stop to breakeven. Scale more at Target 1 and trail the rest toward Target 2.',
    cutLossRule: 'Sell if stop-loss breaks, breakout retest fails, or price loses SMA20/SMA50 with heavy selling volume. Never average down after stop-loss.',
    finalView: noEntry ? 'Wait Pullback / No Chase' : 'Conditional Plan / Wait Confirmation'
  };
}

function buildPositionSize(
  portfolioValue: UsPortfolioSize,
  entryPrice: number | null,
  perShareRisk: number | null,
  allocationCapPercent: number,
  noEntry: boolean
): UsStockPositionSize {
  const riskBudgetLow = roundMoney(portfolioValue * 0.01);
  const riskBudgetHigh = roundMoney(portfolioValue * 0.02);
  const allocationCapDollars = roundMoney(portfolioValue * allocationCapPercent);

  if (noEntry || entryPrice === null || perShareRisk === null || perShareRisk <= 0) {
    return {
      portfolioValue,
      riskBudgetLow,
      riskBudgetHigh,
      allocationCapPercent,
      allocationCapDollars,
      shares: null,
      dollars: null,
      maxLossDollars: null
    };
  }

  const riskBasedShares = Math.floor(riskBudgetLow / perShareRisk);
  const capBasedShares = Math.floor(allocationCapDollars / entryPrice);
  const shares = Math.max(0, Math.min(riskBasedShares, capBasedShares));
  return {
    portfolioValue,
    riskBudgetLow,
    riskBudgetHigh,
    allocationCapPercent,
    allocationCapDollars,
    shares,
    dollars: roundMoney(shares * entryPrice),
    maxLossDollars: roundMoney(shares * perShareRisk)
  };
}

function isNoEntry(input: UsStockTradingPlanInput): boolean {
  return input.price === null
    || input.dailyScanStatus === 'BLOCK'
    || input.finalView === 'Avoid'
    || input.rsi !== null && input.rsi > 85
    || input.warnings.some(warning => /ไม่ควรไล่ราคา|RSI above 85|Avoid/i.test(warning));
}

function classifyRisk(input: UsStockTradingPlanInput): UsStockTradingPlan['riskClass'] {
  if (input.marketCap !== null && input.marketCap < 300_000_000) return 'Microcap';
  if (input.smallCapRiskLevel === 'LOW' && input.score >= 70) return 'Quality small-cap';
  return 'Speculative / review';
}

function getAllocationCapPercent(input: UsStockTradingPlanInput): number {
  const riskClass = classifyRisk(input);
  if (riskClass === 'Microcap') return 0.02;
  if (riskClass === 'Quality small-cap') return 0.05;
  return 0.03;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function formatPrice(value: number | null): string {
  return value === null || !Number.isFinite(value) ? 'Data required' : `$${value.toFixed(2)}`;
}
