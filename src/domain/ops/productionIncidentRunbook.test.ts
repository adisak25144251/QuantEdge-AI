import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionIncidentRunbook } from './productionIncidentRunbook';

describe('productionIncidentRunbook', () => {
  it('creates a passing runbook for a resolved incident with owner and rollback', () => {
    const runbook = buildProductionIncidentRunbook({
      incidents: [
        {
          id: 'inc-1',
          severity: 'SEV2',
          status: 'RESOLVED',
          owner: 'ops',
          openedAt: '2026-05-10T00:00:00.000Z',
          resolvedAt: '2026-05-10T00:30:00.000Z',
          rollbackPlan: 'Disable connector and revert release.',
          customerImpact: false
        }
      ],
      maxOpenSev2: 0,
      maxResolutionMinutes: 60
    });

    assert.equal(runbook.status, 'PASS');
    assert.equal(runbook.openIncidents, 0);
  });

  it('blocks unresolved severe incidents without ownership or rollback', () => {
    const runbook = buildProductionIncidentRunbook({
      incidents: [
        {
          id: 'inc-2',
          severity: 'SEV1',
          status: 'OPEN',
          owner: '',
          openedAt: '2026-05-10T00:00:00.000Z',
          resolvedAt: null,
          rollbackPlan: '',
          customerImpact: true
        }
      ],
      now: Date.parse('2026-05-10T02:00:00.000Z')
    });

    assert.equal(runbook.status, 'BLOCK');
    assert.equal(runbook.openIncidents, 1);
    assert(runbook.issues.some(issue => issue.code === 'SEVERE_INCIDENT_OPEN'));
    assert(runbook.issues.some(issue => issue.code === 'INCIDENT_OWNER_MISSING'));
    assert(runbook.issues.some(issue => issue.code === 'ROLLBACK_PLAN_MISSING'));
  });
});
