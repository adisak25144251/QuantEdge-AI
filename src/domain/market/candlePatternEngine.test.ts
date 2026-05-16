import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectCandlePatterns, type PatternCandle } from './candlePatternEngine';

describe('candlePatternEngine', () => {
  it('detects VCP and volume dry-up from real candle structure', () => {
    const candles = [
      ...contractingSegment(100, 20, 0.24, 1_000_000, 0),
      ...contractingSegment(103, 20, 0.14, 850_000, 20),
      ...contractingSegment(104, 20, 0.06, 420_000, 40)
    ];

    const report = detectCandlePatterns(candles);

    assert.equal(report.signals.some(signal => signal.name === 'VCP'), true);
    assert.equal(report.signals.some(signal => signal.name === 'Volume Dry-Up'), true);
    assert.equal(report.features.volumeDryUp, true);
  });

  it('detects breakout and retest from prior base high', () => {
    const base = Array.from({ length: 65 }, (_, index) => makeCandle(index, 95 + (index % 5), 1_000_000));
    const recent = [
      makeCandle(65, 99, 1_400_000),
      makeCandle(66, 101, 2_000_000),
      makeCandle(67, 103, 2_100_000),
      makeCandle(68, 101, 1_500_000),
      makeCandle(69, 102, 1_300_000)
    ];

    const report = detectCandlePatterns([...base, ...recent]);

    assert.equal(report.signals.some(signal => signal.name === 'Breakout + Retest'), true);
  });

  it('returns manual confirmation when history is too thin', () => {
    const report = detectCandlePatterns([makeCandle(1, 10, 100_000)]);

    assert.equal(report.primaryPattern, 'Pattern requires manual confirmation');
    assert.equal(report.warnings.some(warning => warning.includes('at least 30 candles')), true);
  });
});

function contractingSegment(base: number, length: number, range: number, volume: number, offset: number): PatternCandle[] {
  return Array.from({ length }, (_, index) => {
    const drift = index * 0.08;
    const close = base + drift + Math.sin(index / 3) * base * range * 0.08;
    const high = close * (1 + range / 2);
    const low = close * (1 - range / 2);
    return {
      time: offset + index,
      open: close * 0.995,
      high,
      low,
      close,
      volume
    };
  });
}

function makeCandle(time: number, close: number, volume: number): PatternCandle {
  return {
    time,
    open: close * 0.99,
    high: close * 1.02,
    low: close * 0.98,
    close,
    volume
  };
}
