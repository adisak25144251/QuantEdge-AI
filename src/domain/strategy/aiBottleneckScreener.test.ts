import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAiBottleneckCandidate } from './aiBottleneckScreener';

describe('aiBottleneckScreener', () => {
  it('classifies a liquid optical supplier with catalysts as a core bottleneck', () => {
    const result = scoreAiBottleneckCandidate({
      ticker: 'OPTK',
      companyName: 'Optical Kit',
      category: 'Optical Interconnect / Photonics',
      marketCap: 2_000_000_000,
      price: 18,
      averageVolume: 1_500_000,
      relativeVolume: 1.7,
      revenueGrowth: 35,
      grossMarginTrend: 'EXPANDING',
      netIncomeTrend: 'IMPROVING',
      freeCashFlow: 5_000_000,
      cashDebtProfile: 'MANAGEABLE',
      backlogOrContract: 'AI data center optical capacity contract and backlog expansion.',
      catalyst: 'New hyperscaler optical interconnect design win.',
      catalystAgeDays: 20,
      valuation: { ps: 6, pe: null, evSales: 5 },
      sma20Status: 'ABOVE',
      sma50Status: 'ABOVE',
      sma200Status: 'ABOVE',
      rsi: 64,
      relativeStrength: 8,
      pattern: 'VCP Breakout Retest',
      recentRunUpPercent: 18,
      dilutionRisk: 'LOW'
    });

    assert.equal(result.group, 'Core Bottleneck');
    assert.equal(result.finalView, 'Breakout Watch');
    assert.equal(result.score >= 75, true);
  });

  it('marks overheated candidates without a new base as wait pullback or avoid', () => {
    const result = scoreAiBottleneckCandidate({
      ticker: 'HOTAI',
      companyName: 'Hot AI Power',
      category: 'Power / Energy for Data Centers',
      marketCap: 6_000_000_000,
      price: 42,
      averageVolume: 3_000_000,
      relativeVolume: 3,
      revenueGrowth: 25,
      grossMarginTrend: 'STABLE',
      netIncomeTrend: 'IMPROVING',
      freeCashFlow: null,
      cashDebtProfile: 'MANAGEABLE',
      backlogOrContract: 'Power supply demand for AI data centers.',
      catalyst: 'Sector momentum.',
      catalystAgeDays: 8,
      valuation: { ps: 22, pe: null, evSales: 24 },
      sma20Status: 'ABOVE',
      sma50Status: 'ABOVE',
      sma200Status: 'ABOVE',
      rsi: 88,
      relativeStrength: 20,
      pattern: 'Momentum extension',
      recentRunUpPercent: 72,
      monthlyRunUpPercent: 115,
      dilutionRisk: 'MEDIUM'
    });

    assert.equal(result.group, 'Avoid / Too Extended');
    assert.equal(result.issues.includes('TOO_EXTENDED_WAIT_FOR_BASE'), true);
    assert.equal(result.issues.includes('MONTHLY_RUNUP_OVER_100_NO_BASE'), true);
    assert.equal(['Wait Pullback', 'Avoid'].includes(result.finalView), true);
  });

  it('labels weak financial survivability as speculative bottleneck', () => {
    const result = scoreAiBottleneckCandidate({
      ticker: 'SPEC',
      companyName: 'Spec Compute',
      category: 'Neo Cloud / GPU Cloud / Compute Capacity',
      marketCap: 400_000_000,
      price: 5,
      averageVolume: 800_000,
      relativeVolume: 1.4,
      revenueGrowth: null,
      grossMarginTrend: 'UNKNOWN',
      netIncomeTrend: 'DETERIORATING',
      freeCashFlow: -50_000_000,
      cashDebtProfile: 'LEVERED',
      backlogOrContract: 'GPU cloud capacity plan, unproven.',
      catalyst: 'Capital raise for compute cluster.',
      catalystAgeDays: 45,
      valuation: { ps: null, pe: null, evSales: null },
      sma20Status: 'ABOVE',
      sma50Status: 'BELOW',
      sma200Status: 'BELOW',
      rsi: 57,
      relativeStrength: 2,
      pattern: 'Triangle Wave 2',
      recentRunUpPercent: 10,
      dilutionRisk: 'HIGH'
    });

    assert.equal(result.group, 'Speculative Bottleneck');
    assert.equal(result.finalView, 'Speculative Trade');
  });
});
