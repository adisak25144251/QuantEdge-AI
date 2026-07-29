export type UsStockAnalystView = 'Buy Watch' | 'Wait Pullback' | 'Breakout Watch' | 'Avoid' | 'Speculative Trade';
export type UsStockAnalystBucket = 'หุ้นพื้นฐานดี' | 'หุ้น momentum trade' | 'หุ้น speculative';
export type UsStockAnalystRank =
  | 'High Conviction Watchlist'
  | 'Strong Breakout Candidate'
  | 'Watchlist Candidate'
  | 'Speculative / High Risk'
  | 'Avoid';
export type SmallCapAiGroup = 'Breakout Ready' | 'Wait for Pullback' | 'Speculative Only';

export interface UsStockAnalystCandidateInput {
  ticker: string;
  companyName: string | null;
  exchange: string | null;
  sector: string | null;
  theme: string;
  price: number | null;
  marketCap: number | null;
  averageVolume: number | null;
  relativeVolume: number | null;
  rsi: number | null;
  sma20Status: 'ABOVE' | 'BELOW' | 'UNKNOWN';
  sma50Status: 'ABOVE' | 'BELOW' | 'UNKNOWN';
  sma200Status: 'ABOVE' | 'BELOW' | 'UNKNOWN';
  distanceFrom52WeekHighPercent: number | null;
  catalyst: string | null;
  catalystAgeDays?: number | null;
  catalystVerified?: boolean;
  revenueGrowth: number | null;
  earningsTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNKNOWN';
  cashDebtDilutionRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  technicalPattern: string;
  recentRunUpPercent: number | null;
  sectorRotation: 'LEADING' | 'NEUTRAL' | 'LAGGING' | 'UNKNOWN';
}

export interface UsStockAnalystScore {
  ticker: string;
  score: number;
  rank: UsStockAnalystRank;
  finalView: UsStockAnalystView;
  bucket: UsStockAnalystBucket;
  riskReward: number | null;
  entryZone: string;
  stopLossZone: string;
  targetZone: string;
  scoreBreakdown: {
    themeStrength: number;
    catalystQuality: number;
    technicalSetup: number;
    volumeLiquidity: number;
    financialQuality: number;
    valuationSafety: number;
    riskManagement: number;
    marketTiming: number;
  };
  missingData: string[];
  warnings: string[];
}

export interface DailyUsStockScanResult {
  status: 'PASS' | 'REVIEW' | 'BLOCK';
  oneToFourWeekCandidate: boolean;
  failedCriteria: string[];
  matchedPatterns: string[];
}

export interface SmallCapAiWatchlistResult {
  status: 'PASS' | 'REVIEW' | 'BLOCK';
  group: SmallCapAiGroup;
  score: number;
  scoreBreakdown: {
    technicalSetup: number;
    catalyst: number;
    liquidity: number;
    themeStrength: number;
    financialSafety: number;
    riskReward: number;
  };
  failedCriteria: string[];
  warnings: string[];
  positionSizeSuggestion: string;
  finalView: UsStockAnalystView;
}

export interface SingleStockBreakoutSwingInput extends UsStockAnalystCandidateInput {
  supportLevel: number | null;
  resistanceLevel: number | null;
  latestVolume: number | null;
}

export interface SingleStockBreakoutSwingAnalysis {
  ticker: string;
  score: number;
  finalView: UsStockAnalystView;
  businessOverview: string;
  themeRelevance: string;
  latestCatalyst: string;
  revenueEarningsTrend: string;
  cashDebtDilutionRisk: string;
  technicalSetup: {
    sma20: string;
    sma50: string;
    sma200: string;
    rsi: string;
    volume: string;
    relativeVolume: string;
    support: string;
    resistance: string;
    pattern: string;
  };
  entryZone: string;
  stopLossZone: string;
  targetZone: string;
  riskReward: number | null;
  noChaseBase: string;
  enterConditions: string[];
  waitConditions: string[];
  avoidConditions: string[];
  missingData: string[];
  warnings: string[];
}

