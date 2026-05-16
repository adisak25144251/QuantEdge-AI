import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOpsMonitoringV2 } from './opsMonitoringV2';

describe('opsMonitoringV2', () => {
  it('passes healthy latency, uptime, quota, incidents, and release controls', () => {
    const report = evaluateOpsMonitoringV2({
      dataLatencyMs: 250,
      endpointUptimePercent: 99.95,
      apiQuotaUsedPercent: 42,
      openSevIncidents: 0,
      releaseChecklistStatus: 'PASS'
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.opsReady, true);
  });

  it('blocks outage and severe incident conditions', () => {
    const report = evaluateOpsMonitoringV2({
      dataLatencyMs: 7_000,
      endpointUptimePercent: 97,
      apiQuotaUsedPercent: 96,
      openSevIncidents: 1,
      releaseChecklistStatus: 'BLOCK'
    });

    assert.equal(report.status, 'BLOCK');
    assert.equal(report.opsReady, false);
  });
});
