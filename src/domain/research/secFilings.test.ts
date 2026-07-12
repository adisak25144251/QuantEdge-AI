import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyRecentSecFilings, selectFilingEvidence } from './secFilings';

test('SEC filing classifier separates material updates from dilution filings', () => {
  const filings = classifyRecentSecFilings({ filings: { recent: {
    form: ['8-K', 'S-3', '4'],
    filingDate: ['2026-07-10', '2026-07-05', '2026-07-04'],
    reportDate: ['', '', ''],
    accessionNumber: ['a', 'b', 'c'],
    primaryDocument: ['a.htm', 'b.htm', 'c.htm'],
    items: ['2.02,9.01', '', '']
  } } }, new Date('2026-07-12T12:00:00Z'));
  assert.equal(filings[0].signal, 'MATERIAL_UPDATE');
  assert.equal(filings[0].ageDays, 2);
  assert.equal(filings[1].signal, 'DILUTION_RISK');
  assert.equal(selectFilingEvidence(filings).dilution?.form, 'S-3');
});

test('SEC filing classifier does not treat an itemless 8-K as verified catalyst', () => {
  const filings = classifyRecentSecFilings({ filings: { recent: {
    form: ['8-K'], filingDate: ['2026-07-10'], accessionNumber: ['a'], items: ['']
  } } }, new Date('2026-07-12T12:00:00Z'));
  assert.equal(filings[0].signal, 'ROUTINE');
  assert.equal(selectFilingEvidence(filings).material, null);
});