const highPriorityThemes = [
  'AI Back-End',
  'AI Bottleneck',
  'AI Robotics',
  'Semiconductor',
  'Optical Interconnect',
  'Memory',
  'Storage',
  'Power',
  'Defense AI',
  'Nuclear',
  'Energy Infrastructure',
  'Automation'
];

export function scoreUsStockScreenerAnalystCandidate(input: UsStockAnalystCandidateInput): UsStockAnalystScore {
  const missingData = collectMissingData(input);
  const warnings: string[] = [];

  if (input.relativeVolume !== null && input.relativeVolume < 1.5) warnings.push('Relative volume below breakout threshold.');
  if (input.averageVolume !== null && input.averageVolume < 500_000) warnings.push('Liquidity below 500k average shares/day.');
  if (input.catalystAgeDays !== undefined && input.catalystAgeDays !== null && input.catalystAgeDays > 30) warnings.push('Catalyst is older than 30 days.');
  if (input.rsi !== null && input.rsi > 85) warnings.push('ไม่ควรไล่ราคา ควรรอฐานใหม่');
  if (input.recentRunUpPercent !== null && input.recentRunUpPercent > 50) warnings.push('ไม่ควรไล่ราคา ควรรอฐานใหม่');
  if (input.cashDebtDilutionRisk === 'HIGH') warnings.push('Dilution/cash runway risk must be checked before escalation.');

  const scoreBreakdown = {
    themeStrength: scoreTheme(input.theme),
    catalystQuality: scoreCatalyst(input.catalyst, input.catalystAgeDays ?? null, input.catalystVerified === true),
    technicalSetup: scoreTechnical(input),
    volumeLiquidity: scoreVolume(input.averageVolume, input.relativeVolume),
    financialQuality: scoreFinancial(input),
    valuationSafety: scoreValuation(input),
    riskManagement: scoreRisk(input),
    marketTiming: scoreMarketTiming(input)
  };

  const rawScore = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
  const score = Math.round(clamp(rawScore, 0, 100));
  const rank = rankScore(score);
  const bucket = classifyBucket(input, scoreBreakdown.financialQuality, score);
  const finalView = classifyFinalView(input, score, warnings);
  const price = input.price ?? 0;
  const stopReference = input.sma50Status === 'ABOVE' ? 'SMA50 / prior base low' : 'last confirmed swing low';
  const riskReward = price > 0 && input.distanceFrom52WeekHighPercent !== null
    ? Number((Math.max(0.01, input.distanceFrom52WeekHighPercent / Math.max(100 - input.distanceFrom52WeekHighPercent, 1)) + 2).toFixed(2))
    : null;

  return {
    ticker: input.ticker.toUpperCase(),
    score,
    rank,
    finalView,
    bucket,
    riskReward,
    entryZone: price > 0 ? `$${(price * 0.98).toFixed(2)}-$${(price * 1.03).toFixed(2)} after confirmation/retest` : 'Data required',
    stopLossZone: price > 0 ? `$${(price * 0.9).toFixed(2)}-$${(price * 0.94).toFixed(2)} or below ${stopReference}` : 'Data required',
    targetZone: price > 0 ? `$${(price * 1.15).toFixed(2)}-$${(price * 1.3).toFixed(2)}; scale only after base holds` : 'Data required',
    scoreBreakdown,
    missingData,
    warnings
  };
}

