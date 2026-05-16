import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExecutionQuality } from './executionQualityAnalytics';

describe('executionQualityAnalytics', () => {
  it('passes when slippage, latency, and fees stay inside professional limits', () => {
    const report = evaluateExecutionQuality({
      fills: [
        { id: '1', side: 'LONG', intendedPrice: 100, fillPrice: 100.03, signalAt: 0, filledAt: 350, quantity: 1, feeUsd: 0.02 },
        { id: '2', side: 'SHORT', intendedPrice: 200, fillPrice: 199.94, signalAt: 1_000, filledAt: 1_300, quantity: 2, feeUsd: 0.04 }
      ],
      maxAverageSlippageBps: 8,
      maxP95LatencyMs: 800,
      maxFeeBps: 5
    });

    assert.equal(report.status, 'PASS');
    assert.equal(report.averageSlippageBps, 3);
    assert.equal(report.p95LatencyMs, 350);
    assert.deepEqual(report.issues, []);
  });

  it('blocks poor execution quality before real capital escalation', () => {
    const report = evaluateExecutionQuality({
      fills: [
        { id: '1', side: 'LONG', intendedPrice: 100, fillPrice: 101, signalAt: 0, filledAt: 4_000, quantity: 1, feeUsd: 1 },
        { id: '2', side: 'LONG', intendedPrice: 100, fillPrice: 100.8, signalAt: 0, filledAt: 3_500, quantity: 1, feeUsd: 1 }
      ],
      maxAverageSlippageBps: 20,
      maxP95LatencyMs: 1_000,
      maxFeeBps: 20
    });

    assert.equal(report.status, 'BLOCK');
    assert(report.issues.some(issue => issue.code === 'AVERAGE_SLIPPAGE_EXCEEDED'));
    assert(report.issues.some(issue => issue.code === 'EXECUTION_LATENCY_EXCEEDED'));
    assert(report.issues.some(issue => issue.code === 'EXECUTION_FEES_EXCEEDED'));
  });
});
