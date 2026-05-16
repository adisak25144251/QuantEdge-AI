export type AiGovernanceStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface AiGovernanceInput {
  responseText: string;
  evidenceReferences: string[];
  hasMarketContext: boolean;
}

export interface AiGovernanceIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface AiGovernanceReport {
  status: AiGovernanceStatus;
  evidenceReferenceCount: number;
  issues: AiGovernanceIssue[];
}

const imperativeTradePatterns = [
  /\bbuy now\b/i,
  /\bsell now\b/i,
  /\bfull size\b/i,
  /\bguaranteed profit\b/i,
  /\bcan'?t lose\b/i
];

export function evaluateAiResponseGovernance(input: AiGovernanceInput): AiGovernanceReport {
  const issues: AiGovernanceIssue[] = [];
  const text = input.responseText.trim();

  if (text.length < 40) {
    issues.push({
      code: 'RESPONSE_TOO_THIN',
      severity: 'WARNING',
      message: 'AI response should include enough context, evidence, and risk notes.'
    });
  }

  if (!input.hasMarketContext) {
    issues.push({
      code: 'NO_MARKET_CONTEXT',
      severity: 'ERROR',
      message: 'AI analysis requires current market context before it can be trusted.'
    });
  }

  if (input.evidenceReferences.length === 0) {
    issues.push({
      code: 'NO_EVIDENCE_REFERENCES',
      severity: 'ERROR',
      message: 'AI analysis must reference backtest, risk, data quality, or paper evidence.'
    });
  }

  if (!/not financial advice|analytical view|risk/i.test(text)) {
    issues.push({
      code: 'NO_ADVISORY_GUARDRAIL',
      severity: 'WARNING',
      message: 'AI response should frame output as analysis and include risk context.'
    });
  }

  if (imperativeTradePatterns.some(pattern => pattern.test(text))) {
    issues.push({
      code: 'IMPERATIVE_TRADE_ADVICE',
      severity: 'ERROR',
      message: 'AI response must not issue imperative trading instructions.'
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR')
      ? 'BLOCK'
      : issues.length > 0
        ? 'REVIEW'
        : 'PASS',
    evidenceReferenceCount: input.evidenceReferences.length,
    issues
  };
}
