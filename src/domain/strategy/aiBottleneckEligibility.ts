export interface AiBottleneckEligibilityInput {
  marketCap: number | null;
  price: number | null;
  averageVolume: number | null;
  relativeVolume: number | null;
  catalystAgeDays: number | null;
  hasDemandEvidence: boolean;
  sma20Status: string;
  sma50Status: string;
  rsi: number | null;
  monthlyRunUpPercent: number | null;
  distanceFrom52WeekHighPercent: number | null;
  pattern: string;
}

export interface AiBottleneckEligibilityResult {
  eligible: boolean;
  failedCriteria: string[];
}

export function evaluateAiBottleneckDailyEligibility(input: AiBottleneckEligibilityInput): AiBottleneckEligibilityResult {
  const failedCriteria: string[] = [];
  requireRange(input.marketCap, 100_000_000, 20_000_000_000, 'MARKET_CAP_100M_TO_20B', failedCriteria);
  requireRange(input.price, 1, 100, 'PRICE_1_TO_100', failedCriteria);
  requireMinimum(input.averageVolume, 500_000, 'AVERAGE_VOLUME_OVER_500K', failedCriteria);
  requireRange(input.rsi, 50, 75, 'RSI_50_TO_75', failedCriteria);
  if (input.catalystAgeDays === null || input.catalystAgeDays < 0 || input.catalystAgeDays > 180) failedCriteria.push('CATALYST_WITHIN_180_DAYS');
  if (!input.hasDemandEvidence) failedCriteria.push('DEMAND_EVIDENCE_REQUIRED');
  if (input.sma20Status !== 'ABOVE') failedCriteria.push('PRICE_ABOVE_SMA20');
  if (input.sma50Status !== 'ABOVE') failedCriteria.push('PRICE_ABOVE_SMA50');
  if (!hasBasePattern(input.pattern)) failedCriteria.push('QUALIFYING_BASE_PATTERN');
  if (input.monthlyRunUpPercent !== null && input.monthlyRunUpPercent > 100 && !hasFreshBase(input.pattern)) {
    failedCriteria.push('MONTHLY_RUNUP_OVER_100_WITHOUT_NEW_BASE');
  }

  return { eligible: failedCriteria.length === 0, failedCriteria };
}

export function evaluateAiBottleneckSmallMidEligibility(input: AiBottleneckEligibilityInput): AiBottleneckEligibilityResult {
  const failedCriteria: string[] = [];
  requireRange(input.marketCap, 100_000_000, 5_000_000_000, 'MARKET_CAP_100M_TO_5B', failedCriteria);
  requireRange(input.price, 1, 50, 'PRICE_1_TO_50', failedCriteria);
  requireMinimum(input.averageVolume, 300_000, 'AVERAGE_VOLUME_OVER_300K', failedCriteria);
  requireMinimum(input.relativeVolume, 1.3, 'RELATIVE_VOLUME_OVER_1_3', failedCriteria);
  requireRange(input.rsi, 50, 75, 'RSI_50_TO_75', failedCriteria);
  requireRange(input.distanceFrom52WeekHighPercent, 0, 25, 'WITHIN_25_PERCENT_OF_52W_HIGH', failedCriteria);
  if (!hasBasePattern(input.pattern)) failedCriteria.push('QUALIFYING_BASE_PATTERN');

  return { eligible: failedCriteria.length === 0, failedCriteria };
}

function requireRange(value: number | null, min: number, max: number, code: string, failed: string[]) {
  if (value === null || !Number.isFinite(value) || value < min || value > max) failed.push(code);
}

function requireMinimum(value: number | null, minimum: number, code: string, failed: string[]) {
  if (value === null || !Number.isFinite(value) || value <= minimum) failed.push(code);
}

function hasBasePattern(pattern: string): boolean {
  return /vcp|bull flag|triangle|cup|handle|retest|base|volume dry-up/i.test(pattern);
}

function hasFreshBase(pattern: string): boolean {
  return /base|retest|vcp|dry-up|cup|handle|triangle|bull flag/i.test(pattern);
}