export function evaluateDailyUsStockScan(input: UsStockAnalystCandidateInput): DailyUsStockScanResult {
  const failedCriteria: string[] = [];
  const matchedPatterns = detectDailyPatterns(input.technicalPattern);
  const recentRunUpAllowed = input.recentRunUpPercent === null || input.recentRunUpPercent <= 50 || /base|retest|vcp|dry-up/i.test(input.technicalPattern);

  if (input.price === null || input.price < 1 || input.price > 30) failedCriteria.push('PRICE_1_TO_30');
  if (input.marketCap === null || input.marketCap < 100_000_000 || input.marketCap > 10_000_000_000) failedCriteria.push('MARKET_CAP_100M_TO_10B');
  if (input.averageVolume === null || input.averageVolume <= 500_000) failedCriteria.push('AVERAGE_VOLUME_OVER_500K');
  if (input.relativeVolume === null || input.relativeVolume <= 1.5) failedCriteria.push('RELATIVE_VOLUME_OVER_1_5');
  if (input.rsi === null || input.rsi < 50 || input.rsi > 75) failedCriteria.push('RSI_50_TO_75');
  if (input.sma20Status !== 'ABOVE') failedCriteria.push('PRICE_ABOVE_SMA20');
  if (input.sma50Status !== 'ABOVE') failedCriteria.push('PRICE_ABOVE_SMA50');
  if (input.distanceFrom52WeekHighPercent === null || input.distanceFrom52WeekHighPercent > 20) failedCriteria.push('WITHIN_20_PERCENT_OF_52_WEEK_HIGH');
  if (!input.catalyst || input.catalystVerified !== true || input.catalystAgeDays === undefined || input.catalystAgeDays === null || input.catalystAgeDays > 30) {
    failedCriteria.push('VERIFIED_CATALYST_WITHIN_30_DAYS');
  }
  if (!recentRunUpAllowed) failedCriteria.push('EXTENDED_5_DAY_RUN_WITHOUT_NEW_BASE');
  if (matchedPatterns.length === 0) failedCriteria.push('NO_TARGET_TECHNICAL_PATTERN');

  const hardFails = failedCriteria.filter(criteria =>
    criteria === 'PRICE_1_TO_30' ||
    criteria === 'MARKET_CAP_100M_TO_10B' ||
    criteria === 'AVERAGE_VOLUME_OVER_500K' ||
    criteria === 'RSI_50_TO_75' ||
    criteria === 'EXTENDED_5_DAY_RUN_WITHOUT_NEW_BASE'
  );

  return {
    status: hardFails.length > 0 ? 'BLOCK' : failedCriteria.length > 0 ? 'REVIEW' : 'PASS',
    oneToFourWeekCandidate: hardFails.length === 0 && failedCriteria.length <= 2,
    failedCriteria,
    matchedPatterns
  };
}

