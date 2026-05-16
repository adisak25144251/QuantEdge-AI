import { normalizeKlineRequest } from "../src/domain/market/marketDataIntegrity";

const REQUEST_TIMEOUT_MS = 8_000;
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || "";
const MARKET_DATA_PROVIDER = (process.env.MARKET_DATA_PROVIDER || (POLYGON_API_KEY ? "polygon" : "yahoo")).toLowerCase();

export type ApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const yahooHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
};

const fetchJsonWithTimeout = async (url: string, init: RequestInit = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const firstQueryValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

const queryToRecord = (query: ApiRequest["query"]) => {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, firstQueryValue(value)])
  ) as Record<string, unknown>;
};

const mapSymbolToYahoo = (symbol: string) => {
  if (symbol.endsWith("USDT")) return `${symbol.slice(0, -4)}-USD`;
  if (symbol.endsWith("USDC")) return `${symbol.slice(0, -4)}-USD`;

  switch (symbol) {
    case "US100": return "^NDX";
    case "US30": return "^DJI";
    case "US500": return "^GSPC";
    case "UK100": return "^FTSE";
    case "JP225": return "^N225";
    case "DXY": return "DX-Y.NYB";
    case "XAUUSD": return "GC=F";
    case "USOIL": return "CL=F";
    case "UKOIL": return "BZ=F";
    case "XAGUSD": return "SI=F";
    default: return symbol;
  }
};

const mapIntervalToYahoo = (interval: string) => {
  switch (interval) {
    case "15m": return "15m";
    case "1h": return "60m";
    case "4h": return "60m";
    case "1d": return "1d";
    case "1w": return "1wk";
    case "1M": return "1mo";
    default: return interval;
  }
};

const mapIntervalRange = (interval: string, limit: number) => {
  switch (interval) {
    case "15m": return `${Math.ceil((limit * 15) / 1440) + 1}d`;
    case "60m": return `${Math.ceil((limit * 60) / 1440) + 5}d`;
    case "1d": return `${Math.ceil(limit / 250)}y`;
    default: return "1y";
  }
};

const isUsEquityType = (type: string) => type === "US_STOCK" || type === "STOCK" || type === "ETF";

const getActiveEquityProvider = () => {
  if (MARKET_DATA_PROVIDER === "polygon" && POLYGON_API_KEY) return "polygon";
  return "yahoo";
};

const toDateParam = (date: Date) => date.toISOString().slice(0, 10);

const mapIntervalToPolygon = (interval: string) => {
  switch (interval) {
    case "15m": return { multiplier: 15, timespan: "minute", lookbackDaysPerCandle: 1 / 26 };
    case "1h": return { multiplier: 1, timespan: "hour", lookbackDaysPerCandle: 1 / 7 };
    case "4h": return { multiplier: 4, timespan: "hour", lookbackDaysPerCandle: 1 / 2 };
    case "1d": return { multiplier: 1, timespan: "day", lookbackDaysPerCandle: 2 };
    case "1w": return { multiplier: 1, timespan: "week", lookbackDaysPerCandle: 10 };
    case "1M": return { multiplier: 1, timespan: "month", lookbackDaysPerCandle: 40 };
    default: return { multiplier: 1, timespan: "day", lookbackDaysPerCandle: 2 };
  }
};

