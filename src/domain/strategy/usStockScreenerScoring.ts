export type UsStockScreenerStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface UsStockScreenerInput {
  symbol: string;
  priceChangePercent: number;
  relativeStrengthPercent: number;
  relativeVolume: number;
  gapPercent: number;
  daysToEarnings: number | null;
}

export interface UsStockScreenerIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface UsStockScreenerScore {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  score: number;
  confidence: number;
  status: UsStockScreenerStatus;
  tags: string[];
  issues: UsStockScreenerIssue[];
}

export function scoreUsStockScreenerSetup(input: UsStockScreenerInput): UsStockScreenerScore {
  const issues: UsStockScreenerIssue[] = [];
  const tags: string[] = [];

  if (input.daysToEarnings !== null && input.daysToEarnings <= 3) {
    issues.push({ code: 'EARNINGS_LOCKOUT', severity: 'ERROR', message: 'Candidate is inside earnings lockout.' });
  }
  if (input.relativeVolume < 1) {
    issues.push({ code: 'LOW_RELATIVE_VOLUME', severity: 'WARNING', message: 'Relative volume is below confirmation threshold.' });
  }
  if (input.relativeStrengthPercent < 0) {
    issues.push({ code: 'WEAK_RELATIVE_STRENGTH', severity: 'WARNING', message: 'Candidate underperforms benchmark.' });
  }
  if (Math.abs(input.gapPercent) > 4) {
    issues.push({ code: 'EXTENDED_GAP_RISK', severity: 'WARNING', message: 'Gap is extended and may mean-revert.' });
  }

  if (input.relativeStrengthPercent >= 3) tags.push('SECTOR_LEADER');
  if (input.relativeVolume >= 1.5) tags.push('HIGH_RELATIVE_VOLUME');
  if (Math.abs(input.gapPercent) >= 1) tags.push('GAP_WATCH');

  const direction = input.priceChangePercent >= 0 && input.relativeStrengthPercent >= 0 ? 'LONG' : 'SHORT';
  const rawScore = 55
    + clamp(Math.abs(input.priceChangePercent) * 3, 0, 15)
    + clamp(input.relativeStrengthPercent * 4, -15, 25)
    + clamp((input.relativeVolume - 1) * 12, -10, 20)
    - clamp(Math.max(0, Math.abs(input.gapPercent) - 3) * 4, 0, 18);
  const score = Math.round(clamp(rawScore, 0, 100));

  return {
    symbol: input.symbol.toUpperCase(),
    direction,
    score,
    confidence: score,
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    tags,
    issues
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
