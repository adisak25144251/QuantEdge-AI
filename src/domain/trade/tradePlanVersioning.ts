export type TradePlanChangeType = 'INITIAL' | 'REVISION';

export interface TradePlanVersionInput {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  rationale: string;
  changedAt: string;
}

export interface TradePlanVersion {
  id: string;
  version: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  rationale: string;
  changedAt: string;
  changeType: TradePlanChangeType;
  changedFields: string[];
}

export function createInitialPlanVersion(input: TradePlanVersionInput): TradePlanVersion {
  return toVersion(input, 1, 'INITIAL', ['symbol', 'side', 'entry', 'stopLoss', 'takeProfit', 'rationale']);
}

export function createNextPlanVersion(previous: TradePlanVersion, input: Partial<Omit<TradePlanVersionInput, 'symbol' | 'side'>> & { changedAt: string }): TradePlanVersion {
  const nextInput: TradePlanVersionInput = {
    symbol: previous.symbol,
    side: previous.side,
    entry: input.entry ?? previous.entry,
    stopLoss: input.stopLoss ?? previous.stopLoss,
    takeProfit: input.takeProfit ?? previous.takeProfit,
    rationale: input.rationale ?? previous.rationale,
    changedAt: input.changedAt
  };
  const changedFields = (['entry', 'stopLoss', 'takeProfit', 'rationale'] as const)
    .filter(field => nextInput[field] !== previous[field]);

  return toVersion(nextInput, previous.version + 1, 'REVISION', changedFields);
}

function toVersion(input: TradePlanVersionInput, version: number, changeType: TradePlanChangeType, changedFields: string[]): TradePlanVersion {
  return {
    ...input,
    version,
    changeType,
    changedFields,
    id: `plan-${input.symbol.toUpperCase()}-${input.side}-${version}-${hash([
      input.entry,
      input.stopLoss,
      input.takeProfit,
      input.rationale,
      input.changedAt
    ].join('|'))}`
  };
}

function hash(value: string): string {
  let hashValue = 0;
  for (let index = 0; index < value.length; index += 1) {
    hashValue = ((hashValue << 5) - hashValue + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hashValue).toString(36);
}