const fetchPolygonAggregateCandles = async (symbol: string, interval: string, limit: number) => {
  if (!POLYGON_API_KEY) throw new Error("POLYGON_API_KEY is not configured.");
  const mapped = mapIntervalToPolygon(interval);
  const to = new Date();
  const lookbackMs = Math.ceil(limit * mapped.lookbackDaysPerCandle + 30) * 24 * 60 * 60 * 1000;
  const from = new Date(to.getTime() - lookbackMs);
  const url = new URL(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${mapped.multiplier}/${mapped.timespan}/${toDateParam(from)}/${toDateParam(to)}`);
  url.searchParams.set("adjusted", "true");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("limit", "50000");
  url.searchParams.set("apiKey", POLYGON_API_KEY);

  const data = await fetchJsonWithTimeout(url.toString());
  const results = Array.isArray(data?.results) ? data.results : [];
  return results
    .map((item: any) => ({
      time: Number(item.t),
      open: Number(item.o),
      high: Number(item.h),
      low: Number(item.l),
      close: Number(item.c),
      volume: Number(item.v)
    }))
    .filter((candle: any) =>
      Number.isFinite(candle.time) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close) &&
      Number.isFinite(candle.volume)
    )
    .slice(-limit);
};

const fetchPolygonTickerDetails = async (symbol: string) => {
  if (!POLYGON_API_KEY) return null;
  const url = new URL(`https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(symbol)}`);
  url.searchParams.set("apiKey", POLYGON_API_KEY);
  const data = await fetchJsonWithTimeout(url.toString());
  return data?.results || null;
};

const candlesToKlines = (candles: any[]) => candles.map(candle => [
  candle.time,
  String(candle.open),
  String(candle.high),
  String(candle.low),
  String(candle.close),
  String(candle.volume),
  candle.time + 59_999,
  "0", "0", "0", "0", "0"
]);

const formatYahooKlines = (data: any, interval: string, yahooInterval: string, limit: number) => {
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quotes = result?.indicators?.quote?.[0] || {};

  if (!Array.isArray(timestamps) || !quotes.open || !quotes.close) {
    throw new Error("Malformed data from Yahoo");
  }

  let formattedData = timestamps.map((ts: number, index: number) => [
    ts * 1000,
    quotes.open[index] ? String(quotes.open[index]) : "0",
    quotes.high[index] ? String(quotes.high[index]) : "0",
    quotes.low[index] ? String(quotes.low[index]) : "0",
    quotes.close[index] ? String(quotes.close[index]) : "0",
    quotes.volume[index] ? String(quotes.volume[index]) : "0",
    ts * 1000 + 59_999,
    "0", "0", "0", "0", "0"
  ]).filter((row: any[]) => row[1] !== "0" && row[4] !== "0");

  if (interval === "4h" && yahooInterval === "60m") {
    const aggregated = [];
    for (let i = 0; i < formattedData.length; i += 4) {
      const chunk = formattedData.slice(i, i + 4);
      if (chunk.length === 0) continue;
      aggregated.push([
        chunk[0][0],
        chunk[0][1],
        String(Math.max(...chunk.map(c => Number(c[2])))),
        String(Math.min(...chunk.map(c => Number(c[3])))),
        chunk[chunk.length - 1][4],
        String(chunk.reduce((sum, c) => sum + Number(c[5]), 0)),
        chunk[chunk.length - 1][6],
        "0", "0", "0", "0", "0"
      ]);
    }
    formattedData = aggregated;
  }

  return formattedData.slice(-limit);
};

const fetchYahooKlines = async (symbol: string, interval: string, limit: number) => {
  const yahooSymbol = mapSymbolToYahoo(symbol);
  const yahooInterval = mapIntervalToYahoo(interval);
  const range = mapIntervalRange(yahooInterval, limit);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${encodeURIComponent(yahooInterval)}&range=${encodeURIComponent(range)}`;
  const data = await fetchJsonWithTimeout(url, { headers: yahooHeaders });
  return formatYahooKlines(data, interval, yahooInterval, limit);
};

const normalizeScreenerSymbols = (symbolsParam: string) => {
  const rawSymbols = symbolsParam.split(",").map(symbol => symbol.trim().toUpperCase()).filter(Boolean);
  const uniqueSymbols = Array.from(new Set(rawSymbols));
  if (uniqueSymbols.length === 0 || uniqueSymbols.length > 30) return null;
  if (!uniqueSymbols.every(symbol => /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))) return null;
  return uniqueSymbols;
};

const mapWithConcurrency = async <T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
};

const smaFromValues = (values: number[], period: number) => {
  if (values.length < period) return null;
  const sample = values.slice(-period);
  return sample.reduce((sum, value) => sum + value, 0) / period;
};

export const setMarketDataHeaders = (res: ApiResponse, provider: string) => {
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
  res.setHeader("X-Market-Data-Provider", provider);
};

