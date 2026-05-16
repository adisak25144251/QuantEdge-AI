export type RiskDashboardStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type KillSwitchState = 'UNLOCKED' | 'LOCKED';

export interface RealTimeRiskDashboardInput {
  marketDataStatus: RiskDashboardStatus;
  riskKillSwitchState: KillSwitchState;
  portfolioExposureStatus: RiskDashboardStatus;
  modelDriftStatus: RiskDashboardStatus;
  executionQualityStatus: RiskDashboardStatus;
  dataRedundancyStatus: RiskDashboardStatus;
  liveConnectorStatus: RiskDashboardStatus;
  liveTradingLocked: boolean;
}

export interface RiskDashboardIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface RealTimeRiskDashboard {
  status: RiskDashboardStatus;
  realMoneySafe: boolean;
  blockers: number;
  warnings: number;
  issues: RiskDashboardIssue[];
}

export function buildRealTimeRiskDashboard(input: RealTimeRiskDashboardInput): RealTimeRiskDashboard {
  const issues: RiskDashboardIssue[] = [];

  addStatusIssue(issues, 'MARKET_DATA', input.marketDataStatus);
  addStatusIssue(issues, 'PORTFOLIO_EXPOSURE', input.portfolioExposureStatus);
  addStatusIssue(issues, 'MODEL_DRIFT', input.modelDriftStatus);
  addStatusIssue(issues, 'EXECUTION_QUALITY', input.executionQualityStatus);
  addStatusIssue(issues, 'DATA_REDUNDANCY', input.dataRedundancyStatus);
  addStatusIssue(issues, 'LIVE_CONNECTOR', input.liveConnectorStatus);

  if (input.riskKillSwitchState === 'LOCKED') {
    issues.push({
      code: 'KILL_SWITCH_LOCKED',
      severity: 'ERROR',
      message: 'Risk kill switch is locked.'
    });
  }

  if (!input.liveTradingLocked) {
    issues.push({
      code: 'LIVE_TRADING_UNLOCKED',
      severity: 'ERROR',
      message: 'Live trading must remain locked until an audited real-money phase.'
    });
  }

  const blockers = issues.filter(issue => issue.severity === 'ERROR').length;
  const warnings = issues.filter(issue => issue.severity === 'WARNING').length;

  return {
    status: blockers > 0 ? 'BLOCK' : warnings > 0 ? 'REVIEW' : 'PASS',
    realMoneySafe: input.liveTradingLocked && blockers === 0,
    blockers,
    warnings,
    issues
  };
}

function addStatusIssue(issues: RiskDashboardIssue[], area: string, status: RiskDashboardStatus): void {
  if (status === 'PASS') return;
  issues.push({
    code: `${area}_${status}`,
    severity: status === 'BLOCK' ? 'ERROR' : 'WARNING',
    message: `${area.toLowerCase().replaceAll('_', ' ')} status is ${status}.`
  });
}
