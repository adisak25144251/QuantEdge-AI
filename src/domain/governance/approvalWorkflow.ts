export type ApprovalRole = 'ANALYST' | 'RISK_MANAGER' | 'ADMIN';
export type ApprovalDecision = 'APPROVE' | 'REJECT';
export type ApprovalAction = 'PROMOTE_STRATEGY' | 'UNLOCK_SMALL_LIVE';
export type ApprovalWorkflowStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface ApprovalRecord {
  userId: string;
  role: ApprovalRole;
  decision: ApprovalDecision;
  decidedAt: string;
}

export interface ApprovalWorkflowInput {
  requestedAction: ApprovalAction;
  approvals: ApprovalRecord[];
}

export interface ApprovalWorkflowIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ApprovalWorkflowResult {
  status: ApprovalWorkflowStatus;
  actionAllowed: boolean;
  requiredRoles: ApprovalRole[];
  issues: ApprovalWorkflowIssue[];
}

const REQUIRED_ROLES: Record<ApprovalAction, ApprovalRole[]> = {
  PROMOTE_STRATEGY: ['ANALYST', 'RISK_MANAGER'],
  UNLOCK_SMALL_LIVE: ['RISK_MANAGER', 'ADMIN']
};

export function evaluateApprovalWorkflow(input: ApprovalWorkflowInput): ApprovalWorkflowResult {
  const requiredRoles = REQUIRED_ROLES[input.requestedAction];
  const approved = input.approvals.filter(approval => approval.decision === 'APPROVE');
  const issues: ApprovalWorkflowIssue[] = [];

  if (input.approvals.some(approval => approval.decision === 'REJECT')) {
    issues.push({ code: 'APPROVAL_REJECTED', severity: 'ERROR', message: 'At least one required approval was rejected.' });
  }

  const approvedRoles = new Set(approved.map(approval => approval.role));
  const missingRoles = requiredRoles.filter(role => !approvedRoles.has(role));
  if (missingRoles.length > 0) {
    issues.push({ code: 'REQUIRED_ROLE_MISSING', severity: 'ERROR', message: `Missing approvals from: ${missingRoles.join(', ')}.` });
  }

  const independentApprovers = new Set(approved.map(approval => approval.userId));
  if (independentApprovers.size < requiredRoles.length) {
    issues.push({
      code: 'INSUFFICIENT_INDEPENDENT_APPROVERS',
      severity: 'ERROR',
      message: 'Required approvals must come from independent users.'
    });
  }

  const status = issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS';
  return {
    status,
    actionAllowed: status === 'PASS',
    requiredRoles,
    issues
  };
}
