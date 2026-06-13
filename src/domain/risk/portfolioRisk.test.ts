import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeExecutionAudit,
  createExecutionAuditEntry,
  evaluatePortfolioRisk,
  summarizeOpenRisk
} from './portfolioRisk';

const openTrade = (overrides = {}) => ({
  id: 't1',
  symbol: 'BTCUSDT',
  side: 'LONG' as const,
  entry: 100,
  sl: 95,
  tp: 110,
  sizeUSD: 2000,
  sizeUnits: 20,
  status: 'OPEN' as const,
  date: '2026-05-09T00:00:00.000Z',
  ...overrides
});

test('summarizeOpenRisk calculates open risk, portfolio heat, and directional exposure', () => {
  const summary = summarizeOpenRisk({
    accountEquity: 10_000,
    trades: [
      openTrade(),
      openTrade({
        id: 't2',
        symbol: 'ETHUSDT',
        side: 'SHORT',
        entry: 50,
        sl: 55,
        tp: 40,
        sizeUSD: 1000,
        sizeUnits: 20
      })
    ]
  });

  assert.equal(summary.openTrades, 2);
  assert.equal(summary.openRiskUsd, 200);
  assert.equal(summary.portfolioHeatPercent, 2);
  assert.equal(summary.longExposureUsd, 2000);
  assert.equal(summary.shortExposureUsd, 1000);
});

