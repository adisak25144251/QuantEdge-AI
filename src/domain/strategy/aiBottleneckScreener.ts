export type AiBottleneckCategory =
  | 'Power / Energy for Data Centers'
  | 'Neo Cloud / GPU Cloud / Compute Capacity'
  | 'AI Data Center Conversion'
  | 'Optical Interconnect / Photonics'
  | 'Memory / HBM / DRAM / NAND'
  | 'Storage / Data Lake Infrastructure'
  | 'Advanced Packaging / Testing'
  | 'Strategic Foundry / US Semiconductor Supply Chain'
  | 'Power Management / Cooling / Grid Infrastructure'
  | 'Edge AI / Robotics Infrastructure';

export type AiBottleneckGroup = 'Core Bottleneck' | 'Emerging Bottleneck' | 'Speculative Bottleneck' | 'Avoid / Too Extended';
export type AiBottleneckFinalView = 'Breakout Watch' | 'Buy Watch' | 'Wait Pullback' | 'Speculative Trade' | 'Avoid';
export type AiBottleneckRank =
  | 'High Conviction AI Bottleneck Watchlist'
  | 'Strong Candidate'
  | 'Watchlist Candidate'
  | 'Speculative / High Risk'
  | 'Avoid';

export interface AiBottleneckInput {
  ticker: string;
  companyName: string | null;
  category: AiBottleneckCategory;
  marketCap: number | null;
  price: number | null;
  averageVolume: number | null;
  relativeVolume: number | null;
  revenueGrowth: number | null;
  grossMarginTrend: 'EXPANDING' | 'STABLE' | 'COMPRESSING' | 'UNKNOWN';
  netIncomeTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNKNOWN';
  freeCashFlow: number | null;
  cashDebtProfile: 'NET_CASH' | 'MANAGEABLE' | 'LEVERED' | 'UNKNOWN';
  backlogOrContract: string | null;
  catalyst: string | null;
  catalystAgeDays: number | null;
  catalystVerified?: boolean;
  valuation: {
    ps: number | null;
    pe: number | null;
    evSales: number | null;
  };
  sma20Status: 'ABOVE' | 'BELOW' | 'UNKNOWN';
  sma50Status: 'ABOVE' | 'BELOW' | 'UNKNOWN';
  sma200Status: 'ABOVE' | 'BELOW' | 'UNKNOWN';
  rsi: number | null;
  relativeStrength: number | null;
  pattern: string;
  recentRunUpPercent: number | null;
  monthlyRunUpPercent?: number | null;
  dilutionRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  fundamentalsVerified?: boolean;
  demandEvidenceVerified?: boolean;
}

export interface AiBottleneckScore {
  ticker: string;
  companyName: string;
  category: AiBottleneckCategory;
  group: AiBottleneckGroup;
  rank: AiBottleneckRank;
  finalView: AiBottleneckFinalView;
  score: number;
  scoreBreakdown: {
    bottleneckRelevance: number;
    supplyConstraint: number;
    catalystQuality: number;
    financialQuality: number;
    technicalTiming: number;
    valuationSafety: number;
    liquidityTradability: number;
    riskControl: number;
  };
  entryZone: string;
  stopLossZone: string;
  targetZone: string;
  riskReward: number | null;
  issues: string[];
  monitoringChecklist: string[];
}

const coreCategories: AiBottleneckCategory[] = [
  'Power / Energy for Data Centers',
  'Neo Cloud / GPU Cloud / Compute Capacity',
  'Optical Interconnect / Photonics',
  'Memory / HBM / DRAM / NAND',
  'Advanced Packaging / Testing',
  'Power Management / Cooling / Grid Infrastructure'
];

