import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAiResponseGovernance } from './aiGovernance';

test('evaluateAiResponseGovernance passes advisory evidence-based responses', () => {
  const report = evaluateAiResponseGovernance({
    responseText: 'This is an analytical view, not financial advice. Evidence: OOS expectancy positive. Risk: drawdown should remain capped.',
    evidenceReferences: ['backtest', 'risk-policy'],
    hasMarketContext: true
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.issues.length, 0);
});

test('evaluateAiResponseGovernance blocks imperative trade advice without evidence', () => {
  const report = evaluateAiResponseGovernance({
    responseText: 'Buy now with full size. Guaranteed profit.',
    evidenceReferences: [],
    hasMarketContext: false
  });

  assert.equal(report.status, 'BLOCK');
  assert.ok(report.issues.some(issue => issue.code === 'IMPERATIVE_TRADE_ADVICE'));
  assert.ok(report.issues.some(issue => issue.code === 'NO_EVIDENCE_REFERENCES'));
});
