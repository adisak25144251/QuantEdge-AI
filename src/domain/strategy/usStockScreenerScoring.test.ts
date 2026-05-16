import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreUsStockScreenerSetup } from './usStockScreenerScoring';

describe('usStockScreenerScoring', () => {
  it('ranks high relative strength, high volume breakout candidates', () => {
    const setup = scoreUsStockScreenerSetup({
      symbol: 'NVDA',
      priceChangePercent: 3.2,
      relativeStrengthPercent: 4.5,
      relativeVolume: 2.1,
      gapPercent: 1.2,
      daysToEarnings: 30
    });

    assert.equal(setup.status, 'PASS');
    assert.equal(setup.direction, 'LONG');
    assert.equal(setup.tags.includes('SECTOR_LEADER'), true);
  });

  it('blocks candidates inside earnings lockout regardless of momentum', () => {
    const setup = scoreUsStockScreenerSetup({
      symbol: 'TSLA',
      priceChangePercent: 5,
      relativeStrengthPercent: 5,
      relativeVolume: 3,
      gapPercent: 2,
      daysToEarnings: 1
    });

    assert.equal(setup.status, 'BLOCK');
    assert(setup.issues.some(issue => issue.code === 'EARNINGS_LOCKOUT'));
  });
});
