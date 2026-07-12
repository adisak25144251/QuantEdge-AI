export type FilingSignal = 'MATERIAL_UPDATE' | 'DILUTION_RISK' | 'ROUTINE' | 'DATA_REQUIRED';

export interface SecRecentFilingsPayload {
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      primaryDocument?: string[];
      items?: string[];
    };
  };
}

export interface ClassifiedFiling {
  form: string;
  filedAt: string;
  reportDate: string | null;
  accessionNumber: string;
  primaryDocument: string | null;
  items: string[];
  signal: FilingSignal;
  ageDays: number;
}

const MATERIAL_FORMS = new Set(['8-K', '8-K/A', '10-Q', '10-Q/A', '10-K', '10-K/A', '20-F', '6-K']);
const DILUTION_FORMS = new Set(['S-1', 'S-1/A', 'S-3', 'S-3/A', '424B2', '424B3', '424B5', 'EFFECT']);
const MATERIAL_8K_ITEMS = new Set(['1.01', '1.02', '2.01', '2.02', '2.05', '2.06', '5.02', '7.01', '8.01']);

export function classifyRecentSecFilings(payload: SecRecentFilingsPayload, now = new Date()): ClassifiedFiling[] {
  const recent = payload.filings?.recent;
  if (!recent) return [];
  const forms = recent.form ?? [];

  return forms.map((rawForm, index) => {
    const form = String(rawForm ?? '').toUpperCase();
    const filedAt = String(recent.filingDate?.[index] ?? '');
    const rawItems = String(recent.items?.[index] ?? '');
    const items = rawItems.split(',').map(item => item.trim()).filter(Boolean);
    const hasMaterial8kItem = items.some(item => MATERIAL_8K_ITEMS.has(item));
    const signal: FilingSignal = DILUTION_FORMS.has(form)
      ? 'DILUTION_RISK'
      : MATERIAL_FORMS.has(form) && (!form.startsWith('8-K') || hasMaterial8kItem)
        ? 'MATERIAL_UPDATE'
        : 'ROUTINE';

    return {
      form,
      filedAt,
      reportDate: recent.reportDate?.[index] || null,
      accessionNumber: recent.accessionNumber?.[index] ?? '',
      primaryDocument: recent.primaryDocument?.[index] || null,
      items,
      signal,
      ageDays: ageInDays(filedAt, now)
    };
  }).filter(filing => filing.filedAt && filing.accessionNumber);
}

export function selectFilingEvidence(filings: ClassifiedFiling[]) {
  const material = filings.find(filing => filing.signal === 'MATERIAL_UPDATE' && filing.ageDays >= 0);
  const dilution = filings.find(filing => filing.signal === 'DILUTION_RISK' && filing.ageDays >= 0 && filing.ageDays <= 180);
  return { material: material ?? null, dilution: dilution ?? null };
}

function ageInDays(value: string, now: Date) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return Number.MAX_SAFE_INTEGER;
  return Math.floor((now.getTime() - timestamp) / 86_400_000);
}
