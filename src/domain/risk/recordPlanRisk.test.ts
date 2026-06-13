import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePortfolioRisk } from './portfolioRisk';
import { evaluateTradeRisk } from './riskPolicy';
import { buildRecordPlanCandidateExposure, buildRecordPlanPolicyLimits } from './recordPlanRisk';

test('buildRecordPlanCandidateExposure uses confirmed risk sizing instead of stale setup sizing', () => {
  const riskDecision = evaluateTradeRisk({
    side: 'LONG',
    entry: 10,
    stopLoss: 9.5,
    takeProfit: 12,
    accountEquity: 500,
    riskPercent: 1,
    manualConfirmation: true
  });

  const candidate = buildRecordPlanCandidateExposure({
    symbol: 'OUST',
    side: 'LONG',
    entry: 10,
    stopLoss: 9.5,
    takeProfit: 12,
    riskDecision
  });

  assert.equal(candidate.sizeUnits, 10);
  assert.equal(candidate.sizeUsd, 100);

  const staleSetupDecision = evaluatePortfolioRisk({
    accountEquity: 500,
    currentTrades: [],
    candidate: {
      ...candidate,
      sizeUnits: 1_000,
      sizeUsd: 10_000
    }
  });
  assert.equal(staleSetupDecision.status, 'BLOCK');

  const portfolioDecision = evaluatePortfolioRisk({
    accountEquity: 500,
    currentTrades: [],
    candidate
  });

  assert.equal(portfolioDecision.status, 'PASS');
});

test('buildRecordPlanCandidateExposure zeros sizing when the risk gate blocks the setup', () => {
  const riskDecision = evaluateTradeRisk({
    side: 'LONG',
    entry: 10,
    stopLoss: 11,
    takeProfit: 12,
    accountEquity: 500,
    riskPercent: 1,
    manualConfirmation: true
  });

  const candidate = buildRecordPlanCandidateExposure({
    symbol: 'OUST',
    side: 'LONG',
    entry: 10,
    stopLoss: 11,
    takeProfit: 12,
    riskDecision
  });

  assert.equal(riskDecision.status, 'BLOCK');
  assert.equal(candidate.sizeUnits, 0);
  assert.equal(candidate.sizeUsd, 0);
});

test('buildRecordPlanCandidateExposure caps oversized notional before portfolio gate checks', () => {
  const riskDecision = evaluateTradeRisk({
    side: 'LONG',
    entry: 100,
    stopLoss: 99,
    takeProfit: 104,
    accountEquity: 10_000,
    riskPercent: 1,
    manualConfirmation: true
  });

  const uncappedCandidate = buildRecordPlanCandidateExposure({
    symbol: 'BTCUSDT',
    side: 'LONG',
    entry: 100,
    stopLoss: 99,
    takeProfit: 104,
    riskDecision
  });
  assert.equal(uncappedCandidate.sizeUsd, 10_000);
  assert.equal(evaluatePortfolioRisk({
    accountEquity: 10_000,
    currentTrades: [],
    candidate: uncappedCandidate
  }).status, 'BLOCK');

  const cappedCandidate = buildRecordPlanCandidateExposure({
    symbol: 'BTCUSDT',
    side: 'LONG',
    entry: 100,
    stopLoss: 99,
    takeProfit: 104,
    riskDecision,
    maxPositionUsd: 6_000
  });

  assert.equal(cappedCandidate.sizeUnits, 60);
  assert.equal(cappedCandidate.sizeUsd, 6_000);
  assert.equal(evaluatePortfolioRisk({
    accountEquity: 10_000,
    currentTrades: [],
    candidate: cappedCandidate
  }).status, 'PASS');
});

test('buildRecordPlanPolicyLimits caps requested risk and remaining directional exposure', () => {
  const limits = buildRecordPlanPolicyLimits({
    requestedRiskPercent: 5,
    accountEquity: 10_000,
    currentPortfolioHeatPercent: 4.5,
    sameDirectionExposureUsd: 4_000
  });

  assert.equal(limits.riskPercent, 1.5);
  assert.equal(limits.maxPositionUsd, 2_000);
  assert.equal(limits.remainingHeatPercent, 1.5);
  assert.equal(limits.remainingSameDirectionExposureUsd, 2_000);
});

test('buildRecordPlanCandidateExposure treats zero remaining allocation as a hard cap', () => {
  const riskDecision = evaluateTradeRisk({
    side: 'LONG',
    entry: 10,
    stopLoss: 9.5,
    takeProfit: 12,
    accountEquity: 500,
    riskPercent: 1,
    manualConfirmation: true
  });

  const candidate = buildRecordPlanCandidateExposure({
    symbol: 'OUST',
    side: 'LONG',
    entry: 10,
    stopLoss: 9.5,
    takeProfit: 12,
    riskDecision,
    maxPositionUsd: 0
  });

  assert.equal(candidate.sizeUnits, 0);
  assert.equal(candidate.sizeUsd, 0);
});
