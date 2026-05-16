import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allocateCapital } from './capitalAllocationEngine';

describe('capitalAllocationEngine', () => {
  it('allocates more to healthy low-correlation strategies within total risk budget', () => {
    const report = allocateCapital({
      accountEquity: 100_000,
      maxTotalAllocationPercent: 30,
      strategies: [
        { id: 'trend', healthStatus: 'PASS', confidenceScore: 85, volatilityPercent: 1.2, correlationPenalty: 0.1, drawdownPercent: 4 },
        { id: 'range', healthStatus: 'REVIEW', confidenceScore: 65, volatilityPercent: 2, correlationPenalty: 0.3, drawdownPercent: 8 }
      ]
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.totalAllocatedPercent <= 30, true);
    assert.equal(report.allocations[0].strategyId, 'trend');
    assert(report.allocations[0].allocationUsd > report.allocations[1].allocationUsd);
  });

  it('blocks allocation when account equity is invalid or no strategy is allocatable', () => {
    const report = allocateCapital({
      accountEquity: 0,
      strategies: [
        { id: 'blocked', healthStatus: 'BLOCK', confidenceScore: 90, volatilityPercent: 1, correlationPenalty: 0, drawdownPercent: 1 }
      ]
    });

    assert.equal(report.status, 'BLOCK');
    assert.equal(report.totalAllocatedUsd, 0);
    assert(report.issues.some(issue => issue.code === 'INVALID_ACCOUNT_EQUITY'));
    assert(report.issues.some(issue => issue.code === 'NO_ALLOCATABLE_STRATEGY'));
  });
});
