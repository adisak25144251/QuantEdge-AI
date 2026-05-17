import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePortfolioRisk } from './portfolioRisk';
import { evaluateTradeRisk } from './riskPolicy';
import { buildRecordPlanCandidateExposure } from './recordPlanRisk';

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
