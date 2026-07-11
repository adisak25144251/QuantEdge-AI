import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTechnicalConfluence } from './technicalConfluence';

test('technical confluence requires broad confirmation for a high score', () => {
  const result = calculateTechnicalConfluence({
    trend: 'AGREE',
    momentum: 'AGREE',
    volume: 'AGREE',
    structure: 'AGREE',
    patternConfidence: 82,
    rewardRisk: 2.4,
    regime: 'TRENDING',
    divergenceAligned: true,
    dataStatus: 'PASS'
  });

  assert.equal(result.score, 96);
  assert.equal(result.grade, 'HIGH');
  assert.equal(result.confirmations, 5);
});

test('technical confluence does not inflate weak mixed evidence to actionable confidence', () => {
  const result = calculateTechnicalConfluence({
    trend: 'NEUTRAL',
    momentum: 'DISAGREE',
    volume: 'NEUTRAL',
    structure: 'NEUTRAL',
    patternConfidence: null,
    rewardRisk: 2,
    regime: 'CHOPPY',
    divergenceAligned: false,
    dataStatus: 'PASS'
  });

  assert.equal(result.score, 33);
  assert.equal(result.grade, 'INSUFFICIENT');
  assert.equal(result.disagreements, 1);
});

test('technical confluence blocks confidence when market data is blocked', () => {
  const result = calculateTechnicalConfluence({
    trend: 'AGREE',
    momentum: 'AGREE',
    volume: 'AGREE',
    structure: 'AGREE',
    patternConfidence: 90,
    rewardRisk: 3,
    regime: 'TRENDING',
    divergenceAligned: true,
    dataStatus: 'BLOCK'
  });

  assert.equal(result.score, 0);
  assert.equal(result.grade, 'INSUFFICIENT');
});
