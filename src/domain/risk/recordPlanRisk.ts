import type { CandidateExposure, TradeSide } from './portfolioRisk';
import type { TradeRiskResult } from './riskPolicy';

export interface RecordPlanCandidateInput {
  symbol: string;
  side: TradeSide;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskDecision: TradeRiskResult;
  maxPositionUsd?: number;
}

export interface RecordPlanPolicyInput {
  requestedRiskPercent: number;
  accountEquity: number;
  currentPortfolioHeatPercent: number;
  sameDirectionExposureUsd: number;
  maxRiskPerTradePercent?: number;
  maxPortfolioHeatPercent?: number;
  maxSameDirectionExposurePercent?: number;
}

export interface RecordPlanPolicyLimits {
  riskPercent: number;
  maxPositionUsd: number;
  remainingHeatPercent: number;
  remainingSameDirectionExposureUsd: number;
}

export function buildRecordPlanCandidateExposure(input: RecordPlanCandidateInput): CandidateExposure {
  const canUseRiskSizing = input.riskDecision.status !== 'BLOCK';
  const riskSizedUnits = canUseRiskSizing ? safeNumber(input.riskDecision.positionSizeUnits) : 0;
  const riskSizedUsd = canUseRiskSizing ? safeNumber(input.riskDecision.positionSizeUsd) : 0;
  const cappedUsd = capPositionUsd(riskSizedUsd, input.maxPositionUsd);
  const cappedUnits = input.entry > 0 && cappedUsd < riskSizedUsd
    ? cappedUsd / input.entry
    : riskSizedUnits;

  return {
    symbol: input.symbol,
    side: input.side,
    entry: input.entry,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    sizeUnits: round(cappedUnits, 8),
    sizeUsd: round(cappedUsd, 2)
  };
}

export function buildRecordPlanPolicyLimits(input: RecordPlanPolicyInput): RecordPlanPolicyLimits {
  const maxRiskPerTradePercent = input.maxRiskPerTradePercent ?? 2;
  const maxPortfolioHeatPercent = input.maxPortfolioHeatPercent ?? 6;
  const maxSameDirectionExposurePercent = input.maxSameDirectionExposurePercent ?? 60;
  const remainingHeatPercent = Math.max(0, maxPortfolioHeatPercent - safeNumber(input.currentPortfolioHeatPercent));
  const remainingSameDirectionExposureUsd = Math.max(
    0,
    safeNumber(input.accountEquity) * (maxSameDirectionExposurePercent / 100) - safeNumber(input.sameDirectionExposureUsd)
  );
  const riskPercent = Math.min(
    safeNumber(input.requestedRiskPercent),
    maxRiskPerTradePercent,
    remainingHeatPercent
  );

  return {
    riskPercent: round(riskPercent, 4),
    maxPositionUsd: round(remainingSameDirectionExposureUsd, 2),
    remainingHeatPercent: round(remainingHeatPercent, 4),
    remainingSameDirectionExposureUsd: round(remainingSameDirectionExposureUsd, 2)
  };
}

function safeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function capPositionUsd(positionUsd: number, maxPositionUsd?: number): number {
  const max = Number.isFinite(maxPositionUsd) && Number(maxPositionUsd) > 0
    ? Number(maxPositionUsd)
    : Number.POSITIVE_INFINITY;
  return Math.min(positionUsd, max);
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
