import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSignalExplanation } from './signalExplainability';

test('buildSignalExplanation decomposes setup quality into professional evidence buckets', () => {
  const explanation = buildSignalExplanation({
    technicalScore: 78,
    regimeAligned: true,
    volatilityState: 'NORMAL',
    riskReward: 2.2,
    dataQualityStatus: 'PASS',
    confidenceScore: 74,
    confirmations: ['EMA trend', 'RSI momentum', 'Volume expansion'],
    missingConfirmations: ['Higher timeframe retest']
  });

  assert.equal(explanation.status, 'PASS');
  assert.equal(explanation.buckets.length, 5);
  assert.ok(explanation.summaryScore >= 70);
  assert.ok(explanation.buckets.some(bucket => bucket.area === 'TECHNICAL'));
});

test('buildSignalExplanation blocks poor risk and dirty data even with high indicator confidence', () => {
  const explanation = buildSignalExplanation({
    technicalScore: 90,
    regimeAligned: false,
    volatilityState: 'SHOCK',
    riskReward: 1.1,
    dataQualityStatus: 'BLOCK',
    confidenceScore: 88,
    confirmations: ['RSI oversold'],
    missingConfirmations: ['Clean data', 'Regime alignment']
  });

  assert.equal(explanation.status, 'BLOCK');
  assert.ok(explanation.issues.some(issue => issue.code === 'DATA_QUALITY_BLOCKED'));
  assert.ok(explanation.issues.some(issue => issue.code === 'RISK_REWARD_TOO_LOW'));
});

test('buildSignalExplanation sanitizes incomplete numeric inputs so the UI never renders NaN', () => {
  const explanation = buildSignalExplanation({
    technicalScore: Number.NaN,
    regimeAligned: false,
    volatilityState: 'NORMAL',
    riskReward: Number.NaN,
    dataQualityStatus: 'REVIEW',
    confidenceScore: Number.NaN,
    confirmations: [],
    missingConfirmations: ['Data required']
  });

  assert.equal(Number.isFinite(explanation.summaryScore), true);
  assert.equal(explanation.summaryScore, 26.7);
  assert.ok(explanation.buckets.every(bucket => Number.isFinite(bucket.score)));
});
