import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStrategyRegistryEntry, summarizeStrategyRegistry } from './strategyRegistry';

describe('strategyRegistry', () => {
  it('approves an owned strategy with evidence, regime coverage, and controlled drift', () => {
    const entry = evaluateStrategyRegistryEntry({
      id: 'qe-momentum-v1',
      name: 'QuantEdge Momentum',
      owner: 'risk-desk',
      stage: 'SMALL_LIVE_READY',
      allowedRegimes: ['TRENDING', 'LOW_VOLATILITY'],
      promotionStatus: 'PASS',
      driftStatus: 'PASS',
      evidenceStatus: 'PASS',
      backtestTrades: 240,
      forwardSignals: 80,
      lastReviewedAt: '2026-05-01T00:00:00.000Z',
      now: Date.parse('2026-05-10T00:00:00.000Z')
    });

    assert.equal(entry.status, 'PASS');
    assert.equal(entry.liveEligible, true);
    assert.deepEqual(entry.issues, []);
  });

  it('blocks live eligibility when ownership, review freshness, or drift gates fail', () => {
    const entry = evaluateStrategyRegistryEntry({
      id: 'qe-breakout-v2',
      name: 'QuantEdge Breakout',
      owner: '',
      stage: 'LIVE_ELIGIBLE',
      allowedRegimes: [],
      promotionStatus: 'PASS',
      driftStatus: 'BLOCK',
      evidenceStatus: 'PASS',
      backtestTrades: 300,
      forwardSignals: 100,
      lastReviewedAt: '2026-03-01T00:00:00.000Z',
      now: Date.parse('2026-05-10T00:00:00.000Z')
    });

    assert.equal(entry.status, 'BLOCK');
    assert.equal(entry.liveEligible, false);
    assert(entry.issues.some(issue => issue.code === 'STRATEGY_OWNER_MISSING'));
    assert(entry.issues.some(issue => issue.code === 'ALLOWED_REGIMES_MISSING'));
    assert(entry.issues.some(issue => issue.code === 'MODEL_DRIFT_BLOCKED'));
    assert(entry.issues.some(issue => issue.code === 'STRATEGY_REVIEW_STALE'));
  });

  it('summarizes registry health across multiple strategies', () => {
    const summary = summarizeStrategyRegistry([
      {
        id: 'pass',
        name: 'Pass',
        owner: 'desk',
        stage: 'SMALL_LIVE_READY',
        allowedRegimes: ['TRENDING'],
        promotionStatus: 'PASS',
        driftStatus: 'PASS',
        evidenceStatus: 'PASS',
        backtestTrades: 250,
        forwardSignals: 70,
        lastReviewedAt: '2026-05-01T00:00:00.000Z',
        now: Date.parse('2026-05-10T00:00:00.000Z')
      },
      {
        id: 'block',
        name: 'Block',
        owner: '',
        stage: 'RESEARCH',
        allowedRegimes: [],
        promotionStatus: 'BLOCK',
        driftStatus: 'REVIEW',
        evidenceStatus: 'BLOCK',
        backtestTrades: 10,
        forwardSignals: 0,
        lastReviewedAt: null,
        now: Date.parse('2026-05-10T00:00:00.000Z')
      }
    ]);

    assert.equal(summary.status, 'BLOCK');
    assert.equal(summary.totalStrategies, 2);
    assert.equal(summary.liveEligibleStrategies, 1);
    assert(summary.blockingCodes.includes('STRATEGY_OWNER_MISSING'));
  });
});
