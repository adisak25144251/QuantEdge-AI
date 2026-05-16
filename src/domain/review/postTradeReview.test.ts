import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPostTradeReview } from './postTradeReview';

test('buildPostTradeReview grades plan adherence and execution quality from evidence', () => {
  const review = buildPostTradeReview({
    plannedEntry: 100,
    plannedStopLoss: 95,
    plannedTakeProfit: 110,
    actualEntry: 100.2,
    actualExit: 110,
    side: 'LONG',
    pnlUsd: 200,
    riskUsd: 100,
    followedPlan: true,
    exitReason: 'TP'
  });

  assert.equal(review.status, 'PASS');
  assert.equal(review.rMultiple, 2);
  assert.ok(review.lessons.some(lesson => lesson.includes('Plan followed')));
});

test('buildPostTradeReview flags rule breaks and poor exits', () => {
  const review = buildPostTradeReview({
    plannedEntry: 100,
    plannedStopLoss: 95,
    plannedTakeProfit: 110,
    actualEntry: 103,
    actualExit: 96,
    side: 'LONG',
    pnlUsd: -140,
    riskUsd: 100,
    followedPlan: false,
    exitReason: 'MANUAL'
  });

  assert.equal(review.status, 'REVIEW');
  assert.ok(review.issues.some(issue => issue.code === 'PLAN_NOT_FOLLOWED'));
  assert.ok(review.issues.some(issue => issue.code === 'ENTRY_SLIPPAGE_HIGH'));
});
