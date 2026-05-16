import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateDeploymentObservability } from './deploymentObservability';

test('evaluateDeploymentObservability passes observable production posture', () => {
  const report = evaluateDeploymentObservability({
    buildVersion: '2026.05.09-001',
    commitSha: 'abcdef123',
    structuredLogsEnabled: true,
    errorTrackingEnabled: true,
    uptimeMonitorEnabled: true,
    latencyP95Ms: 320,
    failingEndpointCount: 0,
    releaseChecklistCompleted: true
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.checks.every(check => check.status === 'PASS'), true);
});

test('evaluateDeploymentObservability blocks missing release controls and failing endpoints', () => {
  const report = evaluateDeploymentObservability({
    buildVersion: '',
    commitSha: '',
    structuredLogsEnabled: false,
    errorTrackingEnabled: false,
    uptimeMonitorEnabled: false,
    latencyP95Ms: 1800,
    failingEndpointCount: 2,
    releaseChecklistCompleted: false
  });

  assert.equal(report.status, 'BLOCK');
  assert.ok(report.checks.some(check => check.code === 'ENDPOINT_FAILURES'));
  assert.ok(report.checks.some(check => check.code === 'RELEASE_CHECKLIST'));
});
