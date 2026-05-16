import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateForwardShadowEvidenceV2 } from './forwardShadowEvidenceV2';

describe('forwardShadowEvidenceV2', () => {
  it('passes forward and shadow evidence when executable drift is controlled', () => {
    const report = evaluateForwardShadowEvidenceV2({
      forwardSignals: 80,
      forwardExpectancyR: 0.18,
      shadowObservations: 60,
      executablePnlDriftPercent: 4,
      missedFillRatePercent: 3,
      scoreDecayPercent: 8
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.shadowReady, true);
  });

  it('blocks thin shadow evidence and high executable drift', () => {
    const report = evaluateForwardShadowEvidenceV2({
      forwardSignals: 12,
      forwardExpectancyR: -0.05,
      shadowObservations: 4,
      executablePnlDriftPercent: 25,
      missedFillRatePercent: 20,
      scoreDecayPercent: 30
    });

    assert.equal(report.status, 'BLOCK');
    assert.equal(report.shadowReady, false);
  });

  it('sanitizes incomplete numeric inputs so the UI never renders NaN', () => {
    const report = evaluateForwardShadowEvidenceV2({
      forwardSignals: Number.NaN,
      forwardExpectancyR: Number.NaN,
      shadowObservations: 0,
      executablePnlDriftPercent: Number.NaN,
      missedFillRatePercent: Number.NaN,
      scoreDecayPercent: Number.NaN
    });

    assert.equal(Number.isFinite(report.executionEvidenceScore), true);
    assert.equal(report.executionEvidenceScore, 100);
    assert.equal(report.status, 'BLOCK');
  });
});
