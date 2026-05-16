import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildStrategyVersionRegistry } from './strategyVersionRegistry';

describe('strategyVersionRegistry', () => {
  it('selects the latest approved version and preserves promotion history', () => {
    const registry = buildStrategyVersionRegistry({
      strategyId: 'qe-core',
      versions: [
        { version: 1, parameterHash: 'abc', status: 'RETIRED', evidenceStatus: 'PASS', promotedAt: '2026-04-01T00:00:00.000Z', notes: 'old' },
        { version: 2, parameterHash: 'def', status: 'APPROVED', evidenceStatus: 'PASS', promotedAt: '2026-05-01T00:00:00.000Z', notes: 'current' }
      ]
    });

    assert.equal(registry.status, 'PASS');
    assert.equal(registry.activeVersion?.version, 2);
    assert.equal(registry.history.length, 2);
  });

  it('blocks duplicate versions or missing approved strategy version', () => {
    const registry = buildStrategyVersionRegistry({
      strategyId: 'qe-core',
      versions: [
        { version: 1, parameterHash: 'abc', status: 'CANDIDATE', evidenceStatus: 'BLOCK', promotedAt: null, notes: '' },
        { version: 1, parameterHash: 'abc', status: 'CANDIDATE', evidenceStatus: 'BLOCK', promotedAt: null, notes: '' }
      ]
    });

    assert.equal(registry.status, 'BLOCK');
    assert.equal(registry.activeVersion, null);
    assert(registry.issues.some(issue => issue.code === 'DUPLICATE_STRATEGY_VERSION'));
    assert(registry.issues.some(issue => issue.code === 'NO_APPROVED_STRATEGY_VERSION'));
  });
});
