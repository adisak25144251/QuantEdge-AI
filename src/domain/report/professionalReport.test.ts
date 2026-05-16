import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProfessionalTradeReport } from './professionalReport';

test('buildProfessionalTradeReport creates a complete auditable markdown report', () => {
  const report = buildProfessionalTradeReport({
    title: 'BTCUSDT Long Review',
    symbol: 'BTCUSDT',
    generatedAt: '2026-01-01T00:00:00Z',
    sections: [
      { title: 'Setup', status: 'PASS', lines: ['Entry 100, SL 95, TP 110'] },
      { title: 'Risk', status: 'PASS', lines: ['1% account risk'] },
      { title: 'Evidence', status: 'PASS', lines: ['Ledger complete'] }
    ]
  });

  assert.equal(report.status, 'PASS');
  assert.ok(report.markdown.includes('# BTCUSDT Long Review'));
  assert.ok(report.markdown.includes('## Evidence'));
});

test('buildProfessionalTradeReport blocks incomplete reports', () => {
  const report = buildProfessionalTradeReport({
    title: 'Incomplete',
    symbol: 'BTCUSDT',
    generatedAt: '2026-01-01T00:00:00Z',
    sections: []
  });

  assert.equal(report.status, 'BLOCK');
  assert.ok(report.issues.some(issue => issue.code === 'REPORT_SECTIONS_MISSING'));
});