test('evaluatePortfolioRisk passes a candidate that keeps portfolio heat inside limits', () => {
  const result = evaluatePortfolioRisk({
    accountEquity: 10_000,
    currentTrades: [openTrade()],
    candidate: {
      symbol: 'ETHUSDT',
      side: 'LONG',
      entry: 50,
      stopLoss: 48,
      takeProfit: 56,
      sizeUnits: 25,
      sizeUsd: 1250
    },
    maxPortfolioHeatPercent: 5,
    maxSameDirectionExposurePercent: 50
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.projectedHeatPercent, 1.5);
  assert.equal(result.issues.length, 0);
});

test('evaluatePortfolioRisk blocks heat and concentration breaches', () => {
  const result = evaluatePortfolioRisk({
    accountEquity: 10_000,
    currentTrades: [
      openTrade({ id: 't1', sizeUSD: 3000, sizeUnits: 30 }),
      openTrade({ id: 't2', symbol: 'ETHUSDT', sizeUSD: 2500, sizeUnits: 50 })
    ],
    candidate: {
      symbol: 'SOLUSDT',
      side: 'LONG',
      entry: 100,
      stopLoss: 90,
      takeProfit: 120,
      sizeUnits: 20,
      sizeUsd: 2000
    },
    maxPortfolioHeatPercent: 5,
    maxSameDirectionExposurePercent: 60
  });

  assert.equal(result.status, 'BLOCK');
  assert.equal(result.issues.some(issue => issue.code === 'PORTFOLIO_HEAT_EXCEEDED'), true);
  assert.equal(result.issues.some(issue => issue.code === 'DIRECTIONAL_EXPOSURE_EXCEEDED'), true);
});

test('evaluatePortfolioRisk reviews duplicate symbol exposure', () => {
  const result = evaluatePortfolioRisk({
    accountEquity: 10_000,
    currentTrades: [openTrade()],
    candidate: {
      symbol: 'BTCUSDT',
      side: 'LONG',
      entry: 110,
      stopLoss: 108,
      takeProfit: 118,
      sizeUnits: 10,
      sizeUsd: 1100
    }
  });

  assert.equal(result.status, 'REVIEW');
  assert.equal(result.issues.some(issue => issue.code === 'DUPLICATE_SYMBOL_EXPOSURE'), true);
});

test('evaluatePortfolioRisk blocks invalid equity and candidate exposure', () => {
  const result = evaluatePortfolioRisk({
    accountEquity: 0,
    currentTrades: [],
    candidate: {
      symbol: 'BTCUSDT',
      side: 'LONG',
      entry: 100,
      stopLoss: 105,
      takeProfit: 95,
      sizeUnits: 0,
      sizeUsd: 0
    }
  });

  assert.equal(result.status, 'BLOCK');
  assert.equal(result.issues.some(issue => issue.code === 'INVALID_ACCOUNT_EQUITY'), true);
  assert.equal(result.issues.some(issue => issue.code === 'INVALID_CANDIDATE_EXPOSURE'), true);
});

test('evaluatePortfolioRisk blocks a zero-sized capped candidate instead of allowing an empty plan', () => {
  const riskDecision = {
    status: 'PASS' as const,
    issues: [],
    rewardRisk: 4,
    riskAmountUsd: 5,
    positionSizeUnits: 10,
    positionSizeUsd: 100
  };

  const result = evaluatePortfolioRisk({
    accountEquity: 500,
    currentTrades: [],
    candidate: {
      symbol: 'OUST',
      side: 'LONG',
      entry: 10,
      stopLoss: 9.5,
      takeProfit: 12,
      sizeUnits: riskDecision.positionSizeUnits * 0,
      sizeUsd: riskDecision.positionSizeUsd * 0
    }
  });

  assert.equal(result.status, 'BLOCK');
  assert.equal(result.issues.some(issue => issue.code === 'INVALID_CANDIDATE_EXPOSURE'), true);
});

test('createExecutionAuditEntry records deterministic allow and block decisions', () => {
  const entry = createExecutionAuditEntry({
    setupId: 'BTCUSDT-1H-LONG',
    symbol: 'BTCUSDT',
    side: 'LONG',
    action: 'RECORD_PLAN',
    decision: 'BLOCK',
    riskGateStatus: 'PASS',
    portfolioGateStatus: 'BLOCK',
    issueCodes: ['PORTFOLIO_HEAT_EXCEEDED'],
    timestamp: '2026-05-09T00:00:00.000Z'
  });

  assert.equal(entry.id, 'audit-BTCUSDT-1H-LONG-2026-05-09T00:00:00.000Z');
  assert.equal(entry.decision, 'BLOCK');
  assert.deepEqual(entry.issueCodes, ['PORTFOLIO_HEAT_EXCEEDED']);
});

test('summarizeExecutionAudit aggregates decisions and top block reasons', () => {
  const entries = [
    createExecutionAuditEntry({
      setupId: 'BTC-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      action: 'RECORD_PLAN',
      decision: 'BLOCK',
      riskGateStatus: 'PASS',
      portfolioGateStatus: 'BLOCK',
      issueCodes: ['PORTFOLIO_HEAT_EXCEEDED'],
      timestamp: '2026-05-09T00:00:00.000Z'
    }),
    createExecutionAuditEntry({
      setupId: 'ETH-1',
      symbol: 'ETHUSDT',
      side: 'SHORT',
      action: 'RECORD_PLAN',
      decision: 'REVIEW',
      riskGateStatus: 'PASS',
      portfolioGateStatus: 'REVIEW',
      issueCodes: ['DUPLICATE_SYMBOL_EXPOSURE'],
      timestamp: '2026-05-09T01:00:00.000Z'
    }),
    createExecutionAuditEntry({
      setupId: 'SOL-1',
      symbol: 'SOLUSDT',
      side: 'LONG',
      action: 'RECORD_PLAN',
      decision: 'ALLOW',
      riskGateStatus: 'PASS',
      portfolioGateStatus: 'PASS',
      issueCodes: [],
      timestamp: '2026-05-09T02:00:00.000Z'
    })
  ];

  const summary = summarizeExecutionAudit(entries);

  assert.equal(summary.totalDecisions, 3);
  assert.equal(summary.allowCount, 1);
  assert.equal(summary.reviewCount, 1);
  assert.equal(summary.blockCount, 1);
  assert.equal(summary.blockRate, 33.33);
  assert.deepEqual(summary.topIssueCodes, [
    { code: 'PORTFOLIO_HEAT_EXCEEDED', count: 1 },
    { code: 'DUPLICATE_SYMBOL_EXPOSURE', count: 1 }
  ]);
});