export function evaluateSmallCapAiWatchlist(input: UsStockAnalystCandidateInput): SmallCapAiWatchlistResult {
  const failedCriteria: string[] = [];
  const warnings: string[] = [];
  const matchedPatterns = detectDailyPatterns(input.technicalPattern);
  const reclaimingSma50 = input.sma50Status === 'ABOVE' || /reclaim/i.test(input.technicalPattern);

  if (input.price === null || input.price < 1 || input.price > 15) failedCriteria.push('PRICE_1_TO_15');
  if (input.marketCap === null || input.marketCap < 100_000_000 || input.marketCap > 3_000_000_000) failedCriteria.push('MARKET_CAP_100M_TO_3B');
  if (input.averageVolume === null || input.averageVolume <= 500_000) failedCriteria.push('AVERAGE_VOLUME_OVER_500K');
  if (input.relativeVolume === null || input.relativeVolume <= 1.5) failedCriteria.push('RELATIVE_VOLUME_OVER_1_5');
  if (input.rsi === null || input.rsi < 50 || input.rsi > 75) failedCriteria.push('RSI_50_TO_75');
  if (input.sma20Status !== 'ABOVE') failedCriteria.push('PRICE_ABOVE_SMA20');
  if (!reclaimingSma50) failedCriteria.push('PRICE_ABOVE_OR_RECLAIMING_SMA50');
  if (matchedPatterns.length === 0) failedCriteria.push('NO_SMALL_CAP_BASE_PATTERN');

  if (input.rsi !== null && input.rsi > 85) warnings.push('Avoid: RSI above 85.');
  if (input.averageVolume !== null && input.averageVolume < 300_000) warnings.push('Avoid: average volume below 300K.');
  if (/offering|reverse split|going concern/i.test(input.catalyst ?? input.technicalPattern)) {
    warnings.push('High-risk speculative: offering, reverse split, or going-concern risk must be verified.');
  }
  if (input.cashDebtDilutionRisk === 'HIGH') warnings.push('High dilution/cash runway risk.');

  const scoreBreakdown = {
    technicalSetup: Math.round((scoreTechnical(input) / 20) * 30),
    catalyst: Math.round((scoreCatalyst(input.catalyst, input.catalystAgeDays ?? null, input.catalystVerified === true) / 15) * 20),
    liquidity: Math.round((scoreVolume(input.averageVolume, input.relativeVolume) / 10) * 15),
    themeStrength: scoreTheme(input.theme),
    financialSafety: Math.round((scoreFinancial(input) / 15) * 10),
    riskReward: scoreSmallCapRiskReward(input)
  };
  const score = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
  const hardBlock = failedCriteria.some(criteria =>
    criteria === 'PRICE_1_TO_15' ||
    criteria === 'MARKET_CAP_100M_TO_3B' ||
    criteria === 'AVERAGE_VOLUME_OVER_500K' ||
    criteria === 'RSI_50_TO_75'
  ) || warnings.some(warning => warning.startsWith('Avoid:'));
  const status = hardBlock ? 'BLOCK' : failedCriteria.length > 0 || warnings.length > 0 ? 'REVIEW' : 'PASS';
  const group: SmallCapAiGroup = status === 'PASS' && score >= 75
    ? 'Breakout Ready'
    : warnings.length > 0 || input.cashDebtDilutionRisk === 'HIGH'
      ? 'Speculative Only'
      : 'Wait for Pullback';

  return {
    status,
    group,
    score,
    scoreBreakdown,
    failedCriteria,
    warnings,
    positionSizeSuggestion: positionSizingForSmallCap(group, input.cashDebtDilutionRisk),
    finalView: group === 'Breakout Ready' ? 'Breakout Watch' : group === 'Wait for Pullback' ? 'Wait Pullback' : 'Speculative Trade'
  };
}

