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
  } | null;
  dilution: {
    form: string;
    filedAt: string;
    ageDays: number;
    sourceUrl: string;
  } | null;
}

export async function fetchFilingEvidence(symbols: string[]): Promise<Map<string, FilingEvidenceItem>> {
  const unique = Array.from(new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { apiFetch } = await import('./apiClient');
  const chunks = Array.from({ length: Math.ceil(unique.length / 8) }, (_, index) => unique.slice(index * 8, index * 8 + 8));
  const payloads = await Promise.all(chunks.map(async chunk => {
    const response = await apiFetch(`/api/research/filings?symbols=${encodeURIComponent(chunk.join(','))}`);
    if (!response.ok) throw new Error('SEC filing evidence unavailable.');
    return response.json();
  }));
  const results = payloads.flatMap(payload => Array.isArray(payload?.results) ? payload.results : []);
  return new Map(results.map((item: FilingEvidenceItem) => [item.symbol, item]));
}

export function describeMaterialFiling(evidence: FilingEvidenceItem | undefined, fallback: string) {
  if (!evidence?.material || evidence.status !== 'VERIFIED') return { catalyst: fallback, catalystAgeDays: null };
  const items = evidence.material.items.length > 0 ? `; items ${evidence.material.items.join(', ')}` : '';
  return {
    catalyst: `SEC ${evidence.material.form} filed ${evidence.material.filedAt}${items}. Filing evidence requires analyst interpretation.`,
    catalystAgeDays: evidence.material.ageDays
  };
}
