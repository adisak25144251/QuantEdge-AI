import {
  extractLatestSecFact,
  missingSecFact,
  type ProvenanceRecord,
  type SecCompanyFactsPayload
} from './provenance';

type Trend = 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNKNOWN';
type MarginTrend = 'EXPANDING' | 'STABLE' | 'COMPRESSING' | 'UNKNOWN';
type CashDebtProfile = 'NET_CASH' | 'MANAGEABLE' | 'LEVERED' | 'UNKNOWN';

interface SecFactPoint {
  value: number;
  start: string | null;
  end: string;
  filed: string;
  form: string;
  accessionNumber: string | null;
}

export interface SecFundamentalSnapshot {
  status: 'VERIFIED' | 'PARTIAL' | 'DATA_REQUIRED';
  revenue: ProvenanceRecord<number>;
  revenueGrowthPercent: ProvenanceRecord<number>;
  netIncome: ProvenanceRecord<number>;
  cash: ProvenanceRecord<number>;
  debt: ProvenanceRecord<number>;
  sharesOutstanding: ProvenanceRecord<number>;
  weightedAverageShares: ProvenanceRecord<number>;
  grossMarginPercent: ProvenanceRecord<number>;
  freeCashFlow: ProvenanceRecord<number>;
  earningsTrend: Trend;
  grossMarginTrend: MarginTrend;
  cashDebtProfile: CashDebtProfile;
}

const REVENUE_CONCEPTS = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'Revenues',
  'SalesRevenueNet',
  'Revenue'
];
const NET_INCOME_CONCEPTS = ['NetIncomeLoss', 'ProfitLoss'];
const GROSS_PROFIT_CONCEPTS = ['GrossProfit'];
const OPERATING_CASH_FLOW_CONCEPTS = ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'];
const CAPEX_CONCEPTS = ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsForAdditionsToPropertyPlantAndEquipment'];
const CASH_CONCEPTS = ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'];
const DEBT_CONCEPTS = ['LongTermDebtAndFinanceLeaseObligations', 'LongTermDebtAndCapitalLeaseObligations', 'LongTermDebt'];
const SHARES_CONCEPTS = ['CommonStockSharesOutstanding', 'EntityCommonStockSharesOutstanding'];
const WEIGHTED_AVERAGE_SHARES_CONCEPTS = [
  'WeightedAverageNumberOfSharesOutstandingBasic',
  'WeightedAverageNumberOfShareOutstandingBasicAndDiluted',
  'WeightedAverageNumberOfDilutedSharesOutstanding'
];
const ANNUAL_FORMS = new Set(['10-K', '20-F', '40-F']);

export function buildSecFundamentalSnapshot(payload: SecCompanyFactsPayload): SecFundamentalSnapshot {
  const revenueSeries = annualSeries(payload, REVENUE_CONCEPTS);
  const netIncomeSeries = annualSeries(payload, NET_INCOME_CONCEPTS);
  const latestRevenue = revenueSeries[0];
  const previousRevenue = revenueSeries[1];
  const latestNetIncome = netIncomeSeries[0];
  const previousNetIncome = netIncomeSeries[1];
  const grossProfit = matchingAnnualFact(payload, GROSS_PROFIT_CONCEPTS, latestRevenue);
  const operatingCashFlow = matchingAnnualFact(payload, OPERATING_CASH_FLOW_CONCEPTS, latestRevenue);
  const capex = matchingAnnualFact(payload, CAPEX_CONCEPTS, latestRevenue);

  const revenue = latestRevenue ? toRecord(payload, latestRevenue) : extractLatestSecFact(payload, REVENUE_CONCEPTS);
  const netIncome = latestNetIncome ? toRecord(payload, latestNetIncome) : extractLatestSecFact(payload, NET_INCOME_CONCEPTS);
  const cash = extractLatestSecFact(payload, CASH_CONCEPTS);
  const debt = extractLatestSecFact(payload, DEBT_CONCEPTS);
  const sharesOutstanding = extractLatestSecFact(payload, SHARES_CONCEPTS, ['shares']);
  const weightedAverageShares = extractLatestSecFact(payload, WEIGHTED_AVERAGE_SHARES_CONCEPTS, ['shares']);
  const revenueGrowthPercent = ratioRecord(
    payload,
    latestRevenue && previousRevenue && previousRevenue.value !== 0
      ? ((latestRevenue.value - previousRevenue.value) / Math.abs(previousRevenue.value)) * 100
      : null,
    latestRevenue
  );
  const grossMarginPercent = ratioRecord(
    payload,
    latestRevenue && grossProfit && latestRevenue.value !== 0
      ? (grossProfit.value / latestRevenue.value) * 100
      : null,
    grossProfit ?? latestRevenue
  );
  const freeCashFlow = ratioRecord(
    payload,
    operatingCashFlow && capex ? operatingCashFlow.value - Math.abs(capex.value) : null,
    operatingCashFlow ?? capex
  );

  const verifiedCount = [
    revenue,
    netIncome,
    cash,
    sharesOutstanding,
    weightedAverageShares,
    revenueGrowthPercent
  ].filter(record => record.status === 'VERIFIED' && record.value !== null).length;

  return {
    status: verifiedCount >= 4 ? 'VERIFIED' : verifiedCount >= 2 ? 'PARTIAL' : 'DATA_REQUIRED',
    revenue,
    revenueGrowthPercent,
    netIncome,
    cash,
    debt,
    sharesOutstanding,
    weightedAverageShares,
    grossMarginPercent,
    freeCashFlow,
    earningsTrend: compareTrend(latestNetIncome?.value, previousNetIncome?.value),
    grossMarginTrend: grossMarginDirection(payload, revenueSeries),
    cashDebtProfile: classifyCashDebt(cash.value, debt.value)
  };
}

