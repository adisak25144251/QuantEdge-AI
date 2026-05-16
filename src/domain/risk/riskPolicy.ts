export type TradeSide = 'LONG' | 'SHORT';
export type RiskPolicyStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type RiskPolicyIssueSeverity = 'INFO' | 'WARNING' | 'ERROR';

export interface RiskPolicyIssue {
  code: string;
  severity: RiskPolicyIssueSeverity;
  message: string;
}

export interface TradeGeometry {
  side: TradeSide;
  entry: number;
  stopLoss: number;
  takeProfit: number;
}

export interface TradeRiskInput extends TradeGeometry {
  accountEquity: number;
  riskPercent: number;
  openRiskPercent?: number;
  dailyRealizedLossPercent?: number;
  maxRiskPerTradePercent?: number;
  maxPortfolioHeatPercent?: number;
  maxDailyLossPercent?: number;
  minRewardRisk?: number;
  manualConfirmation?: boolean;
}

export interface TradeRiskResult {
  status: RiskPolicyStatus;
  issues: RiskPolicyIssue[];
  rewardRisk: number | null;
  riskAmountUsd: number;
  positionSizeUnits: number;
  positionSizeUsd: number;
}

export function calculateRewardRisk(input: TradeGeometry): number | null {
  if (!hasValidGeometry(input)) return null;

  const risk = Math.abs(input.entry - input.stopLoss);
  const reward = Math.abs(input.takeProfit - input.entry);
  if (risk === 0) return null;

  return round(reward / risk, 2);
}

export function evaluateTradeRisk(input: TradeRiskInput): TradeRiskResult {
  const issues: RiskPolicyIssue[] = [];
  const maxRiskPerTradePercent = input.maxRiskPerTradePercent ?? 2;
  const maxPortfolioHeatPercent = input.maxPortfolioHeatPercent ?? 6;
  const maxDailyLossPercent = input.maxDailyLossPercent ?? 4;
  const minRewardRisk = input.minRewardRisk ?? 1.6;
  const openRiskPercent = input.openRiskPercent ?? 0;
  const dailyRealizedLossPercent = input.dailyRealizedLossPercent ?? 0;

  const numericValues = [
    input.entry,
    input.stopLoss,
    input.takeProfit,
    input.accountEquity,
    input.riskPercent
  ];

  if (!numericValues.every(value => Number.isFinite(value) && value > 0)) {
    issues.push({
      code: 'INVALID_NUMERIC_INPUT',
      severity: 'ERROR',
      message: 'Entry, stop, target, account equity, and risk percent must be positive numbers.'
    });
  }

  if (!hasValidGeometry(input)) {
    issues.push({
      code: 'INVALID_GEOMETRY',
      severity: 'ERROR',
      message: 'Stop loss and take profit must be on the correct sides of entry for the trade direction.'
    });
  }

  if (input.riskPercent > maxRiskPerTradePercent) {
    issues.push({
      code: 'RISK_PER_TRADE_EXCEEDED',
      severity: 'ERROR',
      message: `Risk per trade exceeds the ${maxRiskPerTradePercent}% policy limit.`
    });
  }

  if (openRiskPercent + input.riskPercent > maxPortfolioHeatPercent) {
    issues.push({
      code: 'PORTFOLIO_HEAT_EXCEEDED',
      severity: 'ERROR',
      message: `Open risk plus this trade exceeds the ${maxPortfolioHeatPercent}% portfolio heat limit.`
    });
  }

  if (dailyRealizedLossPercent >= maxDailyLossPercent) {
    issues.push({
      code: 'DAILY_LOSS_LIMIT_HIT',
      severity: 'ERROR',
      message: `Daily realized loss has reached the ${maxDailyLossPercent}% stop-trading limit.`
    });
  }

  const rewardRisk = calculateRewardRisk(input);
  if (rewardRisk !== null && rewardRisk < minRewardRisk) {
    issues.push({
      code: 'REWARD_RISK_TOO_LOW',
      severity: 'ERROR',
      message: `Reward/risk is below the ${minRewardRisk} minimum.`
    });
  }

  if (!input.manualConfirmation) {
    issues.push({
      code: 'MANUAL_CONFIRMATION_REQUIRED',
      severity: 'WARNING',
      message: 'A human review confirmation is required before recording the plan.'
    });
  }

  const hasError = issues.some(issue => issue.severity === 'ERROR');
  const status = hasError
    ? 'BLOCK'
    : issues.some(issue => issue.severity === 'WARNING')
      ? 'REVIEW'
      : 'PASS';

  if (hasError || rewardRisk === null) {
    return {
      status,
      issues,
      rewardRisk,
      riskAmountUsd: 0,
      positionSizeUnits: 0,
      positionSizeUsd: 0
    };
  }

  const riskAmountUsd = input.accountEquity * (input.riskPercent / 100);
  const priceRisk = Math.abs(input.entry - input.stopLoss);
  const positionSizeUnits = riskAmountUsd / priceRisk;
  const positionSizeUsd = positionSizeUnits * input.entry;

  return {
    status,
    issues,
    rewardRisk,
    riskAmountUsd: round(riskAmountUsd, 2),
    positionSizeUnits: round(positionSizeUnits, 8),
    positionSizeUsd: round(positionSizeUsd, 2)
  };
}

function hasValidGeometry(input: TradeGeometry): boolean {
  const values = [input.entry, input.stopLoss, input.takeProfit];
  if (!values.every(value => Number.isFinite(value) && value > 0)) return false;

  if (input.side === 'LONG') {
    return input.stopLoss < input.entry && input.takeProfit > input.entry;
  }

  return input.stopLoss > input.entry && input.takeProfit < input.entry;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
