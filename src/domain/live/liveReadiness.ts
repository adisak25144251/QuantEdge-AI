export type GateStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type LiveReadinessStatus = 'NOT_READY' | 'PAPER_ONLY' | 'READY_FOR_SMALL_LIVE';
export type ExecutionMode = 'NONE' | 'MANUAL_ONLY' | 'API_CONNECTED';

export interface ReadinessGate {
  code: string;
  status: GateStatus;
  label: string;
  detail: string;
}

export interface LiveReadinessInput {
  marketDataStatus: GateStatus;
  riskPolicyStatus: GateStatus;
  paperTrading: {
    closedTrades: number;
    expectancyR: number;
    maxDrawdownPercent: number;
    winRate: number;
  };
  backtest: {
    sampleSize: number;
    outOfSampleExpectancyR: number;
    maxDrawdownPercent: number;
  };
  aiBackendConfigured: boolean;
  executionMode: ExecutionMode;
}

export interface LiveReadinessResult {
  status: LiveReadinessStatus;
  label: string;
  summary: string;
  gates: ReadinessGate[];
}

const MIN_PAPER_TRADES = 50;
const MIN_BACKTEST_TRADES = 200;

export function evaluateLiveReadiness(input: LiveReadinessInput): LiveReadinessResult {
  const gates: ReadinessGate[] = [
    evaluateMarketDataGate(input.marketDataStatus),
    evaluateRiskGate(input.riskPolicyStatus),
    ...evaluatePaperGates(input.paperTrading),
    ...evaluateBacktestGates(input.backtest),
    evaluateAiGate(input.aiBackendConfigured),
    evaluateExecutionGate(input.executionMode)
  ];

  const hasBlock = gates.some(gate => gate.status === 'BLOCK');
  const hasReview = gates.some(gate => gate.status === 'REVIEW');
  const status: LiveReadinessStatus = hasBlock
    ? 'NOT_READY'
    : hasReview
      ? 'PAPER_ONLY'
      : 'READY_FOR_SMALL_LIVE';

  return {
    status,
    label: statusToLabel(status),
    summary: statusToSummary(status),
    gates
  };
}

function evaluateMarketDataGate(status: GateStatus): ReadinessGate {
  if (status === 'BLOCK') {
    return gate('MARKET_DATA_BLOCKED', 'BLOCK', 'Market data integrity', 'Current market data is blocked by integrity checks.');
  }

  if (status === 'REVIEW') {
    return gate('MARKET_DATA_REVIEW', 'REVIEW', 'Market data integrity', 'Market data is usable only with review, usually due to freshness or quality warnings.');
  }

  return gate('MARKET_DATA_OK', 'PASS', 'Market data integrity', 'Market data passes the current integrity checks.');
}

function evaluateRiskGate(status: GateStatus): ReadinessGate {
  if (status === 'BLOCK') {
    return gate('RISK_POLICY_BLOCKED', 'BLOCK', 'Risk policy', 'Current risk policy blocks this setup or account state.');
  }

  if (status === 'REVIEW') {
    return gate('RISK_POLICY_REVIEW', 'REVIEW', 'Risk policy', 'Risk controls need manual review before the setup can be recorded.');
  }

  return gate('RISK_POLICY_OK', 'PASS', 'Risk policy', 'Risk controls pass the current policy limits.');
}

function evaluatePaperGates(paperTrading: LiveReadinessInput['paperTrading']): ReadinessGate[] {
  const gates: ReadinessGate[] = [];

  gates.push(paperTrading.closedTrades >= MIN_PAPER_TRADES
    ? gate('PAPER_SAMPLE_OK', 'PASS', 'Paper trading sample', `${paperTrading.closedTrades} closed paper trades recorded.`)
    : gate('PAPER_SAMPLE_TOO_SMALL', 'REVIEW', 'Paper trading sample', `Need at least ${MIN_PAPER_TRADES} closed paper trades before live escalation.`));

  if (paperTrading.expectancyR <= 0) {
    gates.push(gate('PAPER_EXPECTANCY_NOT_POSITIVE', 'BLOCK', 'Paper expectancy', 'Paper-trading expectancy must be positive in R.'));
  } else {
    gates.push(gate('PAPER_EXPECTANCY_OK', 'PASS', 'Paper expectancy', `Paper expectancy is ${paperTrading.expectancyR}R.`));
  }

  if (paperTrading.maxDrawdownPercent > 20) {
    gates.push(gate('PAPER_DRAWDOWN_BLOCKED', 'BLOCK', 'Paper drawdown', 'Paper-trading drawdown is above the hard 20% limit.'));
  } else if (paperTrading.maxDrawdownPercent > 10) {
    gates.push(gate('PAPER_DRAWDOWN_REVIEW', 'REVIEW', 'Paper drawdown', 'Paper-trading drawdown is above the 10% escalation threshold.'));
  } else {
    gates.push(gate('PAPER_DRAWDOWN_OK', 'PASS', 'Paper drawdown', `Paper max drawdown is ${paperTrading.maxDrawdownPercent}%.`));
  }

  return gates;
}

