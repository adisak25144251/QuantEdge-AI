import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCorrelationMatrix } from './correlationMatrix';

test('buildCorrelationMatrix computes pairwise return correlation from close series', () => {
  const matrix = buildCorrelationMatrix({
    BTCUSDT: [100, 102, 104, 106, 108],
    ETHUSDT: [50, 51, 52, 53, 54],
    XAUUSD: [200, 199, 198, 197, 196]
  });

  const btcEth = matrix.pairs.find(pair => pair.a === 'BTCUSDT' && pair.b === 'ETHUSDT');
  const btcXau = matrix.pairs.find(pair => pair.a === 'BTCUSDT' && pair.b === 'XAUUSD');

  assert.ok((btcEth?.value ?? 0) > 0.99);
  assert.ok((btcXau?.value ?? 0) < -0.99);
});

test('buildCorrelationMatrix reports missing history without inventing precision', () => {
  const matrix = buildCorrelationMatrix({
    BTCUSDT: [100],
    ETHUSDT: [50, 51, 52]
  });

  assert.equal(matrix.status, 'REVIEW');
  assert.ok(matrix.issues.some(issue => issue.code === 'INSUFFICIENT_CORRELATION_HISTORY'));
});
