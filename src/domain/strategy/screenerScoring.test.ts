import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreScreenerSetup } from './screenerScoring';

test('scoreScreenerSetup derives long direction from positive momentum', () => {
  const setup = scoreScreenerSetup({
    symbol: 'SOLUSDT',
    lastPrice: '150',
    priceChangePercent: '6.5',
    volume: '2000000',
  });

  assert.equal(setup.direction, 'LONG');
  assert.equal(setup.logic, 'Momentum continuation');
  assert.ok(setup.confidence > 70);
});

test('scoreScreenerSetup derives short direction from negative momentum', () => {
  const setup = scoreScreenerSetup({
    symbol: 'ETHUSDT',
    lastPrice: '3000',
    priceChangePercent: '-4.2',
    volume: '1200000',
  });

  assert.equal(setup.direction, 'SHORT');
  assert.equal(setup.logic, 'Bearish momentum continuation');
  assert.ok(setup.confidence > 65);
});

test('scoreScreenerSetup keeps confidence bounded and deterministic', () => {
  const input = {
    symbol: 'BTCUSDT',
    lastPrice: '65000',
    priceChangePercent: '99',
    volume: '999999999',
  };

  const first = scoreScreenerSetup(input);
  const second = scoreScreenerSetup(input);

  assert.deepEqual(first, second);
  assert.equal(first.confidence, 95);
});
