import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateApprovalWorkflow } from './approvalWorkflow';

test('evaluateApprovalWorkflow allows promotion only with required independent roles', () => {
  const result = evaluateApprovalWorkflow({
    requestedAction: 'PROMOTE_STRATEGY',
    approvals: [
      { userId: 'u1', role: 'ANALYST', decision: 'APPROVE', decidedAt: '2026-01-01T00:00:00Z' },
      { userId: 'u2', role: 'RISK_MANAGER', decision: 'APPROVE', decidedAt: '2026-01-01T01:00:00Z' }
    ]
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.actionAllowed, true);
});

test('evaluateApprovalWorkflow blocks self-only or rejected approvals', () => {
  const result = evaluateApprovalWorkflow({
    requestedAction: 'UNLOCK_SMALL_LIVE',
    approvals: [
      { userId: 'u1', role: 'ADMIN', decision: 'APPROVE', decidedAt: '2026-01-01T00:00:00Z' },
      { userId: 'u1', role: 'RISK_MANAGER', decision: 'APPROVE', decidedAt: '2026-01-01T01:00:00Z' }
    ]
  });

  assert.equal(result.status, 'BLOCK');
  assert.equal(result.actionAllowed, false);
  assert.ok(result.issues.some(issue => issue.code === 'INSUFFICIENT_INDEPENDENT_APPROVERS'));
});
