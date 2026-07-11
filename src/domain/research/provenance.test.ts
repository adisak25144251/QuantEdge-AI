import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLatestSecFact } from './provenance';

test('extractLatestSecFact selects latest filed audited fact with provenance', () => {
  const result = extractLatestSecFact({
    cik: 1234,
    facts: { 'us-gaap': { Revenues: { units: { USD: [
      { val: 10, filed: '2024-02-01', end: '2023-12-31', form: '10-K', accn: '0001-24-000001' },
      { val: 12, filed: '2025-02-01', end: '2024-12-31', form: '10-K', accn: '0001-25-000001' }
    ] } } } }
  }, ['Revenues']);

  assert.equal(result.value, 12);
  assert.equal(result.observedAt, '2025-02-01');
  assert.equal(result.accessionNumber, '0001-25-000001');
  assert.match(result.sourceUrl ?? '', /sec\.gov\/Archives/);
});
test('extractLatestSecFact refuses unsupported or missing facts', () => {
  const result = extractLatestSecFact({ facts: { 'us-gaap': { Revenues: { units: { USD: [
    { val: 99, filed: '2026-01-01', form: '8-K' }
  ] } } } } }, ['Revenues']);
  assert.equal(result.status, 'DATA_REQUIRED');
  assert.equal(result.value, null);
});
