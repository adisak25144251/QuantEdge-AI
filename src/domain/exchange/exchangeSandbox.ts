export type ExchangeSandboxStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type ExchangeSandboxMode = 'READ_ONLY_SANDBOX' | 'NOT_CONNECTED' | 'BLOCKED';

export interface ExchangeSandboxInput {
  readOnlyKeyConfigured: boolean;
  tradingPermissionDetected: boolean;
  balancesConnected: boolean;
  orderPlacementEnabled: boolean;
}

export interface ExchangeSandboxIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ExchangeSandboxReport {
  status: ExchangeSandboxStatus;
  mode: ExchangeSandboxMode;
  issues: ExchangeSandboxIssue[];
}

export function evaluateExchangeSandbox(input: ExchangeSandboxInput): ExchangeSandboxReport {
  const issues: ExchangeSandboxIssue[] = [];

  if (input.tradingPermissionDetected || input.orderPlacementEnabled) {
    issues.push({
      code: 'TRADING_PERMISSION_DETECTED',
      severity: 'ERROR',
      message: 'Sandbox keys must be read-only. Trading permission or order placement is blocked.'
    });
  }

  if (!input.readOnlyKeyConfigured) {
    issues.push({
      code: 'READ_ONLY_KEY_MISSING',
      severity: 'WARNING',
      message: 'Read-only exchange sandbox key is not configured.'
    });
  }

  if (!input.balancesConnected) {
    issues.push({
      code: 'BALANCE_OBSERVATION_MISSING',
      severity: 'WARNING',
      message: 'Read-only balance observation is not connected.'
    });
  }

  const status = issues.some(issue => issue.severity === 'ERROR')
    ? 'BLOCK'
    : issues.length > 0
      ? 'REVIEW'
      : 'PASS';

  return {
    status,
    mode: status === 'BLOCK'
      ? 'BLOCKED'
      : input.readOnlyKeyConfigured
        ? 'READ_ONLY_SANDBOX'
        : 'NOT_CONNECTED',
    issues
  };
}
