export type PortfolioRiskStatusV2 = 'PASS' | 'REVIEW' | 'BLOCK';

export interface PortfolioRiskInputV2 {
  sectorExposurePercent: number;
  betaExposure: number;
  correlatedExposurePercent: number;
  volatilityTargetPercent: number;
  projectedDailyLossPercent: number;
  projectedWeeklyLossPercent: number;
}

export interface PortfolioRiskReportV2 {
  status: PortfolioRiskStatusV2;
  riskBudgetUsedPercent: number;
  issues: { code: string; detail: string }[];
}

export function evaluatePortfolioRiskV2(input: PortfolioRiskInputV2): PortfolioRiskReportV2 {
  const issues: { code: string; detail: string }[] = [];
  if (input.sectorExposurePercent > 35) issues.push({ code: 'SECTOR_CONCENTRATION_HIGH', detail: 'Sector exposure exceeds 35%.' });
  if (input.betaExposure > 1.6) issues.push({ code: 'BETA_EXPOSURE_HIGH', detail: 'Beta exposure exceeds 1.6.' });
  if (input.correlatedExposurePercent > 50) issues.push({ code: 'CORRELATION_CLUSTER_HIGH', detail: 'Correlated exposure exceeds 50%.' });
  if (input.volatilityTargetPercent > 22) issues.push({ code: 'VOLATILITY_TARGET_HIGH', detail: 'Volatility target exceeds 22%.' });
  if (input.projectedDailyLossPercent > 2.5) issues.push({ code: 'DAILY_LOSS_LIMIT_EXCEEDED', detail: 'Projected daily loss exceeds 2.5%.' });
  if (input.projectedWeeklyLossPercent > 6) issues.push({ code: 'WEEKLY_LOSS_LIMIT_EXCEEDED', detail: 'Projected weekly loss exceeds 6%.' });

  const budgetParts = [
    input.sectorExposurePercent / 35,
    input.betaExposure / 1.6,
    input.correlatedExposurePercent / 50,
    input.volatilityTargetPercent / 22,
    input.projectedDailyLossPercent / 2.5,
    input.projectedWeeklyLossPercent / 6
  ];
  const riskBudgetUsedPercent = Math.round((budgetParts.reduce((sum, value) => sum + value, 0) / budgetParts.length) * 100);
  const blocking = issues.some((issue) => issue.code.includes('LIMIT_EXCEEDED') || issue.code === 'CORRELATION_CLUSTER_HIGH');

  return {
    status: blocking ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    riskBudgetUsedPercent,
    issues
  };
}
