import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildProfessionalAuditReportV2 } from './professionalAuditReportV2';

describe('professionalAuditReportV2', () => {
  it('combines setup, risk, benchmark, data, and decision trail into one audit report', () => {
    const report = buildProfessionalAuditReportV2({
      title: 'NVDA Institutional Review',
      symbol: 'NVDA',
      statuses: {
        setup: 'PASS',
        risk: 'PASS',
        benchmark: 'PASS',
        data: 'PASS',
        decisionTrail: 'PASS'
      },
      generatedAt: '2026-05-10T00:00:00.000Z'
    });

    assert.equal(report.status, 'PASS');
    assert(report.markdown.includes('Decision Trail'));
  });
});
