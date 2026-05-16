import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateShadowLiveMode } from './shadowLiveMode';

describe('shadowLiveMode', () => {
  it('passes when shadow execution stays close to theoretical results', () => {
    const report = evaluateShadowLiveMode({
      observations: [
        { id: '1', theoreticalPnlUsd: 100, executablePnlUsd: 96, theoreticalEntry: 100, executableEntry: 100.02 },
        { id: '2', theoreticalPnlUsd: -50, executablePnlUsd: -52, theoreticalEntry: 200, executableEntry: 199.95 }
      ],
      maxPnlDivergencePercent: 10,
      minObservations: 2
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.observations, 2);
    assert.equal(report.realOrdersPlaced, false);
  });

  it('blocks thin or highly divergent shadow evidence', () => {
    const report = evaluateShadowLiveMode({
      observations: [
        { id: '1', theoreticalPnlUsd: 100, executablePnlUsd: 50, theoreticalEntry: 100, executableEntry: 101 }
      ],
      maxPnlDivergencePercent: 20,
      minObservations: 5
    });

    assert.equal(report.status, 'BLOCK');
    assert(report.issues.some(issue => issue.code === 'SHADOW_SAMPLE_TOO_SMALL'));
    assert(report.issues.some(issue => issue.code === 'SHADOW_PNL_DIVERGENCE_HIGH'));
  });
});