export function analyzeSingleStockBreakoutSwing(input: SingleStockBreakoutSwingInput): SingleStockBreakoutSwingAnalysis {
  const baseScore = scoreUsStockScreenerAnalystCandidate(input);
  const dailyScan = evaluateDailyUsStockScan(input);
  const price = input.price ?? 0;
  const support = input.supportLevel ?? (price > 0 ? price * 0.92 : null);
  const resistance = input.resistanceLevel ?? (price > 0 ? price * 1.08 : null);
  const extended = input.rsi !== null && input.rsi > 75 || input.recentRunUpPercent !== null && input.recentRunUpPercent > 35;
  const finalView: UsStockAnalystView = dailyScan.status === 'PASS' && !extended
    ? 'Breakout Watch'
    : extended && baseScore.score >= 50
      ? 'Wait Pullback'
      : baseScore.score < 50 || dailyScan.status === 'BLOCK'
      ? 'Avoid'
      : baseScore.finalView;

  const enterConditions = [
    'ราคาปิดเหนือแนวต้านหรือ pivot พร้อม volume ขยายตัว',
    'RSI อยู่ในโซน 50-75 และไม่เร่งจนเป็น chase setup',
    'ราคายืนเหนือ SMA20 และไม่หลุด SMA50/reclaim zone'
  ];
  const waitConditions = [
    'รอ pullback/retest หากราคาห่าง entry zone เกิน 3-5%',
    'รอฐานใหม่หากหุ้นเพิ่งวิ่งแรงหรือ RSI สูงกว่า 75',
    'รอข้อมูล catalyst/financial เพิ่ม หากข้อมูลยังไม่ครบ'
  ];
  const avoidConditions = [
    'หลีกเลี่ยงหากราคาหลุด stop หรือหลุด SMA20/SMA50 พร้อม volume ขายสูง',
    'หลีกเลี่ยงหากมี offering, reverse split, going-concern หรือ dilution risk โดยยังไม่เคลียร์',
    'หลีกเลี่ยงหาก relative volume ต่ำและ breakout ไม่มีแรงยืนยัน'
  ];

  return {
    ticker: input.ticker.toUpperCase(),
    score: baseScore.score,
    finalView,
    businessOverview: input.companyName
      ? `${input.companyName} (${input.ticker.toUpperCase()}) อยู่ในกลุ่ม ${input.sector ?? 'sector ยังไม่ระบุ'}; ข้อมูลธุรกิจเชิงลึกต้องยืนยันจาก filing/company report ล่าสุด`
      : 'ข้อมูลบริษัทไม่ครบ ต้องตรวจ company profile และ filing เพิ่มก่อนประเมินเชิงพื้นฐาน',
    themeRelevance: `Theme relevance: ${input.theme || 'ยังไม่จัดธีม'}; ให้คะแนนสูงขึ้นเมื่อเชื่อมโยงกับ AI Back-End, AI Bottleneck, AI Robotics, semiconductor, power/data center infrastructure`,
    latestCatalyst: input.catalyst
      ? `${input.catalyst}${input.catalystAgeDays !== undefined && input.catalystAgeDays !== null ? ` (${input.catalystAgeDays} วัน)` : ''}`
      : 'ไม่พบ catalyst ที่ยืนยันได้ในระบบ ต้องตรวจข่าว/filing ล่าสุดก่อนใช้งานจริง',
    revenueEarningsTrend: `Revenue growth: ${input.revenueGrowth ?? 'Data required'}; Earnings trend: ${input.earningsTrend}`,
    cashDebtDilutionRisk: `Cash/Debt/Dilution risk: ${input.cashDebtDilutionRisk}; หากเป็นหุ้นขาดทุนต้องตรวจ cash runway, debt maturity, ATM/offering และ going-concern language`,
    technicalSetup: {
      sma20: input.sma20Status,
      sma50: input.sma50Status,
      sma200: input.sma200Status,
      rsi: input.rsi === null ? 'Data required' : input.rsi.toFixed(1),
      volume: input.latestVolume === null ? 'Data required' : Math.round(input.latestVolume).toLocaleString(),
      relativeVolume: input.relativeVolume === null ? 'Data required' : input.relativeVolume.toFixed(2),
      support: support === null ? 'Data required' : `$${support.toFixed(2)}`,
      resistance: resistance === null ? 'Data required' : `$${resistance.toFixed(2)}`,
      pattern: `${input.technicalPattern}; detected ${dailyScan.matchedPatterns.join(', ') || 'pattern ต้องยืนยันเพิ่ม'}`
    },
    entryZone: baseScore.entryZone,
    stopLossZone: baseScore.stopLossZone,
    targetZone: baseScore.targetZone,
    riskReward: baseScore.riskReward,
    noChaseBase: extended
      ? `ราคามีโอกาสยืดแล้ว ควรรอฐานใหม่บริเวณ ${support === null ? 'แนวรับ/ฐานล่าสุด' : `$${support.toFixed(2)}`} หรือรอ breakout retest ที่ volume แห้ง`
      : 'ยังไม่ใช่ chase setup ชัดเจน แต่ควรรอ confirmation เหนือ pivot และไม่ไล่เมื่อหลุด entry zone มากเกินไป',
    enterConditions,
    waitConditions,
    avoidConditions,
    missingData: baseScore.missingData,
    warnings: [...baseScore.warnings, ...dailyScan.failedCriteria.map(criteria => `Gate: ${criteria}`)]
  };
}

