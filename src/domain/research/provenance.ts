export type ProvenanceStatus = 'VERIFIED' | 'STALE' | 'DATA_REQUIRED';

export interface ProvenanceRecord<T> {
  value: T | null;
  provider: string;
  sourceUrl: string | null;
  observedAt: string | null;
  periodEnd?: string | null;
  accessionNumber?: string | null;
  status: ProvenanceStatus;
}
export interface SecCompanyFactsPayload {
  cik?: number;
  entityName?: string;
  facts?: Record<string, Record<string, {
    label?: string;
    units?: Record<string, Array<{
      val?: number;
      start?: string;
      end?: string;
      filed?: string;
      form?: string;
      accn?: string;
      frame?: string;
      fy?: number;
      fp?: string;
    }>>;
  }>>;
}

const ACCEPTED_FORMS = new Set(['10-K', '10-Q', '20-F', '40-F']);

export function extractLatestSecFact(
  payload: SecCompanyFactsPayload,
  concepts: string[],
  unitPreference: string[] = ['USD', 'shares']
): ProvenanceRecord<number> {
  const namespaces = payload.facts ?? {};
  const candidates = Object.values(namespaces).flatMap(namespace => concepts.flatMap(concept => {
    const fact = namespace?.[concept];
    if (!fact?.units) return [];
    const preferredUnit = unitPreference.find(unit => Array.isArray(fact.units?.[unit]));
    const units = preferredUnit ? fact.units[preferredUnit] : Object.values(fact.units)[0];
    return (units ?? []).filter(item =>
      Number.isFinite(item.val) &&
      (preferredUnit !== 'shares' || Number(item.val) > 0) &&
      Boolean(item.filed) &&
      ACCEPTED_FORMS.has(String(item.form ?? ''))
    );
  }));

  const latest = candidates.sort((a, b) =>
    String(b.end ?? '').localeCompare(String(a.end ?? ''))
    || String(b.filed).localeCompare(String(a.filed))
  )[0];
  if (!latest || !Number.isFinite(latest.val)) return missingSecFact();

  const cik = String(payload.cik ?? '').padStart(10, '0');
  const accession = String(latest.accn ?? '').replaceAll('-', '');
  const sourceUrl = cik && accession
    ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/`
    : 'https://www.sec.gov/edgar/search/';
  const filedAgeMs = Date.now() - Date.parse(String(latest.filed));
  const periodAgeMs = latest.end ? Date.now() - Date.parse(String(latest.end)) : filedAgeMs;

  return {
    value: Number(latest.val),
    provider: 'SEC EDGAR Company Facts',
    sourceUrl,
    observedAt: String(latest.filed),
    periodEnd: latest.end ?? null,
    accessionNumber: latest.accn ?? null,
    status: Number.isFinite(filedAgeMs)
      && Number.isFinite(periodAgeMs)
      && filedAgeMs <= 550 * 86_400_000
      && periodAgeMs <= 730 * 86_400_000
      ? 'VERIFIED'
      : 'STALE'
  };
}

export function missingSecFact(): ProvenanceRecord<number> {
  return {
    value: null,
    provider: 'SEC EDGAR Company Facts',
    sourceUrl: null,
    observedAt: null,
    periodEnd: null,
    accessionNumber: null,
    status: 'DATA_REQUIRED'
  };
}
