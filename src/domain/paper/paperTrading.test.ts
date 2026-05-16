import test from 'node:test';
import assert from 'node:assert/strict';
import { closePaperTrade, computePaperReadiness, computePaperStats, recordPaperTrade } from './paperTrading';

test('recordPaperTrade creates a deterministic open paper trade when id is omitted', () => {
  const trade = recordPaperTrade({
    symbol: 'BTCUSDT',
    side: 'LONG',
    entry: 100,
    stopLoss: 95,
    takeProfit: 110,
    sizeUnits: 10,
    openedAt: '2026-05-09T00:00:00.000Z'
  });

  assert.equal(trade.status, 'OPEN');
  assert.match(trade.id, /^paper-BTCUSDT-LONG-/);
});

test('closePaperTrade calculates pnl and R multiple for a winning long trade', () => {
  const trade = recordPaperTrade({
    id: 'paper-1',
    symbol: 'BTCUSDT',
    side: 'LONG',
    entry: 100,
    stopLoss: 95,
    takeProfit: 110,
    sizeUnits: 10,
    openedAt: '2026-05-09T00:00:00.000Z'
  });

  const closed = closePaperTrade(trade, {
    exitPrice: 110,
    closedAt: '2026-05-09T01:00:00.000Z'
  });

  assert.equal(closed.status, 'CLOSED');
  assert.equal(closed.pnlUsd, 100);
  assert.equal(closed.rMultiple, 2);
});

test('computePaperStats returns expectancy, win rate, profit factor, and max drawdown', () => {
  const trades = [
    closePaperTrade(recordPaperTrade({
      id: 'win-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      entry: 100,
      stopLoss: 95,
      takeProfit: 110,
      sizeUnits: 10,
      openedAt: '2026-05-09T00:00:00.000Z'
    }), { exitPrice: 110, closedAt: '2026-05-09T01:00:00.000Z' }),
    closePaperTrade(recordPaperTrade({
      id: 'loss-1',
      symbol: 'ETHUSDT',
      side: 'SHORT',
      entry: 100,
      stopLoss: 105,
      takeProfit: 90,
      sizeUnits: 10,
      openedAt: '2026-05-09T02:00:00.000Z'
    }), { exitPrice: 105, closedAt: '2026-05-09T03:00:00.000Z' }),
    closePaperTrade(recordPaperTrade({
      id: 'win-2',
      symbol: 'SOLUSDT',
      side: 'LONG',
      entry: 50,
      stopLoss: 45,
      takeProfit: 60,
      sizeUnits: 20,
      openedAt: '2026-05-09T04:00:00.000Z'
    }), { exitPrice: 55, closedAt: '2026-05-09T05:00:00.000Z' })
  ];

  const stats = computePaperStats(trades);

  assert.equal(stats.closedTrades, 3);
  assert.equal(stats.winRate, 66.67);
  assert.equal(stats.expectancyR, 0.67);
  assert.equal(stats.profitFactor, 4);
  assert.equal(stats.maxDrawdownUsd, 50);
});

test('computePaperReadiness passes only statistically useful positive paper evidence', () => {
  const stats = {
    closedTrades: 60,
    winRate: 55,
    expectancyR: 0.28,
    profitFactor: 1.8,
    maxDrawdownUsd: 700,
    netPnlUsd: 1600
  };

  const report = computePaperReadiness({
    stats,
    accountEquity: 10_000,
    minClosedTrades: 50,
    maxDrawdownPercent: 10
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.drawdownPercent, 7);
  assert.equal(report.issues.length, 0);
});

test('computePaperReadiness blocks weak paper evidence with issue codes', () => {
  const report = computePaperReadiness({
    stats: {
      closedTrades: 12,
      winRate: 41,
      expectancyR: -0.2,
      profitFactor: 0.7,
      maxDrawdownUsd: 2500,
      netPnlUsd: -600
    },
    accountEquity: 10_000
  });

  assert.equal(report.status, 'BLOCK');
  assert.equal(report.issues.some(issue => issue.code === 'PAPER_SAMPLE_TOO_SMALL'), true);
  assert.equal(report.issues.some(issue => issue.code === 'PAPER_EXPECTANCY_NOT_POSITIVE'), true);
  assert.equal(report.issues.some(issue => issue.code === 'PAPER_DRAWDOWN_EXCEEDED'), true);
});
