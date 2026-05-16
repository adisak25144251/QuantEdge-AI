export type KillSwitchState = 'UNLOCKED' | 'LOCKED';
export type GateStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface RiskKillSwitchInput {
  dailyPnlPercent: number;
  currentDrawdownPercent: number;
  consecutiveLosses: number;
  marketDataStatus: GateStatus;
  aiBackendAvailable: boolean;
  volatilityShockPercent: number;
  liveTradingLocked: boolean;
  maxDailyLossPercent?: number;
  maxDrawdownPercent?: number;
  maxConsecutiveLosses?: number;
  maxVolatilityShockPercent?: number;
}

export interface KillSwitchTrigger {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface RiskKillSwitchResult {
  state: KillSwitchState;
  canRecordPlan: boolean;
  triggers: KillSwitchTrigger[];
}

export function evaluateRiskKillSwitch(input: RiskKillSwitchInput): RiskKillSwitchResult {
  const triggers: KillSwitchTrigger[] = [];
  const maxDailyLossPercent = input.maxDailyLossPercent ?? 3;
  const maxDrawdownPercent = input.maxDrawdownPercent ?? 7;
  const maxConsecutiveLosses = input.maxConsecutiveLosses ?? 4;
  const maxVolatilityShockPercent = input.maxVolatilityShockPercent ?? 4;

  if (input.dailyPnlPercent <= -maxDailyLossPercent) {
    triggers.push({ code: 'DAILY_LOSS_LIMIT', severity: 'ERROR', message: `Daily loss exceeds ${maxDailyLossPercent}%.` });
  }
  if (input.currentDrawdownPercent >= maxDrawdownPercent) {
    triggers.push({ code: 'DRAWDOWN_LIMIT', severity: 'ERROR', message: `Drawdown exceeds ${maxDrawdownPercent}%.` });
  }
  if (input.consecutiveLosses >= maxConsecutiveLosses) {
    triggers.push({ code: 'LOSS_STREAK_LIMIT', severity: 'ERROR', message: `Loss streak reached ${maxConsecutiveLosses}.` });
  }
  if (input.marketDataStatus !== 'PASS') {
    triggers.push({ code: 'MARKET_DATA_NOT_CLEAN', severity: 'ERROR', message: 'Market data must pass before new plans are recorded.' });
  }
  if (!input.aiBackendAvailable) {
    triggers.push({ code: 'AI_BACKEND_UNAVAILABLE', severity: 'WARNING', message: 'AI backend is unavailable; manual evidence review is required.' });
  }
  if (input.volatilityShockPercent >= maxVolatilityShockPercent) {
    triggers.push({ code: 'VOLATILITY_SHOCK', severity: 'ERROR', message: `Volatility shock exceeds ${maxVolatilityShockPercent}%.` });
  }
  if (!input.liveTradingLocked) {
    triggers.push({ code: 'LIVE_TRADING_UNLOCKED', severity: 'ERROR', message: 'Live API trading lock must stay enabled.' });
  }

  const state = triggers.some(trigger => trigger.severity === 'ERROR') ? 'LOCKED' : 'UNLOCKED';
  return {
    state,
    canRecordPlan: state === 'UNLOCKED',
    triggers
  };
}
