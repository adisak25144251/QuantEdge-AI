import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvidenceLedger, createEvidenceRecord } from './evidenceLedger';

test('buildEvidenceLedger allows only complete passing evidence before plan recording', () => {
  const ledger = buildEvidenceLedger([
    createEvidenceRecord({ area: 'DATA_QUALITY', status: 'PASS', referenceId: 'BTCUSDT-1h', summary: 'Fresh candles.' }),
    createEvidenceRecord({ area: 'STRATEGY', status: 'PASS', referenceId: 'trend-v1', summary: 'Robust strategy evidence.' }),
    createEvidenceRecord({ area: 'RISK', status: 'PASS', referenceId: 'risk-policy', summary: 'Risk is within policy.' }),
    createEvidenceRecord({ area: 'AI_GOVERNANCE', status: 'PASS', referenceId: 'ai-review', summary: 'Evidence-based response.' }),
    createEvidenceRecord({ area: 'PORTFOLIO', status: 'PASS', referenceId: 'portfolio', summary: 'No concentration breach.' })
  ]);

  assert.equal(ledger.status, 'PASS');
  assert.equal(ledger.canRecordPlan, true);
  assert.equal(ledger.missingAreas.length, 0);
});

test('buildEvidenceLedger blocks when required evidence is missing or blocked', () => {
  const ledger = buildEvidenceLedger([
    createEvidenceRecord({ area: 'DATA_QUALITY', status: 'PASS', referenceId: 'BTCUSDT-1h', summary: 'Fresh candles.' }),
    createEvidenceRecord({ area: 'RISK', status: 'BLOCK', referenceId: 'risk-policy', summary: 'RR below threshold.' })
  ]);

  assert.equal(ledger.status, 'BLOCK');
  assert.equal(ledger.canRecordPlan, false);
  assert.ok(ledger.missingAreas.includes('STRATEGY'));
  assert.ok(ledger.blockingCodes.includes('RISK_BLOCKED'));
});
