export type ProfessionalReportStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface ProfessionalReportSection {
  title: string;
  status: ProfessionalReportStatus;
  lines: string[];
}

export interface ProfessionalReportInput {
  title: string;
  symbol: string;
  generatedAt: string;
  sections: ProfessionalReportSection[];
}

export interface ProfessionalReportIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ProfessionalTradeReport {
  status: ProfessionalReportStatus;
  markdown: string;
  issues: ProfessionalReportIssue[];
}

export function buildProfessionalTradeReport(input: ProfessionalReportInput): ProfessionalTradeReport {
  const issues: ProfessionalReportIssue[] = [];

  if (input.sections.length === 0) {
    issues.push({ code: 'REPORT_SECTIONS_MISSING', severity: 'ERROR', message: 'Professional report requires at least one section.' });
  }

  const sectionBlocks = input.sections.map(section => [
    `## ${section.title}`,
    `Status: ${section.status}`,
    ...section.lines.map(line => `- ${line}`)
  ].join('\n'));

  const markdown = [
    `# ${input.title}`,
    '',
    `Symbol: ${input.symbol.toUpperCase()}`,
    `Generated: ${input.generatedAt}`,
    '',
    ...sectionBlocks
  ].join('\n');

  const sectionStatus = input.sections.some(section => section.status === 'BLOCK')
    ? 'BLOCK'
    : input.sections.some(section => section.status === 'REVIEW')
      ? 'REVIEW'
      : 'PASS';

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : sectionStatus,
    markdown,
    issues
  };
}