function collectMissingData(input: UsStockAnalystCandidateInput): string[] {
  const missing: string[] = [];
  if (!input.companyName) missing.push('Company Name');
  if (!input.exchange) missing.push('Exchange');
  if (input.price === null) missing.push('Price');
  if (input.marketCap === null) missing.push('Market Cap');
  if (input.averageVolume === null) missing.push('Average Volume');
  if (input.relativeVolume === null) missing.push('Relative Volume');
  if (input.rsi === null) missing.push('RSI');
  if (input.distanceFrom52WeekHighPercent === null) missing.push('Distance from 52-week high');
  if (!input.catalyst || input.catalystVerified !== true) missing.push('Verified Catalyst');
  if (input.catalystAgeDays === undefined || input.catalystAgeDays === null || input.catalystVerified !== true) missing.push('Catalyst Recency');
  if (input.revenueGrowth === null) missing.push('Revenue Growth');
  if (input.earningsTrend === 'UNKNOWN') missing.push('Earnings Trend');
  if (input.cashDebtDilutionRisk === 'UNKNOWN') missing.push('Cash/Debt/Dilution Risk');
  return missing;
}

function scoreCatalyst(catalyst: string | null, catalystAgeDays: number | null, verified: boolean): number {
  if (!catalyst) return 3;
  if (!verified || catalystAgeDays === null) return 3;
  if (catalystAgeDays !== null && catalystAgeDays <= 30) return 15;
  if (catalystAgeDays !== null && catalystAgeDays <= 60) return 9;
  return 7;
}

function scoreTheme(theme: string): number {
  return highPriorityThemes.some(item => theme.toLowerCase().includes(item.toLowerCase())) ? 15 : 8;
}

function scoreTechnical(input: UsStockAnalystCandidateInput): number {
  let score = 0;
  if (input.sma20Status === 'ABOVE') score += 4;
  if (input.sma50Status === 'ABOVE') score += 4;
  if (input.sma200Status === 'ABOVE') score += 2;
  if (input.rsi !== null && input.rsi >= 50 && input.rsi <= 75) score += 4;
  if (input.distanceFrom52WeekHighPercent !== null && input.distanceFrom52WeekHighPercent <= 20) score += 4;
  if (detectDailyPatterns(input.technicalPattern).length > 0 || /relative strength/i.test(input.technicalPattern)) score += 2;
  if (input.rsi !== null && input.rsi > 85) score -= 8;
  if (input.recentRunUpPercent !== null && input.recentRunUpPercent > 50) score -= 8;
  return clamp(score, 0, 20);
}

function detectDailyPatterns(pattern: string): string[] {
  const checks: Array<[RegExp, string]> = [
    [/vcp/i, 'VCP'],
    [/triangle.*wave 2|wave 2/i, 'Triangle Wave 2'],
    [/triangle.*wave 4|wave 4/i, 'Triangle Wave 4'],
    [/bull flag|high tight flag|flag/i, 'Bull Flag'],
    [/cup.*handle/i, 'Cup with Handle'],
    [/breakout.*retest|retest/i, 'Breakout + Retest'],
    [/volume dry-up|dry-up/i, 'Volume Dry-Up'],
    [/base.*52|52-week high|base near/i, 'Base near 52-week high']
  ];
  return checks.flatMap(([regex, label]) => regex.test(pattern) ? [label] : []);
}

function scoreVolume(averageVolume: number | null, relativeVolume: number | null): number {
  let score = 0;
  if (averageVolume !== null && averageVolume >= 500_000) score += 5;
  if (relativeVolume !== null && relativeVolume >= 1.5) score += 5;
  return score;
}

