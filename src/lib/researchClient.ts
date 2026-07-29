export interface FilingEvidenceItem {
  symbol: string;
  status: 'VERIFIED' | 'DATA_REQUIRED';
  provider: string;
  material: {
    form: string;
    filedAt: string;
    ageDays: number;
    items: string[];
    sourceUrl: string;
    signal?: 'MATERIAL_UPDATE' | 'DILUTION_RISK' | 'ROUTINE' | 'DATA_REQUIRED';
  } | null;
  dilution: {
    form: string;
    filedAt: string;
    ageDays: number;
    sourceUrl: string;
  } | null;
  company?: string | null;
  fundamentals?: FundamentalEvidence | null;
  fundamentalsSourceUrl?: string | null;
  fundamentalsFetchedAt?: string | null;
}

export interface FundamentalRecord {
  value: number | null;
  provider: string;
  sourceUrl: string | null;
  observedAt: string | null;
  periodEnd?: string | null;
  status: 'VERIFIED' | 'STALE' | 'DATA_REQUIRED';
}

export interface FundamentalEvidence {
  status: 'VERIFIED' | 'PARTIAL' | 'DATA_REQUIRED';
  revenue: FundamentalRecord;
  revenueGrowthPercent: FundamentalRecord;
  netIncome: FundamentalRecord;
  cash: FundamentalRecord;
  debt: FundamentalRecord;
  sharesOutstanding: FundamentalRecord;
  weightedAverageShares: FundamentalRecord;
  grossMarginPercent: FundamentalRecord;
  freeCashFlow: FundamentalRecord;
  earningsTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNKNOWN';
  grossMarginTrend: 'EXPANDING' | 'STABLE' | 'COMPRESSING' | 'UNKNOWN';
  cashDebtProfile: 'NET_CASH' | 'MANAGEABLE' | 'LEVERED' | 'UNKNOWN';
}

export async function fetchFilingEvidence(symbols: string[]): Promise<Map<string, FilingEvidenceItem>> {
  const unique = Array.from(new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { apiFetch } = await import('./apiClient');
  const response = await apiFetch(`/api/research/filings?symbols=${encodeURIComponent(unique.slice(0, 20).join(','))}`);
  if (!response.ok) throw new Error('SEC filing evidence unavailable.');
  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return new Map(results.map((item: FilingEvidenceItem) => [item.symbol, item]));
}

export function describeMaterialFiling(evidence: FilingEvidenceItem | undefined, fallback: string) {
  if (!evidence?.material || evidence.status !== 'VERIFIED') {
    return { catalyst: fallback, catalystAgeDays: null, catalystVerified: false, catalystKind: 'DATA_REQUIRED' as const };
  }
  const items = evidence.material.items.length > 0 ? `; items ${evidence.material.items.join(', ')}` : '';
  const eventEvidence = evidence.material.form.startsWith('8-K') || evidence.material.form === '6-K';
  return {
    catalyst: `SEC ${evidence.material.form} filed ${evidence.material.filedAt}${items}. Filing evidence requires analyst interpretation.`,
    catalystAgeDays: eventEvidence ? evidence.material.ageDays : null,
    catalystVerified: eventEvidence,
    catalystKind: eventEvidence ? 'EVENT_EVIDENCE' as const : 'PERIODIC_FILING' as const
  };
}