function evaluateBacktestGates(backtest: LiveReadinessInput['backtest']): ReadinessGate[] {
  const gates: ReadinessGate[] = [];

  gates.push(backtest.sampleSize >= MIN_BACKTEST_TRADES
    ? gate('BACKTEST_SAMPLE_OK', 'PASS', 'Out-of-sample backtest', `${backtest.sampleSize} out-of-sample trades recorded.`)
    : gate('BACKTEST_SAMPLE_TOO_SMALL', 'BLOCK', 'Out-of-sample backtest', `Need at least ${MIN_BACKTEST_TRADES} out-of-sample trades.`));

  if (backtest.outOfSampleExpectancyR <= 0) {
    gates.push(gate('BACKTEST_EXPECTANCY_NOT_POSITIVE', 'BLOCK', 'Backtest expectancy', 'Out-of-sample expectancy must be positive in R.'));
  } else {
    gates.push(gate('BACKTEST_EXPECTANCY_OK', 'PASS', 'Backtest expectancy', `Out-of-sample expectancy is ${backtest.outOfSampleExpectancyR}R.`));
  }

  if (backtest.maxDrawdownPercent > 25) {
    gates.push(gate('BACKTEST_DRAWDOWN_BLOCKED', 'BLOCK', 'Backtest drawdown', 'Out-of-sample drawdown is above the hard 25% limit.'));
  } else if (backtest.maxDrawdownPercent > 20) {
    gates.push(gate('BACKTEST_DRAWDOWN_REVIEW', 'REVIEW', 'Backtest drawdown', 'Out-of-sample drawdown is above the 20% escalation threshold.'));
  } else {
    gates.push(gate('BACKTEST_DRAWDOWN_OK', 'PASS', 'Backtest drawdown', `Out-of-sample max drawdown is ${backtest.maxDrawdownPercent}%.`));
  }

  return gates;
}

function evaluateAiGate(aiBackendConfigured: boolean): ReadinessGate {
  return aiBackendConfigured
    ? gate('AI_BACKEND_OK', 'PASS', 'AI backend', 'Server-side AI backend is configured.')
    : gate('AI_BACKEND_REVIEW', 'REVIEW', 'AI backend', 'Server-side AI backend is not configured; AI guidance is unavailable.');
}

function evaluateExecutionGate(mode: ExecutionMode): ReadinessGate {
  if (mode === 'API_CONNECTED') {
    return gate('API_EXECUTION_NOT_AUDITED', 'BLOCK', 'Execution mode', 'API exchange execution is not audited or approved for this phase.');
  }

  if (mode === 'NONE') {
    return gate('EXECUTION_MODE_REVIEW', 'REVIEW', 'Execution mode', 'Execution is disabled; continue paper trading and manual review.');
  }

  return gate('MANUAL_EXECUTION_ONLY', 'PASS', 'Execution mode', 'Manual-only execution mode is active.');
}

function gate(code: string, status: GateStatus, label: string, detail: string): ReadinessGate {
  return { code, status, label, detail };
}

function statusToLabel(status: LiveReadinessStatus): string {
  switch (status) {
    case 'READY_FOR_SMALL_LIVE':
      return 'Ready for small manual live';
    case 'PAPER_ONLY':
      return 'Paper only';
    default:
      return 'Not ready';
  }
}

function statusToSummary(status: LiveReadinessStatus): string {
  switch (status) {
    case 'READY_FOR_SMALL_LIVE':
      return 'All current gates pass for small, manually executed live sizing.';
    case 'PAPER_ONLY':
      return 'No hard blocks, but evidence or configuration still needs review before live escalation.';
    default:
      return 'One or more hard gates block live readiness.';
  }
}
