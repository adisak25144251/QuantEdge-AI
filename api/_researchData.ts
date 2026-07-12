import { extractLatestSecFact, type SecCompanyFactsPayload } from '../src/domain/research/provenance.js';
import { classifyRecentSecFilings, selectFilingEvidence } from '../src/domain/research/secFilings.js';
import type { ApiRequest, ApiResponse } from './_marketData.js';

const SEC_BASE = 'https://data.sec.gov';
const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const TIMEOUT_MS = 8_000;
const SEC_USER_AGENT = process.env.SEC_USER_AGENT || 'QuantEdge-AI educational-research admin@example.invalid';
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || '';
const RESEARCH_RATE_LIMIT_PER_MINUTE = 10;

let tickerCache: { expiresAt: number; byTicker: Map<string, number> } | null = null;
const researchRateLimits = new Map<string, { startedAt: number; count: number }>();

type UpstreamJson = Record<string, any>;

function allowResearchRequest(req: ApiRequest, res: ApiResponse) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const rawClient = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const client = rawClient?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = researchRateLimits.get(client);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    researchRateLimits.set(client, { startedAt: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  if (bucket.count <= RESEARCH_RATE_LIMIT_PER_MINUTE) return true;
  res.status(429).json({ error: 'Research API rate limit exceeded.', status: 'DATA_REQUIRED' });
  return false;
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<UpstreamJson> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
async function getTickerMap() {
  if (tickerCache && tickerCache.expiresAt > Date.now()) return tickerCache.byTicker;
  const payload = await fetchJson(SEC_TICKERS_URL, { 'User-Agent': SEC_USER_AGENT, Accept: 'application/json' });
  const byTicker = new Map<string, number>();
  for (const item of Object.values(payload)) {
    const ticker = String(item?.ticker ?? '').toUpperCase();
    const cik = Number(item?.cik_str);
    if (ticker && Number.isFinite(cik)) byTicker.set(ticker, cik);
  }
  tickerCache = { expiresAt: Date.now() + 24 * 60 * 60 * 1000, byTicker };
  return byTicker;
}

async function fetchSecResearch(symbol: string, cik: number) {
  const cikPadded = String(cik).padStart(10, '0');
  const payload = await fetchJson(`${SEC_BASE}/api/xbrl/companyfacts/CIK${cikPadded}.json`, {
    'User-Agent': SEC_USER_AGENT,
    Accept: 'application/json'
  }) as SecCompanyFactsPayload;

  return {
    ticker: symbol,
    company: payload.entityName ?? null,
    cik,
    fundamentals: {
      revenue: extractLatestSecFact(payload, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet']),
      netIncome: extractLatestSecFact(payload, ['NetIncomeLoss', 'ProfitLoss']),
      cash: extractLatestSecFact(payload, ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents']),
      debt: extractLatestSecFact(payload, ['LongTermDebtAndFinanceLeaseObligationsCurrent', 'LongTermDebtCurrent', 'LongTermDebt']),
      sharesOutstanding: extractLatestSecFact(payload, ['CommonStockSharesOutstanding'], ['shares'])
    },
    provenance: {
      provider: 'SEC EDGAR Company Facts',
      sourceUrl: `${SEC_BASE}/api/xbrl/companyfacts/CIK${cikPadded}.json`,
      fetchedAt: new Date().toISOString()
    }
  };
}

async function fetchSecFilingEvidence(symbol: string, cik: number) {
  const cikPadded = String(cik).padStart(10, '0');
  const payload = await fetchJson(`${SEC_BASE}/submissions/CIK${cikPadded}.json`, {
    'User-Agent': SEC_USER_AGENT,
    Accept: 'application/json'
  });
  const filings = classifyRecentSecFilings(payload);
  const selected = selectFilingEvidence(filings);
  const withUrl = (filing: typeof selected.material) => {
    if (!filing) return null;
    const accession = filing.accessionNumber.replaceAll('-', '');
    const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}`;
    return { ...filing, sourceUrl: filing.primaryDocument ? `${base}/${filing.primaryDocument}` : `${base}/` };
  };
  return {
    symbol,
    cik,
    material: withUrl(selected.material),
    dilution: withUrl(selected.dilution),
    status: selected.material ? 'VERIFIED' : 'DATA_REQUIRED',
    provider: 'SEC EDGAR Submissions',
    sourceUrl: `${SEC_BASE}/submissions/CIK${cikPadded}.json`,
    fetchedAt: new Date().toISOString()
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchPolygonCatalyst(symbol: string) {
  if (!POLYGON_API_KEY) return { status: 'DATA_REQUIRED', items: [], provider: 'Polygon News', reason: 'POLYGON_API_KEY_NOT_CONFIGURED' };
  const url = new URL('https://api.polygon.io/v2/reference/news');
  url.searchParams.set('ticker', symbol);
  url.searchParams.set('limit', '5');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('sort', 'published_utc');
  url.searchParams.set('apiKey', POLYGON_API_KEY);
  const payload = await fetchJson(url.toString());
  const items = (Array.isArray(payload.results) ? payload.results : []).map((item: any) => ({
    title: item.title ?? null,
    publishedAt: item.published_utc ?? null,
    sourceUrl: item.article_url ?? null,
    publisher: item.publisher?.name ?? null
  })).filter((item: any) => item.title && item.publishedAt && item.sourceUrl);
  return { status: items.length > 0 ? 'VERIFIED' : 'DATA_REQUIRED', items, provider: 'Polygon News', fetchedAt: new Date().toISOString() };
}

export async function handleUsStockResearch(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!allowResearchRequest(req, res)) return;
  const symbol = String(Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol ?? '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) return res.status(400).json({ error: 'A valid US ticker symbol is required.' });

  try {
    const tickerMap = await getTickerMap();
    const cik = tickerMap.get(symbol);
    if (!cik) return res.status(404).json({ error: 'SEC issuer mapping not found.', symbol, status: 'DATA_REQUIRED' });
    const [sec, filingEvidence, catalyst] = await Promise.all([
      fetchSecResearch(symbol, cik),
      fetchSecFilingEvidence(symbol, cik).catch(() => ({ symbol, status: 'DATA_REQUIRED', material: null, dilution: null, provider: 'SEC EDGAR Submissions', reason: 'UPSTREAM_UNAVAILABLE' })),
      fetchPolygonCatalyst(symbol).catch(() => ({ status: 'DATA_REQUIRED', items: [], provider: 'Polygon News', reason: 'UPSTREAM_UNAVAILABLE' }))
    ]);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.json({ symbol, sec, filingEvidence, catalyst, generatedAt: new Date().toISOString(), educationalOnly: true });
  } catch (_error) {
    return res.status(502).json({ error: 'Verified research data is currently unavailable.', symbol, status: 'DATA_REQUIRED' });
  }
}

export async function handleUsStockFilings(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!allowResearchRequest(req, res)) return;
  const raw = String(Array.isArray(req.query.symbols) ? req.query.symbols[0] : req.query.symbols ?? '');
  const symbols = Array.from(new Set(raw.split(',').map(symbol => symbol.trim().toUpperCase()).filter(Boolean)));
  if (symbols.length === 0 || symbols.length > 20 || symbols.some(symbol => !/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))) {
    return res.status(400).json({ error: 'symbols must contain 1-20 valid US ticker symbols.' });
  }

  try {
    const tickerMap = await getTickerMap();
    const results = await mapWithConcurrency(symbols, 3, async symbol => {
      const cik = tickerMap.get(symbol);
      if (!cik) return { symbol, status: 'DATA_REQUIRED', material: null, dilution: null, provider: 'SEC EDGAR Submissions', reason: 'CIK_NOT_FOUND' };
      return fetchSecFilingEvidence(symbol, cik).catch(() => ({ symbol, status: 'DATA_REQUIRED', material: null, dilution: null, provider: 'SEC EDGAR Submissions', reason: 'UPSTREAM_UNAVAILABLE' }));
    });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.json({ results, generatedAt: new Date().toISOString(), educationalOnly: true });
  } catch (_error) {
    return res.status(502).json({ error: 'SEC filing evidence is currently unavailable.', status: 'DATA_REQUIRED', results: [] });
  }
}