function scoreFinancial(input: UsStockAnalystCandidateInput): number {
  let score = 5;
  if (input.revenueGrowth !== null && input.revenueGrowth > 20) score += 5;
  if (input.earningsTrend === 'IMPROVING') score += 3;
  if (input.cashDebtDilutionRisk === 'LOW') score += 2;
  if (input.cashDebtDilutionRisk === 'HIGH') score -= 6;
  return clamp(score, 0, 15);
}

function scoreValuation(input: UsStockAnalystCandidateInput): number {
  if (input.marketCap === null || input.price === null) return 4;
  if (input.price >= 1 && input.price <= 30 && input.marketCap >= 100_000_000 && input.marketCap <= 10_000_000_000) return 10;
  if (input.price > 30 || input.marketCap > 10_000_000_000) return 5;
  return 2;
}

function scoreRisk(input: UsStockAnalystCandidateInput): number {
  let score = 10;
  if (input.averageVolume !== null && input.averageVolume < 500_000) score -= 4;
  if (input.cashDebtDilutionRisk === 'HIGH') score -= 5;
  if (input.rsi !== null && input.rsi > 85) score -= 4;
  if (input.recentRunUpPercent !== null && input.recentRunUpPercent > 50) score -= 4;
  return clamp(score, 0, 10);
}

function scoreMarketTiming(input: UsStockAnalystCandidateInput): number {
  if (input.sectorRotation === 'LEADING') return 5;
  if (input.sectorRotation === 'NEUTRAL') return 3;
  return 1;
}

function scoreSmallCapRiskReward(input: UsStockAnalystCandidateInput): number {
  let score = 4;
  if (input.price !== null && input.price >= 1 && input.price <= 15) score += 2;
  if (input.distanceFrom52WeekHighPercent !== null && input.distanceFrom52WeekHighPercent <= 20) score += 2;
  if (input.rsi !== null && input.rsi >= 50 && input.rsi <= 72) score += 2;
  if (input.rsi !== null && input.rsi > 80) score -= 4;
  if (input.recentRunUpPercent !== null && input.recentRunUpPercent > 50) score -= 3;
  return clamp(score, 0, 10);
}

function positionSizingForSmallCap(group: SmallCapAiGroup, dilutionRisk: UsStockAnalystCandidateInput['cashDebtDilutionRisk']): string {
  if (group === 'Breakout Ready' && dilutionRisk !== 'HIGH') return 'Small pilot size only; risk 0.25%-0.50% of account until breakout confirms.';
  if (group === 'Wait for Pullback') return 'Watch only or starter alert; wait for retest/base before sizing.';
  return 'Speculative only; keep position tiny or paper trade until dilution/cash risk is cleared.';
}

function classifyBucket(input: UsStockAnalystCandidateInput, financialQuality: number, score: number): UsStockAnalystBucket {
  if (input.cashDebtDilutionRisk === 'HIGH' || financialQuality < 7) return 'หุ้น speculative';
  if (score >= 70 && input.relativeVolume !== null && input.relativeVolume >= 1.5) return 'หุ้น momentum trade';
  return 'หุ้นพื้นฐานดี';
}

function classifyFinalView(input: UsStockAnalystCandidateInput, score: number, warnings: string[]): UsStockAnalystView {
  if (score < 50) return 'Avoid';
  if (input.cashDebtDilutionRisk === 'HIGH') return 'Speculative Trade';
  if (warnings.some(warning => warning.includes('ไม่ควรไล่ราคา'))) return 'Wait Pullback';
  if (score >= 75 && input.relativeVolume !== null && input.relativeVolume >= 1.5) return 'Breakout Watch';
  if (score >= 65) return 'Buy Watch';
  return 'Speculative Trade';
}

function rankScore(score: number): UsStockAnalystRank {
  if (score >= 85) return 'High Conviction Watchlist';
  if (score >= 75) return 'Strong Breakout Candidate';
  if (score >= 65) return 'Watchlist Candidate';
  if (score >= 50) return 'Speculative / High Risk';
  return 'Avoid';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
