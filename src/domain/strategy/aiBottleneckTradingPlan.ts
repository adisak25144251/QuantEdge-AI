export type AiBottleneckTradingPlanInput = {
  ticker: string;
  price: number | null;
  marketCap: number | null;
  averageVolume: number | null;
  relativeVolume: number | null;
  rsi: number | null;
  score: number;
  group: string;
  issues: string[];
  pattern: string;
  entryZone: string;
  stopLossZone: string;
  targetZone: string;
  riskReward: number | null;
  backlogOrContract: string;
  revenueGrowth: number | null;
  cashDebtProfile: string;
};

export type PortfolioSize = 500 | 1000 | 3000 | 10000;

export type PositionSizePlan = {
  portfolioValue: PortfolioSize;
  riskBudget: number;
  allocationCapPercent: number;
  allocationCapDollars: number;
  shares: number | null;
  dollars: number | null;
  maxLossDollars: number | null;
};

export type AiBottleneckTradingPlan = {
  ticker: string;
  entryTrigger: string;
  buyZone: string;
  stopLoss: string;
  target1: string;
  target2: string;
  riskReward: string;
  allocationClass: 'Microcap / high speculative' | 'Speculative small-cap' | 'Quality small-cap' | 'No entry';
  riskLevel: 'Low-Medium' | 'Medium' | 'Medium-High' | 'High' | 'No Entry';
  positionSizes: PositionSizePlan[];
  addRule: string;
  takeProfitRule: string;
  cutLossRule: string;
  thesisBreak: string;
  finalView: string;
};

const PORTFOLIOS: PortfolioSize[] = [500, 1000, 3000, 10000];
const RISK_PER_TRADE = 0.01;

export function buildAiBottleneckTradingPlan(input: AiBottleneckTradingPlanInput): AiBottleneckTradingPlan {
  const noEntry = isNoEntry(input);
  const allocationCapPercent = noEntry ? 0 : getAllocationCapPercent(input);
  const entryPrice = input.price !== null && input.price > 0 ? roundPrice(input.price * 1.03) : null;
  const stopPrice = input.price !== null && input.price > 0 ? roundPrice(input.price * 0.92) : null;
  const target1Price = input.price !== null && input.price > 0 ? roundPrice(input.price * 1.18) : null;
  const target2Price = input.price !== null && input.price > 0 ? roundPrice(input.price * 1.35) : null;
  const perShareRisk = entryPrice !== null && stopPrice !== null ? roundPrice(entryPrice - stopPrice) : null;

  return {
    ticker: input.ticker.toUpperCase(),
    entryTrigger: noEntry
      ? 'No Entry / Wait New Base: RSI or extension risk is too high.'
      : `Conditional breakout/retest above ${formatPrice(entryPrice)} with volume confirmation and no failed retest.`,
    buyZone: input.price !== null && input.price > 0
      ? `${formatPrice(input.price * 0.98)}-${formatPrice(input.price * 1.04)}; wait confirmation, no chase.`
      : 'Data required',
    stopLoss: stopPrice !== null ? `${formatPrice(stopPrice)} or below failed retest low` : 'Data required',
    target1: target1Price !== null ? formatPrice(target1Price) : 'Data required',
    target2: target2Price !== null ? formatPrice(target2Price) : 'Data required',
    riskReward: input.riskReward !== null ? `${input.riskReward.toFixed(1)}R target framework` : 'Data required',
    allocationClass: noEntry ? 'No entry' : getAllocationClass(input),
    riskLevel: noEntry ? 'No Entry' : getRiskLevel(input),
    positionSizes: PORTFOLIOS.map(portfolioValue => buildPositionSize(portfolioValue, entryPrice, perShareRisk, allocationCapPercent, noEntry)),
    addRule: noEntry
      ? 'Do not add. Wait for a new base, RSI reset, and confirmed retest.'
      : 'Add only after breakout + successful retest, RVOL remains supportive, RSI stays below 85, and total position remains under allocation cap.',
    takeProfitRule: 'If profit accelerates 30-50% quickly, sell partial to recover risk or move stop to breakeven. Scale more at Target 1 and trail remainder toward Target 2.',
    cutLossRule: 'Sell if stop-loss breaks, retest fails, or price loses SMA50 with heavy selling volume. Never average down after stop-loss.',
    thesisBreak: buildThesisBreak(input),
    finalView: noEntry ? 'Wait New Base / No Chase' : 'Conditional Plan / Wait Confirmation'
  };
}

