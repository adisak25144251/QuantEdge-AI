import type { CandidateExposure, TradeSide } from './portfolioRisk';
import type { TradeRiskResult } from './riskPolicy';

export interface RecordPlanCandidateInput {
  symbol: string;
  side: TradeSide;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskDecision: TradeRiskResult;
}

export function buildRecordPlanCandidateExposure(input: RecordPlanCandidateInput): CandidateExposure {
  const canUseRiskSizing = input.riskDecision.status !== 'BLOCK';

  return {
    symbol: input.symbol,
    side: input.side,
    entry: input.entry,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    sizeUnits: canUseRiskSizing ? safeNumber(input.riskDecision.positionSizeUnits) : 0,
    sizeUsd: canUseRiskSizing ? safeNumber(input.riskDecision.positionSizeUsd) : 0
  };
}

function safeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
