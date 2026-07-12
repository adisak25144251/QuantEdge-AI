import assert from 'node:assert/strict';
import test from 'node:test';
import { describeMaterialFiling, type FilingEvidenceItem } from './researchClient';

test('describeMaterialFiling exposes only verified timestamped filing evidence', () => {
  const evidence: FilingEvidenceItem = {
    symbol: 'NVDA',
    status: 'VERIFIED',
    provider: 'SEC EDGAR Submissions',
    material: { form: '10-Q', filedAt: '2026-05-20', ageDays: 10, items: [], sourceUrl: 'https://sec.example/filing' },
    dilution: null
  };
  const result = describeMaterialFiling(evidence, 'fallback');
  assert.equal(result.catalystAgeDays, 10);
  assert.match(result.catalyst, /SEC 10-Q filed 2026-05-20/);
});

test('describeMaterialFiling retains Data required semantics for unverified evidence', () => {
  const result = describeMaterialFiling(undefined, 'Research thesis only');
  assert.equal(result.catalystAgeDays, null);
  assert.equal(result.catalyst, 'Research thesis only');
});