function buildPositionSize(
  portfolioValue: PortfolioSize,
  entryPrice: number | null,
  perShareRisk: number | null,
  allocationCapPercent: number,
  noEntry: boolean
): PositionSizePlan {
  const riskBudget = roundMoney(portfolioValue * RISK_PER_TRADE);
  const allocationCapDollars = roundMoney(portfolioValue * allocationCapPercent);

  if (noEntry || entryPrice === null || perShareRisk === null || perShareRisk <= 0) {
    return {
      portfolioValue,
      riskBudget,
      allocationCapPercent,
      allocationCapDollars,
      shares: null,
      dollars: null,
      maxLossDollars: null
    };
  }

  const riskBasedShares = Math.floor(riskBudget / perShareRisk);
  const capBasedShares = Math.floor(allocationCapDollars / entryPrice);
  const shares = Math.max(0, Math.min(riskBasedShares, capBasedShares));
  const dollars = roundMoney(shares * entryPrice);
  const maxLossDollars = roundMoney(shares * perShareRisk);

  return {
    portfolioValue,
    riskBudget,
    allocationCapPercent,
    allocationCapDollars,
    shares,
    dollars,
    maxLossDollars
  };
}

function isNoEntry(input: AiBottleneckTradingPlanInput): boolean {
  return input.price === null
    || input.rsi !== null && input.rsi > 85
    || input.issues.includes('TOO_EXTENDED_WAIT_FOR_BASE')
    || input.issues.includes('MONTHLY_RUNUP_OVER_100_NO_BASE')
    || /Avoid|Too Extended/i.test(input.group);
}

function getAllocationClass(input: AiBottleneckTradingPlanInput): AiBottleneckTradingPlan['allocationClass'] {
  if ((input.marketCap !== null && input.marketCap < 300_000_000) || input.issues.includes('DILUTION_RISK_HIGH')) {
    return 'Microcap / high speculative';
  }
  if (/Speculative/i.test(input.group) || input.cashDebtProfile === 'LEVERED' || input.score < 65) {
    return 'Speculative small-cap';
  }
  return 'Quality small-cap';
}

function getAllocationCapPercent(input: AiBottleneckTradingPlanInput): number {
  const allocationClass = getAllocationClass(input);
  if (allocationClass === 'Microcap / high speculative') return 0.02;
  if (allocationClass === 'Speculative small-cap') return 0.03;
  return 0.05;
}

function getRiskLevel(input: AiBottleneckTradingPlanInput): AiBottleneckTradingPlan['riskLevel'] {
  if ((input.marketCap !== null && input.marketCap < 300_000_000) || input.issues.includes('DILUTION_RISK_HIGH')) return 'High';
  if (/Speculative/i.test(input.group) || input.cashDebtProfile === 'LEVERED') return 'Medium-High';
  if (input.score >= 75 && input.averageVolume !== null && input.averageVolume >= 500_000) return 'Medium';
  return 'Medium-High';
}

function buildThesisBreak(input: AiBottleneckTradingPlanInput): string {
  const evidence = input.revenueGrowth === null
    ? 'revenue/backlog evidence remains missing'
    : 'revenue, backlog, or margin trend stops confirming the AI infrastructure thesis';
  return `${evidence}; dilution or cash burn worsens; catalyst fails; or price structure breaks below SMA50/support with selling volume.`;
}

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function formatPrice(value: number | null): string {
  return value === null || !Number.isFinite(value) ? 'Data required' : `$${value.toFixed(2)}`;
}