export function scoreAiBottleneckCandidate(input: AiBottleneckInput): AiBottleneckScore {
  const issues: string[] = [];
  const extended = isExtended(input);

  if (!input.backlogOrContract || input.demandEvidenceVerified !== true) issues.push('VERIFIED_DEMAND_EVIDENCE_REQUIRED');
  if (!input.catalyst || input.catalystVerified !== true) issues.push('VERIFIED_CATALYST_REQUIRED');
  if (input.catalystAgeDays !== null && input.catalystAgeDays > 180) issues.push('CATALYST_OLDER_THAN_180_DAYS');
  if (input.averageVolume !== null && input.averageVolume < 500_000) issues.push('LOW_LIQUIDITY');
  if (input.dilutionRisk === 'HIGH') issues.push('DILUTION_RISK_HIGH');
  if (input.fundamentalsVerified === false) issues.push('FUNDAMENTALS_REQUIRE_LIVE_VERIFICATION');
  if (extended) issues.push('TOO_EXTENDED_WAIT_FOR_BASE');
  if (input.monthlyRunUpPercent !== null && input.monthlyRunUpPercent !== undefined && input.monthlyRunUpPercent > 100 && !hasFreshBase(input.pattern)) issues.push('MONTHLY_RUNUP_OVER_100_NO_BASE');
  if (input.rsi !== null && input.rsi > 80) issues.push('RSI_EXTENDED_WAIT_PULLBACK');

  const scoreBreakdown = {
    bottleneckRelevance: scoreBottleneckRelevance(input),
    supplyConstraint: scoreSupplyConstraint(input),
    catalystQuality: scoreBottleneckCatalyst(input),
    financialQuality: scoreBottleneckFinancials(input),
    technicalTiming: scoreBottleneckTechnical(input),
    valuationSafety: scoreBottleneckValuation(input),
    liquidityTradability: scoreBottleneckLiquidity(input),
    riskControl: scoreBottleneckRisk(input)
  };
  const rawScore = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const group = classifyBottleneckGroup(input, score, extended);
  const finalView = classifyBottleneckFinalView(group, score);
  const price = input.price ?? 0;

  return {
    ticker: input.ticker.toUpperCase(),
    companyName: input.companyName ?? 'Data required',
    category: input.category,
    group,
    rank: rankBottleneckScore(score),
    finalView,
    score,
    scoreBreakdown,
    entryZone: price > 0 ? `$${(price * 0.98).toFixed(2)}-$${(price * 1.04).toFixed(2)} after confirmed breakout/retest` : 'Data required',
    stopLossZone: price > 0 ? `$${(price * 0.9).toFixed(2)}-$${(price * 0.94).toFixed(2)} or below failed retest low` : 'Data required',
    targetZone: price > 0 ? `$${(price * 1.18).toFixed(2)}-$${(price * 1.35).toFixed(2)} if base holds and catalyst confirms` : 'Data required',
    riskReward: price > 0 ? 2.2 : null,
    issues,
    monitoringChecklist: [
      'Confirm demand is tied to a physical AI bottleneck, not AI branding alone.',
      'Track backlog, contract wins, capacity expansion, or customer concentration.',
      'Watch valuation re-rate versus revenue growth and margin durability.',
      'Avoid chasing if RSI is overheated or price is up sharply without a new base.',
      'Validate liquidity, dilution risk, cash runway, debt, and stop-loss discipline.'
    ]
  };
}

function scoreBottleneckRelevance(input: AiBottleneckInput): number {
  let score = coreCategories.includes(input.category) ? 18 : 14;
  if (/ai|gpu|data center|optical|photonics|hbm|power|cooling|packaging|testing|robotics/i.test(input.backlogOrContract ?? input.catalyst ?? '')) score += 2;
  return Math.min(20, score);
}

function scoreSupplyConstraint(input: AiBottleneckInput): number {
  let score = coreCategories.includes(input.category) ? 10 : 7;
  if (input.demandEvidenceVerified === true && input.backlogOrContract) score += 3;
  if (input.demandEvidenceVerified === true && /capacity|constraint|supply|backlog|contract|foundry|grid|power/i.test(input.backlogOrContract ?? '')) score += 2;
  return Math.min(15, score);
}

function scoreBottleneckCatalyst(input: AiBottleneckInput): number {
  if (!input.catalyst) return 3;
  if (input.catalystVerified !== true || input.catalystAgeDays === null) return 3;
  if (input.catalystAgeDays !== null && input.catalystAgeDays <= 30) return 15;
  if (input.catalystAgeDays !== null && input.catalystAgeDays <= 180) return 11;
  return 7;
}

