import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePortfolioRiskV2 } from './portfolioRiskV2';

describe('portfolioRiskV2', () => {
  it('passes controlled sector, beta, correlation, volatility, and daily loss limits', () => {
    const report = evaluatePortfolioRiskV2({
      sectorExposurePercent: 18,
      betaExposure: 0.9,
      correlatedExposurePercent: 22,
      volatilityTargetPercent: 12,
      projectedDailyLossPercent: 1.2,
      projectedWeeklyLossPercent: 3
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.riskBudgetUsedPercent < 100, true);
  });

  it('blocks concentrated and loss-limit breaching portfolios', () => {
    const report = evaluatePortfolioRiskV2({
      sectorExposurePercent: 45,
      betaExposure: 2.1,
      correlatedExposurePercent: 65,
      volatilityTargetPercent: 30,
      projectedDailyLossPercent: 4,
      projectedWeeklyLossPercent: 9
    });

    assert.equal(report.status, 'BLOCK');
    assert(report.issues.some(issue => issue.code === 'DAILY_LOSS_LIMIT_EXCEEDED'));
  });
});
