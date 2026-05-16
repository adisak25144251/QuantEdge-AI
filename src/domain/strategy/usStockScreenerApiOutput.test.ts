import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildUsStockScreenerApiOutput } from './usStockScreenerApiOutput';

describe('usStockScreenerApiOutput', () => {
  it('builds the requested JSON-only screener schema from ranked rows', () => {
    const output = buildUsStockScreenerApiOutput({
      scanDate: '2026-05-10',
      marketCondition: 'Risk-on AI infrastructure rotation watch.',
      theme: 'AI Infrastructure',
      watchlistRows: [
        {
          ticker: 'BOTX',
          company: 'BotX Automation',
          theme: 'AI Robotics',
          price: 8.5,
          marketCap: 850_000_000,
          avgVolume: 1_200_000,
          relativeVolume: 2,
          rsi: 63,
          sma20Status: 'ABOVE',
          sma50Status: 'ABOVE',
          sma200Status: 'BELOW',
          distanceFrom52WeekHigh: 12,
          pattern: 'VCP Breakout + Retest',
          catalyst: 'Robotics AI contract watch.',
          entryZone: '$8.33-$8.76 after confirmation/retest',
          stopLoss: '$7.65-$7.99 or below SMA50',
          targetZone: '$9.78-$11.05; scale only after base holds',
          riskReward: 2.2,
          riskLevel: 'MEDIUM',
          score: 78,
          finalView: 'Breakout Watch',
          notes: 'Conditional watchlist only.',
          warnings: []
        }
      ],
      avoidRows: [
        {
          ticker: 'HOT',
          company: 'Hot AI',
          theme: 'AI Robotics',
          price: 4,
          marketCap: 250_000_000,
          avgVolume: 600_000,
          relativeVolume: 4,
          rsi: 91,
          sma20Status: 'ABOVE',
          sma50Status: 'ABOVE',
          sma200Status: 'BELOW',
          distanceFrom52WeekHigh: 3,
          pattern: 'Momentum extension',
          catalyst: 'Press release momentum.',
          entryZone: '$3.92-$4.12 after confirmation/retest',
          stopLoss: '$3.60-$3.76 or below swing low',
          targetZone: '$4.60-$5.20; scale only after base holds',
          riskReward: 2,
          riskLevel: 'HIGH',
          score: 48,
          finalView: 'Avoid',
          notes: 'No chase.',
          warnings: ['RSI above 85; wait for new base.']
        }
      ]
    });

    assert.equal(output.scan_date, '2026-05-10');
    assert.equal(output.watchlist[0].ticker, 'BOTX');
    assert.equal(output.watchlist[0].target_1, '$9.78');
    assert.equal(output.watchlist[0].target_2, '$11.05');
    assert.equal(output.top_3[0].ticker, 'BOTX');
    assert.equal(output.avoid_list[0].ticker, 'HOT');
    assert.equal(output.disclaimer, 'This is for educational screening only, not personal investment advice.');
  });
});
