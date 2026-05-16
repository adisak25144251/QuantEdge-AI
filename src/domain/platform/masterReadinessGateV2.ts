export type MasterGateStatusV2 = 'PASS' | 'REVIEW' | 'BLOCK';
export type MasterReadinessStageV2 =
  | 'NOT_READY'
  | 'RESEARCH_READY'
  | 'PAPER_READY'
  | 'SHADOW_READY'
  | 'SMALL_MANUAL_LIVE_READY';

export interface MasterReadinessGateInputV2 {
  dataStatus: MasterGateStatusV2;
  strategyStatus: MasterGateStatusV2;
  backtestStatus: MasterGateStatusV2;
  forwardStatus: MasterGateStatusV2;
  shadowStatus: MasterGateStatusV2;
  portfolioRiskStatus: MasterGateStatusV2;
  aiMemoStatus: MasterGateStatusV2;
  reportStatus: MasterGateStatusV2;
  opsStatus: MasterGateStatusV2;
  liveTradingLocked: boolean;
  apiTradingEnabled: boolean;
}

export interface MasterReadinessGateReportV2 {
  status: MasterGateStatusV2;
  stage: MasterReadinessStageV2;
  blockingCodes: string[];
  reviewCodes: string[];
}

const gateMap: Array<[keyof MasterReadinessGateInputV2, string]> = [
  ['dataStatus', 'DATA'],
  ['strategyStatus', 'STRATEGY'],
  ['backtestStatus', 'BACKTEST'],
  ['forwardStatus', 'FORWARD'],
  ['shadowStatus', 'SHADOW'],
  ['portfolioRiskStatus', 'PORTFOLIO_RISK'],
  ['aiMemoStatus', 'AI_MEMO'],
  ['reportStatus', 'REPORT'],
  ['opsStatus', 'OPS']
];

export function evaluateMasterReadinessGateV2(input: MasterReadinessGateInputV2): MasterReadinessGateReportV2 {
  const blockingCodes: string[] = [];
  const reviewCodes: string[] = [];

  for (const [field, code] of gateMap) {
    const value = input[field];
    if (value === 'BLOCK') blockingCodes.push(`${code}_BLOCK`);
    if (value === 'REVIEW') reviewCodes.push(`${code}_REVIEW`);
  }

  if (!input.liveTradingLocked) blockingCodes.push('LIVE_TRADING_UNLOCKED');
  if (input.apiTradingEnabled) blockingCodes.push('API_TRADING_UNLOCKED');

  if (blockingCodes.length > 0) {
    return { status: 'BLOCK', stage: 'NOT_READY', blockingCodes, reviewCodes };
  }

  if (reviewCodes.length > 0) {
    const stage = input.dataStatus === 'PASS' && input.strategyStatus === 'PASS' && input.backtestStatus === 'PASS'
      ? 'SHADOW_READY'
      : 'RESEARCH_READY';
    return { status: 'REVIEW', stage, blockingCodes, reviewCodes };
  }

  return {
    status: 'PASS',
    stage: 'SMALL_MANUAL_LIVE_READY',
    blockingCodes,
    reviewCodes
  };
}
