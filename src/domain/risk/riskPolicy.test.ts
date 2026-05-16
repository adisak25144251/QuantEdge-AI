import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRewardRisk, evaluateTradeRisk } from './riskPolicy';

test('calculateRewardRisk handles long and short trade geometry', () => {
  assert.equal(calculateRewardRisk({ side: 'LONG', entry: 100, stopLoss: 95, takeProfit: 112 }), 2.4);
  assert.equal(calculateRewardRisk({ side: 'SHORT', entry: 100, stopLoss: 105, takeProfit: 88 }), 2.4);
});

test('evaluateTradeRisk passes a valid manually confirmed long plan and computes sizing', () => {
  const result = evaluateTradeRisk({
    side: 'LONG',
    entry: 100,
    stopLoss: 95,
    takeProfit: 112,
    accountEquity: 10_000,
    riskPercent: 1,
    manualConfirmation: true
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.rewardRisk, 2.4);
  assert.equal(result.riskAmountUsd, 100);
  assert.equal(result.positionSizeUnits, 20);
  assert.equal(result.positionSizeUsd, 2000);
});

test('evaluateTradeRisk blocks invalid stop and target geometry', () => {
  const result = evaluateTradeRisk({
    side: 'LONG',
    entry: 100,
    stopLoss: 101,
    takeProfit: 99,
    accountEquity: 10_000,
    riskPercent: 1,
    manualConfirmation: true
  });

  assert.equal(result.status, 'BLOCK');
  assert.equal(result.issues.some(issue => issue.code === 'INVALID_GEOMETRY'), true);
});

test('evaluateTradeRisk blocks risk policy breaches', () => {
  const result = evaluateTradeRisk({
    side: 'SHORT',
    entry: 100,
    stopLoss: 105,
    takeProfit: 88,
    accountEquity: 10_000,
    riskPercent: 3,
    openRiskPercent: 4,
    dailyRealizedLossPercent: 5,
    maxRiskPerTradePercent: 2,
    maxPortfolioHeatPercent: 5,
    maxDailyLossPercent: 4,
    manualConfirmation: true
  });

  assert.equal(result.status, 'BLOCK');
  assert.equal(result.issues.some(issue => issue.code === 'RISK_PER_TRADE_EXCEEDED'), true);
  assert.equal(result.issues.some(issue => issue.code === 'PORTFOLIO_HEAT_EXCEEDED'), true);
  assert.equal(result.issues.some(issue => issue.code === 'DAILY_LOSS_LIMIT_HIT'), true);
});

test('evaluateTradeRisk requires manual confirmation before recording', () => {
  const result = evaluateTradeRisk({
    side: 'LONG',
    entry: 100,
    stopLoss: 95,
    takeProfit: 112,
    accountEquity: 10_000,
    riskPercent: 1,
    manualConfirmation: false
  });

  assert.equal(result.status, 'REVIEW');
  assert.equal(result.issues.some(issue => issue.code === 'MANUAL_CONFIRMATION_REQUIRED'), true);
});
