import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInstitutionalAuditArtifact, buildInstitutionalAuditPath } from './institutionalAuditPersistence';

test('buildInstitutionalAuditPath scopes audit artifacts under the user and artifact kind', () => {
  const path = buildInstitutionalAuditPath('user-1', 'EVIDENCE_LEDGER', 'ledger-1');

  assert.equal(path, 'users/user-1/institutionalAudit/EVIDENCE_LEDGER/items/ledger-1');
});

test('buildInstitutionalAuditArtifact serializes evidence for deterministic persistence', () => {
  const artifact = buildInstitutionalAuditArtifact({
    id: 'ledger-1',
    kind: 'EVIDENCE_LEDGER',
    symbol: 'BTCUSDT',
    status: 'PASS',
    payload: { canRecordPlan: true },
    createdAt: 1_700_000_000_000
  });

  assert.equal(artifact.id, 'ledger-1');
  assert.equal(artifact.kind, 'EVIDENCE_LEDGER');
  assert.equal(artifact.payloadJson, '{"canRecordPlan":true}');
});
