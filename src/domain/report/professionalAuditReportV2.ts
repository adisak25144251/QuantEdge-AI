export type ProfessionalAuditReportStatusV2 = 'PASS' | 'REVIEW' | 'BLOCK';

export interface ProfessionalAuditReportInputV2 {
  title: string;
  symbol: string;
  generatedAt: string;
  statuses: {
    setup: ProfessionalAuditReportStatusV2;
    risk: ProfessionalAuditReportStatusV2;
    benchmark: ProfessionalAuditReportStatusV2;
    data: ProfessionalAuditReportStatusV2;
    decisionTrail: ProfessionalAuditReportStatusV2;
  };
}

export interface ProfessionalAuditReportV2 {
  status: ProfessionalAuditReportStatusV2;
  markdown: string;
  issues: string[];
}

export function buildProfessionalAuditReportV2(input: ProfessionalAuditReportInputV2): ProfessionalAuditReportV2 {
  const entries = Object.entries(input.statuses);
  const issues = entries
    .filter(([, status]) => status !== 'PASS')
    .map(([key, status]) => `${key.toUpperCase()}_${status}`);
  const status: ProfessionalAuditReportStatusV2 = entries.some(([, value]) => value === 'BLOCK')
    ? 'BLOCK'
    : entries.some(([, value]) => value === 'REVIEW')
      ? 'REVIEW'
      : 'PASS';

  const markdown = [
    `# ${input.title}`,
    '',
    `Symbol: ${input.symbol}`,
    `Generated At: ${input.generatedAt}`,
    '',
    '## Gate Summary',
    `Setup: ${input.statuses.setup}`,
    `Risk: ${input.statuses.risk}`,
    `Benchmark: ${input.statuses.benchmark}`,
    `Data: ${input.statuses.data}`,
    '',
    '## Decision Trail',
    `Decision Trail: ${input.statuses.decisionTrail}`,
    issues.length > 0 ? `Issues: ${issues.join(', ')}` : 'Issues: None'
  ].join('\n');

  return { status, markdown, issues };
}
