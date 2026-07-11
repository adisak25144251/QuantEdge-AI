export type EvidenceVote = 'AGREE' | 'NEUTRAL' | 'DISAGREE';
export type AnalysisDataStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface TechnicalConfluenceInput {
  trend: EvidenceVote;
  momentum: EvidenceVote;
  volume: EvidenceVote;
  structure: EvidenceVote;
  patternConfidence: number | null;
  rewardRisk: number;
  regime: 'TRENDING' | 'NEUTRAL' | 'CHOPPY';
  divergenceAligned: boolean;
  dataStatus: AnalysisDataStatus;
}

export interface TechnicalConfluenceResult {
  score: number;
  grade: 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT';
  breakdown: {
    trend: number;
    momentum: number;
    volume: number;
    structure: number;
    pattern: number;
    rewardRisk: number;
    regime: number;
    divergence: number;
    dataPenalty: number;
  };
  confirmations: number;
  disagreements: number;
}

export function calculateTechnicalConfluence(input: TechnicalConfluenceInput): TechnicalConfluenceResult {
  const breakdown = {
    trend: voteScore(input.trend, 25, 12),
    momentum: voteScore(input.momentum, 20, 8),
    volume: voteScore(input.volume, 10, 4),
    structure: voteScore(input.structure, 10, 4),
    pattern: input.patternConfidence === null
      ? 0
      : round(clamp(input.patternConfidence, 0, 100) / 10),
    rewardRisk: rewardRiskScore(input.rewardRisk),
    regime: input.regime === 'TRENDING' ? 5 : input.regime === 'NEUTRAL' ? 3 : 0,
    divergence: input.divergenceAligned ? 5 : 0,
    dataPenalty: input.dataStatus === 'BLOCK' ? -100 : input.dataStatus === 'REVIEW' ? -8 : 0
  };

  const rawScore = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const score = Math.round(clamp(rawScore, 0, 100));
  const votes = [input.trend, input.momentum, input.volume, input.structure];

  return {
    score,
    grade: score >= 80 ? 'HIGH' : score >= 65 ? 'MODERATE' : score >= 50 ? 'LOW' : 'INSUFFICIENT',
    breakdown,
    confirmations: votes.filter(vote => vote === 'AGREE').length + (input.patternConfidence !== null && input.patternConfidence >= 70 ? 1 : 0),
    disagreements: votes.filter(vote => vote === 'DISAGREE').length
  };
}

function voteScore(vote: EvidenceVote, agree: number, neutral: number): number {
  if (vote === 'AGREE') return agree;
  if (vote === 'NEUTRAL') return neutral;
  return 0;
}

function rewardRiskScore(rewardRisk: number): number {
  if (!Number.isFinite(rewardRisk) || rewardRisk <= 0) return 0;
  if (rewardRisk >= 3) return 15;
  if (rewardRisk >= 2) return 13;
  if (rewardRisk >= 1.6) return 10;
  if (rewardRisk >= 1.2) return 5;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