export const handleKlines = async (req: ApiRequest, res: ApiResponse) => {
  if (req.method && req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const normalized = normalizeKlineRequest(queryToRecord(req.query));
  if (!normalized.ok) {
    return res.status(400).json({ error: "Invalid market data request.", issues: normalized.issues });
  }

  const { symbol, interval, limit, type } = normalized.value;

  if (type === "CRYPTO") {
    try {
      const data = await fetchJsonWithTimeout(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`);
      setMarketDataHeaders(res, "binance");
      return res.json(data);
    } catch (_binanceError) {
      try {
        const data = await fetchYahooKlines(symbol, interval, limit);
        setMarketDataHeaders(res, "yahoo-crypto-fallback");
        return res.json(data);
      } catch (_yahooError) {
        return res.status(502).json({ error: "Failed to fetch crypto market data" });
      }
    }
  }

  if (isUsEquityType(type) && getActiveEquityProvider() === "polygon") {
    try {
      const candles = await fetchPolygonAggregateCandles(symbol, interval, limit);
      setMarketDataHeaders(res, "polygon");
      return res.json(candlesToKlines(candles));
    } catch (_polygonError) {
      // Fall through to Yahoo for availability when Polygon is not reachable.
    }
  }

  try {
    const data = await fetchYahooKlines(symbol, interval, limit);
    setMarketDataHeaders(res, "yahoo");
    return res.json(data);
  } catch (_error) {
    return res.status(502).json({ error: "Failed to fetch market data" });
  }
};

export const handleUsStockScreener = async (req: ApiRequest, res: ApiResponse) => {
  if (req.method && req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const symbolsParam = String(firstQueryValue(req.query.symbols) || "");
  const symbols = normalizeScreenerSymbols(symbolsParam);

  if (!symbols) {
    return res.status(400).json({ error: "symbols query must contain 1-30 valid US ticker symbols." });
  }

  if (getActiveEquityProvider() === "polygon") {
    try {
      const polygonResults = await mapWithConcurrency(symbols, 4, async symbol => {
        const [candles, details] = await Promise.all([
          fetchPolygonAggregateCandles(symbol, "1d", 260).catch(() => []),
          fetchPolygonTickerDetails(symbol).catch(() => null)
        ]);
        const closes = candles.map((candle: any) => Number(candle.close)).filter(Number.isFinite);
        const volumes = candles.map((candle: any) => Number(candle.volume)).filter(Number.isFinite);
        const latest = candles[candles.length - 1] || null;
        return {
          symbol,
          quote: {
            shortName: details?.name || null,
            exchange: details?.primary_exchange || details?.market || null,
            marketCap: details?.market_cap ?? null,
            regularMarketPrice: latest?.close ?? null,
            regularMarketVolume: latest?.volume ?? null,
            averageDailyVolume3Month: volumes.length > 0 ? Math.round(volumes.slice(-60).reduce((sum, value) => sum + value, 0) / Math.max(1, Math.min(60, volumes.length))) : null,
            fiftyTwoWeekHigh: closes.length > 0 ? Math.max(...closes.slice(-252)) : null,
            fiftyDayAverage: smaFromValues(closes, 50),
            twoHundredDayAverage: smaFromValues(closes, 200),
            trailingAnnualDividendYield: null,
            dataProvider: "polygon"
          },
          candles,
          dataProvider: "polygon",
          dataQuality: {
            adjusted: true,
            candleCount: candles.length,
            officialProvider: true
          }
        };
      });
      setMarketDataHeaders(res, "polygon");
      return res.json(polygonResults);
    } catch (_error) {
      // Fall through to Yahoo.
    }
  }

  try {
    let quoteResults = [];
    try {
      const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
      const quoteData = await fetchJsonWithTimeout(quoteUrl, { headers: yahooHeaders });
      quoteResults = quoteData?.quoteResponse?.result || [];
    } catch (_quoteError) {
      quoteResults = [];
    }

    const quotesBySymbol = new Map<string, any>(quoteResults.map((item: any) => [String(item.symbol || "").toUpperCase(), item]));
    const chartMetaBySymbol = new Map<string, any>();
    const chartResults = await mapWithConcurrency(symbols, 5, async symbol => {
      try {
        const chartData = await fetchJsonWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`, { headers: yahooHeaders });
        const result = chartData?.chart?.result?.[0];
        chartMetaBySymbol.set(symbol, result?.meta || {});
        const timestamps = result?.timestamp || [];
        const quotes = result?.indicators?.quote?.[0] || {};
        const candles = timestamps.map((ts: number, index: number) => ({
          time: ts * 1000,
          open: quotes.open?.[index] ?? null,
          high: quotes.high?.[index] ?? null,
          low: quotes.low?.[index] ?? null,
          close: quotes.close?.[index] ?? null,
          volume: quotes.volume?.[index] ?? null
        })).filter((candle: any) => Number.isFinite(candle.close));
        return [symbol, candles.slice(-220)] as const;
      } catch (_error) {
        return [symbol, []] as const;
      }
    });

    const chartsBySymbol = Object.fromEntries(chartResults);
    const result = symbols.map(symbol => {
      const quote: any = quotesBySymbol.get(symbol) || {};
      const meta: any = chartMetaBySymbol.get(symbol) || {};
      return {
        symbol,
        quote: {
          shortName: quote.shortName || quote.longName || meta.shortName || meta.longName || null,
          exchange: quote.fullExchangeName || quote.exchange || meta.exchangeName || meta.exchange || null,
          marketCap: quote.marketCap ?? null,
          regularMarketPrice: quote.regularMarketPrice ?? meta.regularMarketPrice ?? meta.previousClose ?? null,
          regularMarketVolume: quote.regularMarketVolume ?? null,
          averageDailyVolume3Month: quote.averageDailyVolume3Month ?? null,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
          fiftyDayAverage: quote.fiftyDayAverage ?? null,
          twoHundredDayAverage: quote.twoHundredDayAverage ?? null,
          trailingAnnualDividendYield: quote.trailingAnnualDividendYield ?? null
        },
        candles: chartsBySymbol[symbol] || []
      };
    });
    setMarketDataHeaders(res, "yahoo");
    return res.json(result);
  } catch (_error) {
    return res.status(502).json({ error: "Failed to fetch US stock screener data" });
  }
};
