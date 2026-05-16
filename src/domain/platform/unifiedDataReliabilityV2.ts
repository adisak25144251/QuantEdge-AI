export type UnifiedDataStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type UnifiedAssetType = 'CRYPTO' | 'US_STOCK' | 'ETF' | 'FOREX' | 'COMMODITY';

export interface UnifiedDataSourceV2 {
  name: string;
  assetType: UnifiedAssetType;
  status: UnifiedDataStatus;
  freshnessMs: number;
  checksumPresent: boolean;
  confidence: number;
}

export interface UnifiedDataReliabilityInputV2 {
  sources: UnifiedDataSourceV2[];
  maxFreshnessMs?: number;
  minConfidence?: number;
}

export interface UnifiedDataReliabilityReportV2 {
  status: UnifiedDataStatus;
  sourceConfidenceScore: number;
  assetTypesCovered: number;
  issues: { code: string; detail: string }[];
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function evaluateUnifiedDataReliabilityV2(input: UnifiedDataReliabilityInputV2): UnifiedDataReliabilityReportV2 {
  const maxFreshnessMs = input.maxFreshnessMs ?? 300_000;
  const minConfidence = input.minConfidence ?? 75;
  const issues: { code: string; detail: string }[] = [];

  if (input.sources.length === 0) {
    return {
      status: 'BLOCK',
      sourceConfidenceScore: 0,
      assetTypesCovered: 0,
      issues: [{ code: 'NO_DATA_SOURCES', detail: 'No market data source was supplied.' }]
    };
  }

  for (const source of input.sources) {
    if (source.status === 'BLOCK') issues.push({ code: 'SOURCE_BLOCK', detail: `${source.name} is blocking analysis.` });
    if (source.status === 'REVIEW') issues.push({ code: 'SOURCE_REVIEW', detail: `${source.name} needs review.` });
    if (!Number.isFinite(source.freshnessMs) || source.freshnessMs > maxFreshnessMs) {
      issues.push({ code: 'SOURCE_STALE', detail: `${source.name} is older than the freshness policy.` });
    }
    if (!source.checksumPresent) issues.push({ code: 'CHECKSUM_MISSING', detail: `${source.name} has no integrity checksum.` });
    if (source.confidence < minConfidence) issues.push({ code: 'CONFIDENCE_LOW', detail: `${source.name} confidence is below policy.` });
  }

  const sourceConfidenceScore = round(
    input.sources.reduce((sum, source) => sum + source.confidence, 0) / input.sources.length,
    0
  );
  const assetTypesCovered = new Set(input.sources.map((source) => source.assetType)).size;

  const blockingIssue = issues.some((issue) =>
    issue.code === 'SOURCE_BLOCK' ||
    issue.code === 'SOURCE_STALE' ||
    issue.code === 'CHECKSUM_MISSING' ||
    issue.code === 'CONFIDENCE_LOW'
  );

  return {
    status: blockingIssue ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    sourceConfidenceScore,
    assetTypesCovered,
    issues
  };
}
