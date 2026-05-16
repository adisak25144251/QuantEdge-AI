import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGateAlerts } from './alertPolicy';

test('buildGateAlerts emits only actionable review and block alerts', () => {
  const alerts = buildGateAlerts([
    { area: 'risk', code: 'RISK_PASS', status: 'PASS', detail: 'Ok.' },
    { area: 'data', code: 'STALE_DATA', status: 'REVIEW', detail: 'Data is stale.' },
    { area: 'live', code: 'CLIENT_EVIDENCE_REQUIRED', status: 'BLOCK', detail: 'Evidence missing.' }
  ]);

  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].severity, 'CRITICAL');
  assert.equal(alerts[0].code, 'CLIENT_EVIDENCE_REQUIRED');
  assert.equal(alerts[1].severity, 'WARNING');
});
