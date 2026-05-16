export type ExchangeAdapterStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type ExchangeAdapterEnvironment = 'TESTNET' | 'PAPER' | 'PRODUCTION';
export type ExchangeAdapterCapability = 'MARKET_DATA' | 'BALANCE_READ' | 'ORDER_SIMULATION' | 'ORDER_PLACE';
export type ExchangeAdapterExecutionMode = 'READ_ONLY' | 'SIMULATION_ONLY' | 'BLOCKED';

export interface ExchangeAdapterContractInput {
  adapterName: string;
  environment: ExchangeAdapterEnvironment;
  capabilities: ExchangeAdapterCapability[];
  readOnly: boolean;
  canPlaceRealOrders: boolean;
  supportsIdempotency: boolean;
  supportsRateLimitBackoff: boolean;
  supportsKillSwitch: boolean;
}

export interface ExchangeAdapterContractIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ExchangeAdapterContractReport {
  status: ExchangeAdapterStatus;
  executionMode: ExchangeAdapterExecutionMode;
  issues: ExchangeAdapterContractIssue[];
}

export function evaluateExchangeAdapterContract(input: ExchangeAdapterContractInput): ExchangeAdapterContractReport {
  const issues: ExchangeAdapterContractIssue[] = [];
  const capabilities = new Set(input.capabilities);

  if (!input.adapterName.trim()) {
    issues.push({ code: 'ADAPTER_NAME_MISSING', severity: 'ERROR', message: 'Adapter name is required.' });
  }

  if (input.environment === 'PRODUCTION') {
    issues.push({
      code: 'PRODUCTION_ADAPTER_BLOCKED',
      severity: 'ERROR',
      message: 'Production exchange adapters are blocked until a separate real-money approval phase.'
    });
  }

  if (input.canPlaceRealOrders || capabilities.has('ORDER_PLACE') || !input.readOnly) {
    issues.push({
      code: 'REAL_ORDER_CAPABILITY_BLOCKED',
      severity: 'ERROR',
      message: 'Adapter must not expose real order placement in this phase.'
    });
  }

  if (!capabilities.has('MARKET_DATA')) {
    issues.push({ code: 'MARKET_DATA_CAPABILITY_MISSING', severity: 'ERROR', message: 'Adapter must support market data.' });
  }

  if (!capabilities.has('BALANCE_READ')) {
    issues.push({ code: 'BALANCE_READ_CAPABILITY_MISSING', severity: 'WARNING', message: 'Read-only balance observation is missing.' });
  }

  if (!capabilities.has('ORDER_SIMULATION')) {
    issues.push({ code: 'ORDER_SIMULATION_MISSING', severity: 'WARNING', message: 'Order simulation capability is missing.' });
  }

  if (!input.supportsIdempotency) {
    issues.push({ code: 'IDEMPOTENCY_MISSING', severity: 'WARNING', message: 'Adapter should support idempotent request ids.' });
  }

  if (!input.supportsRateLimitBackoff) {
    issues.push({ code: 'RATE_LIMIT_BACKOFF_MISSING', severity: 'WARNING', message: 'Adapter should support rate-limit backoff.' });
  }

  if (!input.supportsKillSwitch) {
    issues.push({ code: 'ADAPTER_KILL_SWITCH_MISSING', severity: 'ERROR', message: 'Adapter must support emergency kill switch integration.' });
  }

  const status = issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS';

  return {
    status,
    executionMode: status === 'BLOCK'
      ? 'BLOCKED'
      : capabilities.has('ORDER_SIMULATION')
        ? 'SIMULATION_ONLY'
        : 'READ_ONLY',
    issues
  };
}
