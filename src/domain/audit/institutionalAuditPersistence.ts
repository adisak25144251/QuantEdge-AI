export type InstitutionalAuditKind =
  | 'EVIDENCE_LEDGER'
  | 'PLAN_VERSION'
  | 'FORWARD_RESULT'
  | 'POST_TRADE_REVIEW'
  | 'PROFESSIONAL_REPORT';

export type InstitutionalAuditStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface InstitutionalAuditArtifactInput {
  id: string;
  kind: InstitutionalAuditKind;
  symbol: string;
  status: InstitutionalAuditStatus;
  payload: unknown;
  createdAt: number;
}

export interface InstitutionalAuditArtifact {
  id: string;
  kind: InstitutionalAuditKind;
  symbol: string;
  status: InstitutionalAuditStatus;
  payloadJson: string;
  createdAt: number;
}

export function buildInstitutionalAuditPath(userId: string, kind: InstitutionalAuditKind, artifactId: string): string {
  return `users/${sanitizePathPart(userId)}/institutionalAudit/${kind}/items/${sanitizePathPart(artifactId)}`;
}

export function buildInstitutionalAuditArtifact(input: InstitutionalAuditArtifactInput): InstitutionalAuditArtifact {
  return {
    id: input.id,
    kind: input.kind,
    symbol: input.symbol.toUpperCase(),
    status: input.status,
    payloadJson: JSON.stringify(input.payload),
    createdAt: input.createdAt
  };
}

function sanitizePathPart(value: string): string {
  return value.replace(/[/?#[\]]/g, '_');
}
