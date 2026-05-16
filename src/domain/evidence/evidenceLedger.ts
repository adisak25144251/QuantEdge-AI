export type EvidenceArea = 'DATA_QUALITY' | 'STRATEGY' | 'RISK' | 'AI_GOVERNANCE' | 'PORTFOLIO';
export type EvidenceStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface EvidenceRecordInput {
  area: EvidenceArea;
  status: EvidenceStatus;
  referenceId: string;
  summary: string;
  timestamp?: string;
  issueCodes?: string[];
}

export interface EvidenceRecord extends Required<EvidenceRecordInput> {
  id: string;
}

export interface EvidenceLedger {
  status: EvidenceStatus;
  canRecordPlan: boolean;
  records: EvidenceRecord[];
  missingAreas: EvidenceArea[];
  blockingCodes: string[];
  generatedAt: string;
}

const REQUIRED_AREAS: EvidenceArea[] = ['DATA_QUALITY', 'STRATEGY', 'RISK', 'AI_GOVERNANCE', 'PORTFOLIO'];

export function createEvidenceRecord(input: EvidenceRecordInput): EvidenceRecord {
  const timestamp = input.timestamp ?? new Date().toISOString();
  return {
    ...input,
    timestamp,
    issueCodes: input.issueCodes ?? [],
    id: `evidence-${input.area}-${sanitize(input.referenceId)}-${Date.parse(timestamp) || sanitize(input.timestamp ?? timestamp)}`
  };
}

export function buildEvidenceLedger(records: EvidenceRecord[]): EvidenceLedger {
  const latestByArea = new Map<EvidenceArea, EvidenceRecord>();
  for (const record of records) {
    const current = latestByArea.get(record.area);
    if (!current || record.timestamp >= current.timestamp) {
      latestByArea.set(record.area, record);
    }
  }

  const missingAreas = REQUIRED_AREAS.filter(area => !latestByArea.has(area));
  const latestRecords = Array.from(latestByArea.values());
  const blockingCodes = [
    ...missingAreas.map(area => `${area}_MISSING`),
    ...latestRecords
      .filter(record => record.status === 'BLOCK')
      .flatMap(record => record.issueCodes.length > 0 ? record.issueCodes : [`${record.area}_BLOCKED`])
  ];

  const hasReview = latestRecords.some(record => record.status === 'REVIEW');
  const status = blockingCodes.length > 0
    ? 'BLOCK'
    : hasReview
      ? 'REVIEW'
      : 'PASS';

  return {
    status,
    canRecordPlan: status === 'PASS',
    records: latestRecords.sort((a, b) => a.area.localeCompare(b.area)),
    missingAreas,
    blockingCodes,
    generatedAt: new Date().toISOString()
  };
}

function sanitize(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}
