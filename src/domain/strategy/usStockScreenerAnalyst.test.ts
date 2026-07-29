import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSingleStockBreakoutSwing, evaluateDailyUsStockScan, evaluateSmallCapAiWatchlist, scoreUsStockScreenerAnalystCandidate } from './usStockScreenerAnalyst';

describe('usStockScreenerAnalyst', () => {
  it('ranks a liquid AI infrastructure breakout as a strong watchlist candidate', () => {
    const result = scoreUsStockScreenerAnalystCandidate({
      ticker: 'SMCI',
      companyName: 'Super Micro Computer',
      exchange: 'NASDAQ',
      sector: 'Technology',
      theme: 'AI Back-End',
      price: 28,
      marketCap: 9_000_000_000,
      averageVolume: 12_000_000,
      relativeVolume: 2.1,
      rsi: 66,
      sma20Status: 'ABOVE',
      sma50Status: 'ABOVE',
      sma200Status: 'ABOVE',
      distanceFrom52WeekHighPercent: 12,
      catalyst: 'AI demand and backlog recovery watch.',
      catalystAgeDays: 12,
      catalystVerified: true,
      revenueGrowth: 22,
      earningsTrend: 'IMPROVING',
      cashDebtDilutionRisk: 'MEDIUM',
      technicalPattern: 'Breakout + Retest near 52-week high',
      recentRunUpPercent: 18,
      sectorRotation: 'LEADING'
    });

    assert.equal(result.finalView, 'Breakout Watch');
    assert.equal(['Strong Breakout Candidate', 'High Conviction Watchlist'].includes(result.rank), true);
    assert.equal(result.score >= 75, true);
  });

  it('warns not to chase extended high RSI setups', () => {
    const result = scoreUsStockScreenerAnalystCandidate({
      ticker: 'SPEC',
      companyName: 'Speculative Corp',
      exchange: 'NASDAQ',
      sector: 'Technology',
      theme: 'AI Robotics',
      price: 4,
      marketCap: 250_000_000,
      averageVolume: 600_000,
      relativeVolume: 4,
      rsi: 91,
      sma20Status: 'ABOVE',
      sma50Status: 'ABOVE',
      sma200Status: 'BELOW',
      distanceFrom52WeekHighPercent: 3,
      catalyst: 'Press release momentum.',
      catalystAgeDays: 5,
      catalystVerified: true,
      revenueGrowth: null,
      earningsTrend: 'UNKNOWN',
      cashDebtDilutionRisk: 'HIGH',
      technicalPattern: 'High tight flag',
      recentRunUpPercent: 75,
      sectorRotation: 'LEADING'
    });

    assert.equal(result.finalView, 'Speculative Trade');
    assert.equal(result.bucket, 'หุ้น speculative');
    assert.equal(result.warnings.some(warning => warning.includes('ไม่ควรไล่ราคา')), true);
    assert.equal(result.missingData.includes('Revenue Growth'), true);
  });

  it('passes daily 1-4 week scan only when price, liquidity, RSI, SMA, catalyst, and pattern gates align', () => {
    const result = evaluateDailyUsStockScan({
      ticker: 'AIIO',
      companyName: 'AI Infrastructure Optics',
      exchange: 'NASDAQ',
      sector: 'Technology',
      theme: 'Optical Interconnect',
      price: 12,
      marketCap: 1_200_000_000,
      averageVolume: 900_000,
      relativeVolume: 1.8,
      rsi: 62,
      sma20Status: 'ABOVE',
      sma50Status: 'ABOVE',
      sma200Status: 'ABOVE',
      distanceFrom52WeekHighPercent: 14,
      catalyst: 'New data center interconnect design win.',
      catalystAgeDays: 8,
      catalystVerified: true,
      revenueGrowth: null,
      earningsTrend: 'UNKNOWN',
      cashDebtDilutionRisk: 'UNKNOWN',
      technicalPattern: 'VCP with Volume Dry-Up before Breakout + Retest',
      recentRunUpPercent: 18,
      sectorRotation: 'LEADING'
    });

    assert.equal(result.status, 'PASS');
    assert.equal(result.oneToFourWeekCandidate, true);
    assert.equal(result.matchedPatterns.includes('VCP'), true);
  });

  it('blocks daily scan when a stock is extended more than 50 percent without a new base', () => {
    const result = evaluateDailyUsStockScan({
      ticker: 'RUN',
      companyName: 'Runaway Corp',
      exchange: 'NASDAQ',
      sector: 'Technology',
      theme: 'AI Robotics',
      price: 8,
      marketCap: 800_000_000,
      averageVolume: 2_000_000,
      relativeVolume: 3,
      rsi: 72,
      sma20Status: 'ABOVE',
      sma50Status: 'ABOVE',
      sma200Status: 'ABOVE',
      distanceFrom52WeekHighPercent: 4,
      catalyst: 'Momentum news.',
      catalystAgeDays: 3,
      catalystVerified: true,
      revenueGrowth: null,
      earningsTrend: 'UNKNOWN',
      cashDebtDilutionRisk: 'UNKNOWN',
      technicalPattern: 'Momentum extension',
      recentRunUpPercent: 80,
      sectorRotation: 'LEADING'
    });

    assert.equal(result.status, 'BLOCK');
    assert.equal(result.failedCriteria.includes('EXTENDED_5_DAY_RUN_WITHOUT_NEW_BASE'), true);
  });

  it('groups a liquid small-cap AI base as breakout ready', () => {
    const result = evaluateSmallCapAiWatchlist({
      ticker: 'BOTX',
      companyName: 'BotX Automation',
      exchange: 'NASDAQ',
      sector: 'Technology',
      theme: 'AI Robotics',
      price: 8.5,
      marketCap: 850_000_000,
      averageVolume: 1_200_000,
      relativeVolume: 2.2,
      rsi: 64,
      sma20Status: 'ABOVE',
      sma50Status: 'ABOVE',
      sma200Status: 'BELOW',
      distanceFrom52WeekHighPercent: 16,
      catalyst: 'New robotics AI deployment contract.',
      catalystAgeDays: 6,
      catalystVerified: true,
      revenueGrowth: 24,
      earningsTrend: 'IMPROVING',
      cashDebtDilutionRisk: 'MEDIUM',
      technicalPattern: 'VCP Bull Flag Breakout + Retest',
      recentRunUpPercent: 12,
      sectorRotation: 'LEADING'
    });

    assert.equal(result.group, 'Breakout Ready');
    assert.equal(result.finalView, 'Breakout Watch');
    assert.equal(result.score >= 75, true);
  });

  it('labels offering and going-concern risk as speculative only', () => {
    const result = evaluateSmallCapAiWatchlist({
      ticker: 'RISK',
      companyName: 'Risk AI',
      exchange: 'NASDAQ',
      sector: 'Technology',
      theme: 'AI Back-End',
      price: 3.2,
      marketCap: 180_000_000,
      averageVolume: 700_000,
      relativeVolume: 1.9,
      rsi: 58,
      sma20Status: 'ABOVE',
      sma50Status: 'BELOW',
      sma200Status: 'BELOW',
      distanceFrom52WeekHighPercent: 19,
      catalyst: 'Recent offering after going concern warning.',
      catalystAgeDays: 4,
      catalystVerified: true,
      revenueGrowth: null,
      earningsTrend: 'UNKNOWN',
      cashDebtDilutionRisk: 'HIGH',
      technicalPattern: 'Triangle reclaim watch',
      recentRunUpPercent: 9,
      sectorRotation: 'LEADING'
    });

    assert.equal(result.group, 'Speculative Only');
    assert.equal(result.finalView, 'Speculative Trade');
    assert.equal(result.warnings.some(warning => warning.includes('High-risk speculative')), true);
  });

  it('analyzes a single stock as conditional breakout watch without giving definitive advice', () => {
    const result = analyzeSingleStockBreakoutSwing({
      ticker: 'BOTX',
      companyName: 'BotX Automation',
      exchange: 'NASDAQ',
      sector: 'Technology',
      theme: 'AI Robotics',
      price: 8.5,
      marketCap: 850_000_000,
      averageVolume: 1_200_000,
      latestVolume: 2_400_000,
      relativeVolume: 2,
      rsi: 63,
      sma20Status: 'ABOVE',
      sma50Status: 'ABOVE',
      sma200Status: 'BELOW',
      distanceFrom52WeekHighPercent: 12,
      catalyst: 'Robotics AI contract watch.',
      catalystAgeDays: 10,
      catalystVerified: true,
      revenueGrowth: 18,
      earningsTrend: 'IMPROVING',
      cashDebtDilutionRisk: 'MEDIUM',
      technicalPattern: 'VCP Breakout + Retest',
      recentRunUpPercent: 15,
      sectorRotation: 'LEADING',
      supportLevel: 7.8,
      resistanceLevel: 8.9
    });

    assert.equal(result.finalView, 'Breakout Watch');
    assert.equal(result.enterConditions.length > 0, true);
    assert.equal(result.avoidConditions.some(condition => condition.includes('หลีกเลี่ยง')), true);
  });

  it('marks extended single-stock setups as wait pullback', () => {
    const result = analyzeSingleStockBreakoutSwing({
      ticker: 'HOT',
      companyName: 'Hot AI',
      exchange: 'NASDAQ',
      sector: 'Technology',
      theme: 'AI Back-End',
      price: 11,
      marketCap: 900_000_000,
      averageVolume: 3_000_000,
      latestVolume: 8_000_000,
      relativeVolume: 2.8,
      rsi: 82,
      sma20Status: 'ABOVE',
      sma50Status: 'ABOVE',
      sma200Status: 'ABOVE',
      distanceFrom52WeekHighPercent: 3,
      catalyst: 'AI infrastructure momentum.',
      catalystAgeDays: 5,
      catalystVerified: true,
      revenueGrowth: null,
      earningsTrend: 'UNKNOWN',
      cashDebtDilutionRisk: 'UNKNOWN',
      technicalPattern: 'High tight flag',
      recentRunUpPercent: 48,
      sectorRotation: 'LEADING',
      supportLevel: 9.8,
      resistanceLevel: 11.4
    });

    assert.equal(result.finalView, 'Wait Pullback');
    assert.equal(result.noChaseBase.includes('ฐานใหม่'), true);
  });
});
