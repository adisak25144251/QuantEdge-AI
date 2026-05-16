export type AiResearchMemoStatusV2 = 'PASS' | 'REVIEW' | 'BLOCK';

export interface AiResearchMemoInputV2 {
  symbol: string;
  assetType: string;
  evidenceStatus: AiResearchMemoStatusV2;
  riskStatus: AiResearchMemoStatusV2;
  benchmarkStatus: AiResearchMemoStatusV2;
  thesis: string;
  invalidation: string;
  bullCase: string;
  baseCase: string;
  bearCase: string;
}

export interface AiResearchMemoV2 {
  status: AiResearchMemoStatusV2;
  markdown: string;
  issues: { code: string; detail: string }[];
}

export function buildAiResearchMemoV2(input: AiResearchMemoInputV2): AiResearchMemoV2 {
  const issues: { code: string; detail: string }[] = [];
  if (!input.thesis.trim()) issues.push({ code: 'THESIS_MISSING', detail: 'Research thesis is missing.' });
  if (!input.invalidation.trim()) issues.push({ code: 'INVALIDATION_MISSING', detail: 'Invalidation condition is missing.' });
  if (!input.bullCase.trim()) issues.push({ code: 'BULL_CASE_MISSING', detail: 'Bull case is missing.' });
  if (!input.baseCase.trim()) issues.push({ code: 'BASE_CASE_MISSING', detail: 'Base case is missing.' });
  if (!input.bearCase.trim()) issues.push({ code: 'BEAR_CASE_MISSING', detail: 'Bear case is missing.' });
  if (input.evidenceStatus === 'BLOCK') issues.push({ code: 'EVIDENCE_BLOCK', detail: 'Evidence gate is blocked.' });
  if (input.riskStatus === 'BLOCK') issues.push({ code: 'RISK_BLOCK', detail: 'Risk gate is blocked.' });
  if (input.benchmarkStatus === 'BLOCK') issues.push({ code: 'BENCHMARK_BLOCK', detail: 'Benchmark gate is blocked.' });

  const markdown = [
    `# ${input.symbol} Institutional Research Memo`,
    '',
    `Asset Type: ${input.assetType}`,
    '',
    '## Thesis',
    input.thesis || 'Pending evidence.',
    '',
    '## Invalidation',
    input.invalidation || 'Pending invalidation level.',
    '',
    '## Bull Case',
    input.bullCase || 'Pending bull case.',
    '',
    '## Base Case',
    input.baseCase || 'Pending base case.',
    '',
    '## Bear Case',
    input.bearCase || 'Pending bear case.',
    '',
    '## Evidence Gates',
    `Evidence: ${input.evidenceStatus}`,
    `Risk: ${input.riskStatus}`,
    `Benchmark: ${input.benchmarkStatus}`
  ].join('\n');

  const blocking = issues.some((issue) => issue.code.endsWith('_MISSING') || issue.code.endsWith('_BLOCK'));
  const review = input.evidenceStatus === 'REVIEW' || input.riskStatus === 'REVIEW' || input.benchmarkStatus === 'REVIEW';

  return {
    status: blocking ? 'BLOCK' : review ? 'REVIEW' : 'PASS',
    markdown,
    issues
  };
}
