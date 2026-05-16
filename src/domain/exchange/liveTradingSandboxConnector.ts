export type LiveTradingSandboxStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type LiveTradingConnectorMode = 'TESTNET_SIMULATION' | 'READ_ONLY_OBSERVATION' | 'NOT_CONNECTED' | 'BLOCKED';

export interface LiveTradingSandboxConnectorInput {
  environment: 'TESTNET' | 'PRODUCTION' | 'DISCONNECTED';
  readOnlyKeyConfigured: boolean;
  tradingPermissionDetected: boolean;
  simulatedOrdersEnabled: boolean;
  realOrderPlacementEnabled: boolean;
  latestHeartbeatMs: number | null;
  lastFillSimulationAt: string | null;
  maxHeartbeatMs?: number;
}

export interface LiveTradingSandboxConnectorIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface LiveTradingSandboxConnectorReport {
  status: LiveTradingSandboxStatus;
  connectorMode: LiveTradingConnectorMode;
  realMoneyLocked: true;
  issues: LiveTradingSandboxConnectorIssue[];
}

export function evaluateLiveTradingSandboxConnector(
  input: LiveTradingSandboxConnectorInput
): LiveTradingSandboxConnectorReport {
  const issues: LiveTradingSandboxConnectorIssue[] = [];
  const maxHeartbeatMs = input.maxHeartbeatMs ?? 2_000;

  if (input.environment === 'PRODUCTION') {
    issues.push({
      code: 'PRODUCTION_CONNECTOR_NOT_ALLOWED',
      severity: 'ERROR',
      message: 'Production exchange connectors remain blocked until separate real-money approval exists.'
    });
  }

  if (input.tradingPermissionDetected || input.realOrderPlacementEnabled) {
    issues.push({
      code: 'REAL_ORDER_PLACEMENT_BLOCKED',
      severity: 'ERROR',
      message: 'Real order placement is blocked by the live sandbox connector.'
    });
  }

  if (!input.readOnlyKeyConfigured) {
    issues.push({
      code: 'READ_ONLY_KEY_MISSING',
      severity: 'WARNING',
      message: 'Read-only key is required for exchange observation.'
    });
  }

  if (!input.simulatedOrdersEnabled) {
    issues.push({
      code: 'SIMULATED_ORDERS_DISABLED',
      severity: 'WARNING',
      message: 'Testnet or paper order simulation is not enabled.'
    });
  }

  if (input.latestHeartbeatMs === null || input.latestHeartbeatMs > maxHeartbeatMs) {
    issues.push({
      code: 'CONNECTOR_HEARTBEAT_UNHEALTHY',
      severity: 'WARNING',
      message: `Connector heartbeat must stay below ${maxHeartbeatMs}ms.`
    });
  }

  if (!input.lastFillSimulationAt) {
    issues.push({
      code: 'FILL_SIMULATION_MISSING',
      severity: 'WARNING',
      message: 'No recent fill simulation has been recorded.'
    });
  }

  const status = issues.some(issue => issue.severity === 'ERROR')
    ? 'BLOCK'
    : issues.length > 0
      ? 'REVIEW'
      : 'PASS';

  return {
    status,
    connectorMode: resolveMode(input, status),
    realMoneyLocked: true,
    issues
  };
}

function resolveMode(input: LiveTradingSandboxConnectorInput, status: LiveTradingSandboxStatus): LiveTradingConnectorMode {
  if (status === 'BLOCK') return 'BLOCKED';
  if (input.environment === 'TESTNET' && input.simulatedOrdersEnabled) return 'TESTNET_SIMULATION';
  if (input.readOnlyKeyConfigured) return 'READ_ONLY_OBSERVATION';
  return 'NOT_CONNECTED';
}
