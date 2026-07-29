import assert from 'node:assert/strict';
import test from 'node:test';
import { describeMaterialFiling, type FilingEvidenceItem } from './researchClient';

test('describeMaterialFiling does not treat a routine periodic report as a positive catalyst', () => {
  const evidence: FilingEvidenceItem = {
    symbol: 'NVDA',
    status: 'VERIFIED',
    provider: 'SEC EDGAR Submissions',
    material: { form: '10-Q', filedAt: '2026-05-20', ageDays: 10, items: [], sourceUrl: 'https://sec.example/filing' },
    dilution: null
  };
  const result = describeMaterialFiling(evidence, 'fallback');
  assert.equal(result.catalystAgeDays, null);
  assert.equal(result.catalystVerified, false);
  assert.equal(result.catalystKind, 'PERIODIC_FILING');
  assert.match(result.catalyst, /SEC 10-Q filed 2026-05-20/);
});

test('describeMaterialFiling accepts timestamped 8-K event evidence without claiming direction', () => {
  const evidence: FilingEvidenceItem = {
    symbol: 'NVDA',
    status: 'VERIFIED',
    provider: 'SEC EDGAR Submissions',
    material: { form: '8-K', filedAt: '2026-05-20', ageDays: 10, items: ['1.01'], sourceUrl: 'https://sec.example/filing' },
    dilution: null
  };
  const result = describeMaterialFiling(evidence, 'fallback');
  assert.equal(result.catalystAgeDays, 10);
  assert.equal(result.catalystVerified, true);
  assert.equal(result.catalystKind, 'EVENT_EVIDENCE');
  assert.match(result.catalyst, /requires analyst interpretation/);
});

test('describeMaterialFiling retains Data required semantics for unverified evidence', () => {
  const result = describeMaterialFiling(undefined, 'Research thesis only');
  assert.equal(result.catalystAgeDays, null);
  assert.equal(result.catalystVerified, false);
  assert.equal(result.catalyst, 'Research thesis only');
});
