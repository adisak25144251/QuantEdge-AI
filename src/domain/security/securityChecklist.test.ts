import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSecurityChecklist } from './securityChecklist';

test('evaluateSecurityChecklist passes hardened manual-only deployment posture', () => {
  const report = evaluateSecurityChecklist({
    serverSideAiKey: true,
    clientSecretExposure: false,
    rateLimitEnabled: true,
    payloadValidation: true,
    securityHeadersEnabled: true,
    apiTradingDisabled: true
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.issues.length, 0);
});

test('evaluateSecurityChecklist blocks client secret exposure and API trading', () => {
  const report = evaluateSecurityChecklist({
    serverSideAiKey: false,
    clientSecretExposure: true,
    rateLimitEnabled: false,
    payloadValidation: true,
    securityHeadersEnabled: false,
    apiTradingDisabled: false
  });

  assert.equal(report.status, 'BLOCK');
  assert.ok(report.issues.some(issue => issue.code === 'CLIENT_SECRET_EXPOSURE'));
  assert.ok(report.issues.some(issue => issue.code === 'API_TRADING_NOT_DISABLED'));
});
