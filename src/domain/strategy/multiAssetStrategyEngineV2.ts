export type MultiAssetStrategyStatusV2 = 'PASS' | 'REVIEW' | 'BLOCK';
export type MultiAssetStrategyAssetV2 = 'CRYPTO' | 'US_STOCK' | 'ETF' | 'FOREX' | 'COMMODITY';

export interface MultiAssetStrategyInputV2 {
  assetType: MultiAssetStrategyAssetV2;
  regime: string;
  relativeStrengthPercent: number;
  volatilityPercent: number;
  dataStatus: MultiAssetStrategyStatusV2;
  riskStatus: MultiAssetStrategyStatusV2;
}

export interface MultiAssetStrategyDecisionV2 {
  status: MultiAssetStrategyStatusV2;
  strategyId: string | null;
  score: number;
  issues: string[];
}

export function selectMultiAssetStrategyV2(input: MultiAssetStrategyInputV2): MultiAssetStrategyDecisionV2 {
  const issues: string[] = [];
  if (input.dataStatus === 'BLOCK') issues.push('DATA_BLOCK');
  if (input.riskStatus === 'BLOCK') issues.push('RISK_BLOCK');
  if (input.volatilityPercent <= 0) issues.push('VOLATILITY_INVALID');

  if (issues.length > 0) {
    return { status: 'BLOCK', strategyId: null, score: 0, issues };
  }

  const regime = input.regime.toUpperCase();
  let strategyId = `${input.assetType}_DEFENSIVE_OBSERVATION`;
  let score = 55;

  if (input.assetType === 'US_STOCK' && regime.includes('TREND') && input.relativeStrengthPercent >= 3 && input.volatilityPercent <= 4) {
    strategyId = 'US_STOCK_RELATIVE_STRENGTH_BREAKOUT';
    score = 92;
  } else if (input.assetType === 'ETF' && regime.includes('TREND')) {
    strategyId = 'ETF_TREND_ALLOCATION';
    score = 86;
  } else if (input.assetType === 'CRYPTO' && regime.includes('TREND')) {
    strategyId = 'CRYPTO_VOLATILITY_ADJUSTED_MOMENTUM';
    score = 84;
  } else if (regime.includes('RANGE')) {
    strategyId = `${input.assetType}_MEAN_REVERSION_CONFIRMATION`;
    score = 76;
  }

  const status = input.dataStatus === 'REVIEW' || input.riskStatus === 'REVIEW' || score < 80 ? 'REVIEW' : 'PASS';
  return { status, strategyId, score, issues };
}
