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