function annualSeries(payload: SecCompanyFactsPayload, concepts: string[]): SecFactPoint[] {
  const candidates = factPoints(payload, concepts).filter(point => {
    if (!ANNUAL_FORMS.has(point.form) || !point.start) return false;
    const durationDays = (Date.parse(point.end) - Date.parse(point.start)) / 86_400_000;
    return Number.isFinite(durationDays) && durationDays >= 300 && durationDays <= 400;
  });
  const byPeriod = new Map<string, SecFactPoint>();
  for (const point of candidates) {
    const existing = byPeriod.get(point.end);
    if (!existing || point.filed > existing.filed) byPeriod.set(point.end, point);
  }
  return [...byPeriod.values()].sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed));
}

function matchingAnnualFact(payload: SecCompanyFactsPayload, concepts: string[], reference?: SecFactPoint): SecFactPoint | null {
  if (!reference) return null;
  return factPoints(payload, concepts)
    .filter(point => ANNUAL_FORMS.has(point.form) && point.end === reference.end)
    .sort((a, b) => b.filed.localeCompare(a.filed))[0] ?? null;
}

function factPoints(payload: SecCompanyFactsPayload, concepts: string[]): SecFactPoint[] {
  return Object.values(payload.facts ?? {}).flatMap(namespace => concepts.flatMap(concept =>
    Object.values(namespace?.[concept]?.units ?? {}).flatMap(items => items ?? [])
      .filter(item => Number.isFinite(item.val) && item.end && item.filed && item.form)
      .map(item => ({
        value: Number(item.val),
        start: item.start ?? null,
        end: String(item.end),
        filed: String(item.filed),
        form: String(item.form).toUpperCase(),
        accessionNumber: item.accn ?? null
      }))
  ));
}

function grossMarginDirection(payload: SecCompanyFactsPayload, revenueSeries: SecFactPoint[]): MarginTrend {
  const margins = revenueSeries.slice(0, 2).map(revenue => {
    const grossProfit = matchingAnnualFact(payload, GROSS_PROFIT_CONCEPTS, revenue);
    return grossProfit && revenue.value !== 0 ? (grossProfit.value / revenue.value) * 100 : null;
  });
  if (margins.some(value => value === null) || margins.length < 2) return 'UNKNOWN';
  const change = Number(margins[0]) - Number(margins[1]);
  if (change > 1) return 'EXPANDING';
  if (change < -1) return 'COMPRESSING';
  return 'STABLE';
}

function compareTrend(current?: number, previous?: number): Trend {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 'UNKNOWN';
  const improvement = Number(current) - Number(previous);
  const materiality = Math.max(Math.abs(Number(previous)) * 0.05, 1);
  if (improvement > materiality) return 'IMPROVING';
  if (improvement < -materiality) return 'DETERIORATING';
  return 'STABLE';
}

function classifyCashDebt(cash: number | null, debt: number | null): CashDebtProfile {
  if (cash === null || debt === null) return 'UNKNOWN';
  if (debt <= 0 || cash >= debt) return 'NET_CASH';
  if (cash >= debt * 0.35) return 'MANAGEABLE';
  return 'LEVERED';
}

function ratioRecord(
  payload: SecCompanyFactsPayload,
  value: number | null,
  reference?: SecFactPoint | null
): ProvenanceRecord<number> {
  if (!Number.isFinite(value) || !reference) return missingSecFact();
  return toRecord(payload, { ...reference, value: Number(value) });
}

function toRecord(payload: SecCompanyFactsPayload, point: SecFactPoint): ProvenanceRecord<number> {
  const cik = String(payload.cik ?? '').padStart(10, '0');
  const accession = String(point.accessionNumber ?? '').replaceAll('-', '');
  const sourceUrl = cik && accession
    ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/`
    : 'https://www.sec.gov/edgar/search/';
  const filedAgeMs = Date.now() - Date.parse(point.filed);
  const periodAgeMs = Date.now() - Date.parse(point.end);
  return {
    value: point.value,
    provider: 'SEC EDGAR Company Facts',
    sourceUrl,
    observedAt: point.filed,
    periodEnd: point.end,
    accessionNumber: point.accessionNumber,
    status: Number.isFinite(filedAgeMs)
      && Number.isFinite(periodAgeMs)
      && filedAgeMs <= 550 * 86_400_000
      && periodAgeMs <= 730 * 86_400_000
      ? 'VERIFIED'
      : 'STALE'
  };
}
