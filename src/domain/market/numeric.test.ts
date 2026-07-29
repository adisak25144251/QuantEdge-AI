import assert from 'node:assert/strict';
import test from 'node:test';
import { numberOrNull } from './numeric';

test('numberOrNull does not coerce missing values or booleans to zero', () => {
  assert.equal(numberOrNull(null), null);
  assert.equal(numberOrNull(undefined), null);
  assert.equal(numberOrNull(''), null);
  assert.equal(numberOrNull(false), null);
});

test('numberOrNull accepts finite numeric values including an explicit zero', () => {
  assert.equal(numberOrNull(0), 0);
  assert.equal(numberOrNull('12.5'), 12.5);
  assert.equal(numberOrNull(Number.NaN), null);
  assert.equal(numberOrNull(Number.POSITIVE_INFINITY), null);
});
