export type ExecutionQualityStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface ExecutionFillSample {
  id: string;
  side: 'LONG' | 'SHORT';
  intendedPrice: number;
  fillPrice: number;
  signalAt: number;
  filledAt: number;
  quantity: number;
  feeUsd: number;
}

export interface ExecutionQualityIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ExecutionQualityInput {
  fills: ExecutionFillSample[];
  maxAverageSlippageBps?: number;
  maxP95LatencyMs?: number;
  maxFeeBps?: number;
}

export interface ExecutionQualityReport {
  status: ExecutionQualityStatus;
  samples: number;
  averageSlippageBps: number;
  p95LatencyMs: number;
  totalFeesUsd: number;
  feeBps: number;
  issues: ExecutionQualityIssue[];
}

export function evaluateExecutionQuality(input: ExecutionQualityInput): ExecutionQualityReport {
  const issues: ExecutionQualityIssue[] = [];
  const maxAverageSlippageBps = input.maxAverageSlippageBps ?? 12;
  const maxP95LatencyMs = input.maxP95LatencyMs ?? 1_500;
  const maxFeeBps = input.maxFeeBps ?? 8;
  const samples = input.fills.length;

  if (samples === 0) {
    issues.push({
      code: 'NO_EXECUTION_SAMPLES',
      severity: 'WARNING',
      message: 'No execution quality samples are available.'
    });
  }

  const slippages = input.fills.map(fill => computeSlippageBps(fill));
  const latencies = input.fills.map(fill => Math.max(0, fill.filledAt - fill.signalAt));
  const notionals = input.fills.map(fill => Math.abs(safeNumber(fill.fillPrice) * safeNumber(fill.quantity)));
  const totalNotional = notionals.reduce((sum, value) => sum + value, 0);
  const totalFeesUsd = round(input.fills.reduce((sum, fill) => sum + safeNumber(fill.feeUsd), 0), 2);
  const averageSlippageBps = samples > 0 ? round(slippages.reduce((sum, value) => sum + value, 0) / samples, 2) : 0;
  const p95LatencyMs = percentile(latencies, 95);
  const feeBps = totalNotional > 0 ? round((totalFeesUsd / totalNotional) * 10_000, 2) : 0;

  if (averageSlippageBps > maxAverageSlippageBps) {
    issues.push({
      code: 'AVERAGE_SLIPPAGE_EXCEEDED',
      severity: 'ERROR',
      message: `Average execution slippage exceeds ${maxAverageSlippageBps} bps.`
    });
  }

  if (p95LatencyMs > maxP95LatencyMs) {
    issues.push({
      code: 'EXECUTION_LATENCY_EXCEEDED',
      severity: 'ERROR',
      message: `P95 execution latency exceeds ${maxP95LatencyMs}ms.`
    });
  }

  if (feeBps > maxFeeBps) {
    issues.push({
      code: 'EXECUTION_FEES_EXCEEDED',
      severity: 'ERROR',
      message: `Execution fees exceed ${maxFeeBps} bps.`
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    samples,
    averageSlippageBps,
    p95LatencyMs,
    totalFeesUsd,
    feeBps,
    issues
  };
}

function computeSlippageBps(fill: ExecutionFillSample): number {
  const intended = safeNumber(fill.intendedPrice);
  if (intended <= 0) return 0;
  const raw = fill.side === 'LONG'
    ? (safeNumber(fill.fillPrice) - intended) / intended
    : (intended - safeNumber(fill.fillPrice)) / intended;
  return round(Math.max(0, raw) * 10_000, 2);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return round(sorted[Math.min(sorted.length - 1, Math.max(0, index))], 2);
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
