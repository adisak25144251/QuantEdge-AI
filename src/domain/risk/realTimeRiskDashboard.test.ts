import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRealTimeRiskDashboard } from './realTimeRiskDashboard';

describe('realTimeRiskDashboard', () => {
  it('aggregates critical live gates into a single cockpit state', () => {
    const dashboard = buildRealTimeRiskDashboard({
      marketDataStatus: 'PASS',
      riskKillSwitchState: 'UNLOCKED',
      portfolioExposureStatus: 'PASS',
      modelDriftStatus: 'PASS',
      executionQualityStatus: 'PASS',
      dataRedundancyStatus: 'PASS',
      liveConnectorStatus: 'REVIEW',
      liveTradingLocked: true
    });

    assert.equal(dashboard.status, 'REVIEW');
    assert.equal(dashboard.realMoneySafe, true);
    assert.equal(dashboard.blockers, 0);
    assert.equal(dashboard.warnings, 1);
  });

  it('blocks when kill switch or live trading lock is unsafe', () => {
    const dashboard = buildRealTimeRiskDashboard({
      marketDataStatus: 'PASS',
      riskKillSwitchState: 'LOCKED',
      portfolioExposureStatus: 'PASS',
      modelDriftStatus: 'PASS',
      executionQualityStatus: 'PASS',
      dataRedundancyStatus: 'PASS',
      liveConnectorStatus: 'PASS',
      liveTradingLocked: false
    });

    assert.equal(dashboard.status, 'BLOCK');
    assert.equal(dashboard.realMoneySafe, false);
    assert(dashboard.issues.some(issue => issue.code === 'KILL_SWITCH_LOCKED'));
    assert(dashboard.issues.some(issue => issue.code === 'LIVE_TRADING_UNLOCKED'));
  });
});
