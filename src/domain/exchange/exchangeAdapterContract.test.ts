import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExchangeAdapterContract } from './exchangeAdapterContract';

describe('exchangeAdapterContract', () => {
  it('passes a read-only testnet adapter with required capabilities', () => {
    const report = evaluateExchangeAdapterContract({
      adapterName: 'binance-testnet',
      environment: 'TESTNET',
      capabilities: ['MARKET_DATA', 'BALANCE_READ', 'ORDER_SIMULATION'],
      readOnly: true,
      canPlaceRealOrders: false,
      supportsIdempotency: true,
      supportsRateLimitBackoff: true,
      supportsKillSwitch: true
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.executionMode, 'SIMULATION_ONLY');
    assert.deepEqual(report.issues, []);
  });

  it('blocks production or real-order adapters until separate approval exists', () => {
    const report = evaluateExchangeAdapterContract({
      adapterName: 'prod',
      environment: 'PRODUCTION',
      capabilities: ['MARKET_DATA', 'ORDER_PLACE'],
      readOnly: false,
      canPlaceRealOrders: true,
      supportsIdempotency: false,
      supportsRateLimitBackoff: false,
      supportsKillSwitch: false
    });

    assert.equal(report.status, 'BLOCK');
    assert.equal(report.executionMode, 'BLOCKED');
    assert(report.issues.some(issue => issue.code === 'REAL_ORDER_CAPABILITY_BLOCKED'));
    assert(report.issues.some(issue => issue.code === 'PRODUCTION_ADAPTER_BLOCKED'));
  });
});
