import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSystemHealth } from './systemHealth';

test('evaluateSystemHealth passes when required services are healthy and live trading remains locked', () => {
  const health = evaluateSystemHealth({
    aiBackendConfigured: true,
    marketDataProxyHealthy: true,
    liveTradingLocked: true,
    securityHeadersEnabled: true,
    uptimeSeconds: 120
  });

  assert.equal(health.status, 'PASS');
  assert.equal(health.checks.every(check => check.status === 'PASS'), true);
});

test('evaluateSystemHealth blocks if live trading is unlocked without approval', () => {
  const health = evaluateSystemHealth({
    aiBackendConfigured: true,
    marketDataProxyHealthy: true,
    liveTradingLocked: false,
    securityHeadersEnabled: true,
    uptimeSeconds: 120
  });

  assert.equal(health.status, 'BLOCK');
  assert.ok(health.checks.some(check => check.code === 'LIVE_TRADING_LOCK'));
});
