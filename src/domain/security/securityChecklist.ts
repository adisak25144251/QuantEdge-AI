export type SecurityChecklistStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface SecurityChecklistInput {
  serverSideAiKey: boolean;
  clientSecretExposure: boolean;
  rateLimitEnabled: boolean;
  payloadValidation: boolean;
  securityHeadersEnabled: boolean;
  apiTradingDisabled: boolean;
}

export interface SecurityChecklistIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface SecurityChecklistReport {
  status: SecurityChecklistStatus;
  issues: SecurityChecklistIssue[];
}

export function evaluateSecurityChecklist(input: SecurityChecklistInput): SecurityChecklistReport {
  const issues: SecurityChecklistIssue[] = [];

  if (!input.serverSideAiKey || input.clientSecretExposure) {
    issues.push({
      code: 'CLIENT_SECRET_EXPOSURE',
      severity: 'ERROR',
      message: 'Secrets must stay server-side and never be exposed to the client bundle.'
    });
  }

  if (!input.rateLimitEnabled) {
    issues.push({
      code: 'RATE_LIMIT_MISSING',
      severity: 'WARNING',
      message: 'Sensitive API endpoints should have baseline rate limiting.'
    });
  }

  if (!input.payloadValidation) {
    issues.push({
      code: 'PAYLOAD_VALIDATION_MISSING',
      severity: 'ERROR',
      message: 'External API payloads need schema and size validation.'
    });
  }

  if (!input.securityHeadersEnabled) {
    issues.push({
      code: 'SECURITY_HEADERS_MISSING',
      severity: 'WARNING',
      message: 'Baseline browser security headers should be enabled.'
    });
  }

  if (!input.apiTradingDisabled) {
    issues.push({
      code: 'API_TRADING_NOT_DISABLED',
      severity: 'ERROR',
      message: 'Real-money API trading must remain disabled until the full approval process passes.'
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR')
      ? 'BLOCK'
      : issues.length > 0
        ? 'REVIEW'
        : 'PASS',
    issues
  };
}