function scoreBottleneckFinancials(input: AiBottleneckInput): number {
  if (input.fundamentalsVerified === false) return 3;
  let score = 5;
  if (input.revenueGrowth !== null && input.revenueGrowth > 20) score += 4;
  if (input.grossMarginTrend === 'EXPANDING') score += 2;
  if (input.netIncomeTrend === 'IMPROVING') score += 2;
  if (input.freeCashFlow !== null && input.freeCashFlow >= 0) score += 1;
  if (input.cashDebtProfile === 'NET_CASH' || input.cashDebtProfile === 'MANAGEABLE') score += 1;
  if (input.dilutionRisk === 'HIGH' || input.cashDebtProfile === 'LEVERED') score -= 4;
  return Math.max(0, Math.min(15, score));
}

function scoreBottleneckTechnical(input: AiBottleneckInput): number {
  let score = 0;
  if (input.sma20Status === 'ABOVE') score += 3;
  if (input.sma50Status === 'ABOVE') score += 3;
  if (input.sma200Status === 'ABOVE') score += 2;
  if (input.rsi !== null && input.rsi >= 50 && input.rsi <= 75) score += 3;
  if (input.relativeStrength !== null && input.relativeStrength > 0) score += 2;
  if (/vcp|bull flag|triangle|cup|retest|base|dry-up/i.test(input.pattern)) score += 2;
  if (isExtended(input)) score -= 6;
  return Math.max(0, Math.min(15, score));
}

function scoreBottleneckValuation(input: AiBottleneckInput): number {
  if (input.fundamentalsVerified === false) return 2;
  let score = 5;
  if (input.valuation.ps !== null && input.valuation.ps <= 8) score += 3;
  if (input.valuation.evSales !== null && input.valuation.evSales <= 8) score += 2;
  if ((input.valuation.ps !== null && input.valuation.ps > 20) || (input.valuation.evSales !== null && input.valuation.evSales > 20)) score -= 4;
  return Math.max(0, Math.min(10, score));
}

function scoreBottleneckLiquidity(input: AiBottleneckInput): number {
  if (input.averageVolume === null) return 2;
  if (input.averageVolume >= 1_000_000 && (input.relativeVolume ?? 0) >= 1.2) return 5;
  if (input.averageVolume >= 500_000) return 4;
  return 1;
}

function scoreBottleneckRisk(input: AiBottleneckInput): number {
  let score = 5;
  if (input.dilutionRisk === 'HIGH') score -= 3;
  if (isExtended(input)) score -= 2;
  if (input.cashDebtProfile === 'LEVERED') score -= 1;
  return Math.max(0, Math.min(5, score));
}

function classifyBottleneckGroup(input: AiBottleneckInput, score: number, extended: boolean): AiBottleneckGroup {
  if (extended || score < 50) return 'Avoid / Too Extended';
  if (input.dilutionRisk === 'HIGH' || input.cashDebtProfile === 'LEVERED') return 'Speculative Bottleneck';
  if (score >= 75 && coreCategories.includes(input.category)) return 'Core Bottleneck';
  if (score >= 65) return 'Emerging Bottleneck';
  return 'Speculative Bottleneck';
}

function classifyBottleneckFinalView(group: AiBottleneckGroup, score: number): AiBottleneckFinalView {
  if (group === 'Avoid / Too Extended') return score >= 50 ? 'Wait Pullback' : 'Avoid';
  if (group === 'Speculative Bottleneck') return 'Speculative Trade';
  if (group === 'Core Bottleneck') return 'Breakout Watch';
  return 'Buy Watch';
}

function rankBottleneckScore(score: number): AiBottleneckRank {
  if (score >= 85) return 'High Conviction AI Bottleneck Watchlist';
  if (score >= 75) return 'Strong Candidate';
  if (score >= 65) return 'Watchlist Candidate';
  if (score >= 50) return 'Speculative / High Risk';
  return 'Avoid';
}

function isExtended(input: AiBottleneckInput): boolean {
  return (input.rsi !== null && input.rsi > 80)
    || (input.recentRunUpPercent !== null && input.recentRunUpPercent > 50 && !hasFreshBase(input.pattern))
    || (input.monthlyRunUpPercent !== null && input.monthlyRunUpPercent !== undefined && input.monthlyRunUpPercent > 100 && !hasFreshBase(input.pattern));
}

function hasFreshBase(pattern: string): boolean {
  return /base|retest|vcp|dry-up|cup|handle|triangle|bull flag/i.test(pattern);
}
