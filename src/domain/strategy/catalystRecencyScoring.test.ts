import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAiBottleneckCandidate } from './aiBottleneckScreener';
import { scoreUsStockScreenerAnalystCandidate } from './usStockScreenerAnalyst';

test('US stock scoring treats undated catalyst research as missing recency evidence', () => {
  const result = scoreUsStockScreenerAnalystCandidate({
    ticker: 'VERIFY',
    companyName: 'Verify Corp',
    exchange: 'NASDAQ',
    sector: 'Technology',
    theme: 'AI Back-End',
    price: 10,
    marketCap: 1_000_000_000,
    averageVolume: 1_000_000,
    relativeVolume: 1.6,
    rsi: 60,
    sma20Status: 'ABOVE',
    sma50Status: 'ABOVE',
    sma200Status: 'ABOVE',
    distanceFrom52WeekHighPercent: 10,
    catalyst: 'Research note without a dated source.',
    catalystAgeDays: null,
    revenueGrowth: null,
    earningsTrend: 'UNKNOWN',
    cashDebtDilutionRisk: 'UNKNOWN',
    technicalPattern: 'VCP',
    recentRunUpPercent: 12,
    sectorRotation: 'LEADING'
  });

  assert.equal(result.scoreBreakdown.catalystQuality, 3);
  assert(result.missingData.includes('Catalyst Recency'));
});

test('AI bottleneck scoring does not award recency points without a verified catalyst age', () => {
  const result = scoreAiBottleneckCandidate({
    ticker: 'VERIFY',
    companyName: 'Verify Infrastructure',
    category: 'Optical Interconnect / Photonics',
    marketCap: 1_000_000_000,
    price: 12,
    averageVolume: 1_000_000,
    relativeVolume: 1.6,
    revenueGrowth: null,
    grossMarginTrend: 'UNKNOWN',
    netIncomeTrend: 'UNKNOWN',
    freeCashFlow: null,
    cashDebtProfile: 'UNKNOWN',
    backlogOrContract: 'Research thesis requires filing verification.',
    catalyst: 'Unverified catalyst note.',
    catalystAgeDays: null,
    valuation: { ps: null, pe: null, evSales: null },
    sma20Status: 'ABOVE',
    sma50Status: 'ABOVE',
    sma200Status: 'UNKNOWN',
    rsi: 60,
    relativeStrength: 3,
    pattern: 'VCP',
    recentRunUpPercent: 10,
    dilutionRisk: 'UNKNOWN'
  });

  assert.equal(result.scoreBreakdown.catalystQuality, 3);
});

test('AI bottleneck scoring caps unverified static fundamental contribution', () => {
  const result = scoreAiBottleneckCandidate({
    ticker: 'STATIC',
    companyName: 'Static Snapshot Corp',
    category: 'Power Management / Cooling / Grid Infrastructure',
    marketCap: 2_000_000_000,
    price: 20,
    averageVolume: 2_000_000,
    relativeVolume: 2,
    revenueGrowth: 80,
    grossMarginTrend: 'EXPANDING',
    netIncomeTrend: 'IMPROVING',
    freeCashFlow: 100_000_000,
    cashDebtProfile: 'NET_CASH',
    backlogOrContract: 'Static research snapshot.',
    catalyst: 'Static catalyst note.',
    catalystAgeDays: null,
    valuation: { ps: 2, pe: 10, evSales: 2 },
    sma20Status: 'ABOVE',
    sma50Status: 'ABOVE',
    sma200Status: 'ABOVE',
    rsi: 62,
    relativeStrength: 10,
    pattern: 'VCP',
    recentRunUpPercent: 15,
    dilutionRisk: 'LOW',
    fundamentalsVerified: false
  });

  assert.equal(result.scoreBreakdown.financialQuality, 3);
  assert.equal(result.scoreBreakdown.valuationSafety, 2);
  assert(result.issues.includes('FUNDAMENTALS_REQUIRE_LIVE_VERIFICATION'));
});
