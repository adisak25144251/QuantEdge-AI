import type { ExperimentCandle, ExperimentSeries } from '../../src/domain/experiments/incrementalEdgeExperiment';

interface YahooChartResult {
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
    adjclose?: Array<{ adjclose?: Array<number | null> }>;
  };
}

export async function fetchYahooAdjustedDaily(symbol: string, startDate: string): Promise<ExperimentSeries> {
  const period1 = Math.floor(Date.parse(`${startDate}T00:00:00Z`) / 1_000);
  const period2 = Math.floor(Date.now() / 1_000);
  let lastError: unknown = null;

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    const url = new URL(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}`);
    url.searchParams.set('period1', String(period1));
    url.searchParams.set('period2', String(period2));
    url.searchParams.set('interval', '1d');
    url.searchParams.set('events', 'div,splits');
    url.searchParams.set('includeAdjustedClose', 'true');
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 QuantEdge-Research/1.0'
        },
        signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) throw new Error(`Yahoo ${response.status}`);
      const payload = await response.json() as { chart?: { result?: YahooChartResult[] } };
      const result = payload.chart?.result?.[0];
      if (!result) throw new Error('Yahoo response has no chart result.');
      const candles = parseYahooResult(result);
      if (candles.length < 200) throw new Error(`Only ${candles.length} valid daily candles were returned.`);
      return { symbol: symbol.toUpperCase(), candles };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Yahoo data request failed.');
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function parseYahooResult(result: YahooChartResult): ExperimentCandle[] {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  if (!quote) return [];

  return timestamps.flatMap((timestamp, index) => {
    const raw = [
      quote.open?.[index],
      quote.high?.[index],
      quote.low?.[index],
      quote.close?.[index],
      quote.volume?.[index],
      adjusted[index]
    ];
    if (raw.some(value => value === null || value === undefined)) return [];
    const values = raw.map(Number);
    if (!values.every(Number.isFinite) || values[3] <= 0 || values[4] < 0 || values[5] <= 0) return [];
    const adjustmentFactor = values[5] / values[3];
    if (!(adjustmentFactor > 0)) return [];
    return [{
      time: timestamp * 1_000,
      open: values[0] * adjustmentFactor,
      high: values[1] * adjustmentFactor,
      low: values[2] * adjustmentFactor,
      close: values[5],
      volume: values[4] / adjustmentFactor
    }];
  });
}
