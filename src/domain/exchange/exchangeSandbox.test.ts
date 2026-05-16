import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateExchangeSandbox } from './exchangeSandbox';

test('evaluateExchangeSandbox allows read-only sandbox observation', () => {
  const report = evaluateExchangeSandbox({
    readOnlyKeyConfigured: true,
    tradingPermissionDetected: false,
    balancesConnected: true,
    orderPlacementEnabled: false
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.mode, 'READ_ONLY_SANDBOX');
});

test('evaluateExchangeSandbox blocks any detected trading permission', () => {
  const report = evaluateExchangeSandbox({
    readOnlyKeyConfigured: true,
    tradingPermissionDetected: true,
    balancesConnected: true,
    orderPlacementEnabled: false
  });

  assert.equal(report.status, 'BLOCK');
  assert.ok(report.issues.some(issue => issue.code === 'TRADING_PERMISSION_DETECTED'));
});
