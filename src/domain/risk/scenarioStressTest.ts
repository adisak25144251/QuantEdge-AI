export type ScenarioStressStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface StressScenario {
  name: string;
  gapPercent: number;
  slippagePercent: number;
  volatilityMultiplier: number;
}

export interface ScenarioStressInput {
  side: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  accountEquity: number;
  sizeUnits: number;
  scenarios: StressScenario[];
  maxLossPercent: number;
}

export interface ScenarioStressIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ScenarioStressResult {
  status: ScenarioStressStatus;
  worstCaseLossUsd: number;
  worstCaseLossPercent: number;
  scenarioResults: { name: string; stressedExit: number; pnlUsd: number; lossPercent: number }[];
  issues: ScenarioStressIssue[];
}

export function runScenarioStressTest(input: ScenarioStressInput): ScenarioStressResult {
  const scenarioResults = input.scenarios.map(scenario => {
    const stressedExit = stressedStop(input, scenario);
    const pnlUsd = input.side === 'LONG'
      ? (stressedExit - input.entry) * input.sizeUnits
      : (input.entry - stressedExit) * input.sizeUnits;
    return {
      name: scenario.name,
      stressedExit: round(stressedExit, 4),
      pnlUsd: round(pnlUsd, 2),
      lossPercent: round(Math.max(0, -pnlUsd) / input.accountEquity * 100, 2)
    };
  });
  const worst = scenarioResults.reduce((max, result) => result.lossPercent > max.lossPercent ? result : max, scenarioResults[0] ?? {
    name: 'none',
    stressedExit: input.stopLoss,
    pnlUsd: 0,
    lossPercent: 0
  });
  const issues: ScenarioStressIssue[] = [];

  if (worst.lossPercent > input.maxLossPercent) {
    issues.push({
      code: 'STRESS_LOSS_EXCEEDED',
      severity: 'ERROR',
      message: `Worst-case stress loss exceeds ${input.maxLossPercent}% of equity.`
    });
  }

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    worstCaseLossUsd: round(Math.max(0, -worst.pnlUsd), 2),
    worstCaseLossPercent: worst.lossPercent,
    scenarioResults,
    issues
  };
}

function stressedStop(input: ScenarioStressInput, scenario: StressScenario): number {
  const direction = input.side === 'LONG' ? -1 : 1;
  const gapMove = input.entry * (scenario.gapPercent / 100);
  const slippageMove = input.entry * (scenario.slippagePercent / 100) * direction;
  const volatilityMove = Math.abs(input.entry - input.stopLoss) * Math.max(0, scenario.volatilityMultiplier - 1) * direction;
  return input.stopLoss + gapMove + slippageMove + volatilityMove;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
