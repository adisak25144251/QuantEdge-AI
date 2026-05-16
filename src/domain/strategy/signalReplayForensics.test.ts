import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSignalReplayForensics } from './signalReplayForensics';

describe('signalReplayForensics', () => {
  it('creates an auditable replay with deterministic fingerprint', () => {
    const replay = buildSignalReplayForensics({
      signalId: 'sig-1',
      symbol: 'BTCUSDT',
      generatedAt: '2026-05-10T00:00:00.000Z',
      dataQualityStatus: 'PASS',
      strategyVersionId: 'strat-v1',
      indicators: { rsi: 55, atrPercent: 1.2 },
      decisionFactors: [
        { name: 'Trend alignment', passed: true, weight: 40 },
        { name: 'Risk reward', passed: true, weight: 30 }
      ],
      aiRationale: 'Momentum continuation with controlled risk.'
    });

    assert.equal(replay.status, 'PASS');
    assert.equal(replay.passedWeight, 70);
    assert.match(replay.fingerprint, /^replay-sig-1-/);
  });

  it('blocks forensic replay when critical provenance is missing', () => {
    const replay = buildSignalReplayForensics({
      signalId: '',
      symbol: 'BTCUSDT',
      generatedAt: 'bad-date',
      dataQualityStatus: 'BLOCK',
      strategyVersionId: '',
      indicators: {},
      decisionFactors: [],
      aiRationale: ''
    });

    assert.equal(replay.status, 'BLOCK');
    assert(replay.issues.some(issue => issue.code === 'SIGNAL_ID_MISSING'));
    assert(replay.issues.some(issue => issue.code === 'STRATEGY_VERSION_MISSING'));
  });
});
