import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLiveTradingSandboxConnector } from './liveTradingSandboxConnector';

describe('liveTradingSandboxConnector', () => {
  it('passes testnet simulation with read-only live permissions and order placement locked', () => {
    const report = evaluateLiveTradingSandboxConnector({
      environment: 'TESTNET',
      readOnlyKeyConfigured: true,
      tradingPermissionDetected: false,
      simulatedOrdersEnabled: true,
      realOrderPlacementEnabled: false,
      latestHeartbeatMs: 250,
      lastFillSimulationAt: '2026-05-10T00:00:00.000Z'
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.connectorMode, 'TESTNET_SIMULATION');
    assert.equal(report.realMoneyLocked, true);
    assert.deepEqual(report.issues, []);
  });

  it('blocks any real order placement or production trading permission', () => {
    const report = evaluateLiveTradingSandboxConnector({
      environment: 'PRODUCTION',
      readOnlyKeyConfigured: true,
      tradingPermissionDetected: true,
      simulatedOrdersEnabled: true,
      realOrderPlacementEnabled: true,
      latestHeartbeatMs: 250,
      lastFillSimulationAt: '2026-05-10T00:00:00.000Z'
    });

    assert.equal(report.status, 'BLOCK');
    assert.equal(report.realMoneyLocked, true);
    assert(report.issues.some(issue => issue.code === 'REAL_ORDER_PLACEMENT_BLOCKED'));
    assert(report.issues.some(issue => issue.code === 'PRODUCTION_CONNECTOR_NOT_ALLOWED'));
  });
});
