import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAiResearchMemoV2 } from './aiResearchMemoV2';

describe('aiResearchMemoV2', () => {
  it('builds a professional thesis memo with bull base bear cases and invalidation', () => {
    const memo = buildAiResearchMemoV2({
      symbol: 'NVDA',
      assetType: 'US_STOCK',
      evidenceStatus: 'PASS',
      riskStatus: 'PASS',
      benchmarkStatus: 'PASS',
      thesis: 'Relative strength breakout with sector confirmation.',
      invalidation: 'Close below prior breakout base.',
      bullCase: 'Continuation above resistance.',
      baseCase: 'Consolidation above breakout zone.',
      bearCase: 'Failed breakout into gap fill.'
    });

    assert.equal(memo.status, 'PASS');
    assert(memo.markdown.includes('## Bull Case'));
  });

  it('blocks memos missing invalidation or evidence', () => {
    const memo = buildAiResearchMemoV2({
      symbol: 'BTCUSDT',
      assetType: 'CRYPTO',
      evidenceStatus: 'BLOCK',
      riskStatus: 'PASS',
      benchmarkStatus: 'PASS',
      thesis: '',
      invalidation: '',
      bullCase: '',
      baseCase: '',
      bearCase: ''
    });

    assert.equal(memo.status, 'BLOCK');
    assert(memo.issues.some(issue => issue.code === 'INVALIDATION_MISSING'));
  });
});
