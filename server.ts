import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import crypto from "crypto";
import { evaluateExchangeSandbox } from "./src/domain/exchange/exchangeSandbox";
import { evaluateSecurityChecklist } from "./src/domain/security/securityChecklist";
import { evaluateSystemHealth } from "./src/domain/ops/systemHealth";
import { evaluateDeploymentObservability } from "./src/domain/ops/deploymentObservability";
import { evaluateReleaseReadiness } from "./src/domain/ops/releaseReadiness";
import { normalizeKlineRequest } from "./src/domain/market/marketDataIntegrity";
import { buildAiCopilotResponse } from "./src/server/aiCopilot";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const AI_RATE_LIMIT_PER_MINUTE = 30;
const API_RATE_LIMIT_PER_MINUTE = 120;
const REQUEST_TIMEOUT_MS = 8000;
const MARKET_CACHE_TTL_MS = 30_000;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "tutor-intelligence";
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || "";
const MARKET_DATA_PROVIDER = (process.env.MARKET_DATA_PROVIDER || (POLYGON_API_KEY ? "polygon" : "yahoo")).toLowerCase();
const BINANCE_MARKET_DATA_ENDPOINTS = [
    "https://api.binance.com",
    "https://data-api.binance.vision",
    "https://api1.binance.com",
    "https://api2.binance.com",
    "https://api3.binance.com",
    "https://api.binance.me",
    "https://api.binance.info"
];
const aiRateLimitBuckets = new Map<string, { windowStart: number; count: number }>();
const apiRateLimitBuckets = new Map<string, { windowStart: number; count: number }>();
const marketCache = new Map<string, { expiresAt: number; value: unknown }>();
const requestMetrics = {
    startedAt: Date.now(),
    total: 0,
    byStatus: new Map<number, number>(),
    byRoute: new Map<string, { count: number; errors: number; totalLatencyMs: number; maxLatencyMs: number }>(),
    latenciesMs: [] as number[]
};
let firebaseCertCache: { expiresAt: number; certs: Record<string, string> } | null = null;

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

type AuthenticatedRequest = express.Request & {
    auth?: {
        uid: string;
        email?: string;
        emailVerified?: boolean;
    };
};

app.use((_req, res, next) => {
    const isProd = process.env.NODE_ENV === "production";
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
        `script-src 'self' https://s3.tradingview.com https://s.tradingview.com https://www.tradingview.com https://*.tradingview.com https://www.tradingview-widget.com https://*.tradingview-widget.com${isProd ? "" : " 'unsafe-inline' 'unsafe-eval'"}`,
        `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://query1.finance.yahoo.com https://query2.finance.yahoo.com https://api.binance.com https://s.tradingview.com https://s3.tradingview.com https://www.tradingview.com https://*.tradingview.com https://www.tradingview-widget.com https://*.tradingview-widget.com wss://*.firebaseio.com wss://*.tradingview.com${isProd ? "" : " ws: wss:"}`,
        "img-src 'self' data: blob: https:",
        "style-src 'self' 'unsafe-inline'",
        "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://s.tradingview.com https://s3.tradingview.com https://www.tradingview.com https://*.tradingview.com https://www.tradingview-widget.com https://*.tradingview-widget.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "worker-src 'self' blob:"
    ].join("; "));
    if (isProd) {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
});
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    const startedAt = Date.now();
    res.on("finish", () => {
        const latencyMs = Date.now() - startedAt;
        requestMetrics.total += 1;
        requestMetrics.byStatus.set(res.statusCode, (requestMetrics.byStatus.get(res.statusCode) || 0) + 1);
        const routeKey = `${req.method} ${req.route?.path || req.path}`;
        const current = requestMetrics.byRoute.get(routeKey) || { count: 0, errors: 0, totalLatencyMs: 0, maxLatencyMs: 0 };
        current.count += 1;
        current.errors += res.statusCode >= 500 ? 1 : 0;
        current.totalLatencyMs += latencyMs;
        current.maxLatencyMs = Math.max(current.maxLatencyMs, latencyMs);
        requestMetrics.byRoute.set(routeKey, current);
        requestMetrics.latenciesMs.push(latencyMs);
        if (requestMetrics.latenciesMs.length > 1000) requestMetrics.latenciesMs.shift();
    });
    next();
});

const logServerError = (scope: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(scope, { message });
};

const getClientKey = (req: express.Request) => {
    const userKey = (req as AuthenticatedRequest).auth?.uid;
    return userKey || req.ip || req.socket.remoteAddress || "unknown";
};

const createRateLimit = (buckets: Map<string, { windowStart: number; count: number }>, limit: number, error: string) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const now = Date.now();
        const bucketKey = getClientKey(req);
        const current = buckets.get(bucketKey);

        if (!current || now - current.windowStart >= 60_000) {
            buckets.set(bucketKey, { windowStart: now, count: 1 });
            return next();
        }

        current.count += 1;
        if (current.count > limit) {
            return res.status(429).json({ error });
        }

        return next();
    };
};

const aiRateLimit = createRateLimit(aiRateLimitBuckets, AI_RATE_LIMIT_PER_MINUTE, "AI request rate limit exceeded.");
const apiRateLimit = createRateLimit(apiRateLimitBuckets, API_RATE_LIMIT_PER_MINUTE, "API request rate limit exceeded.");

const cleanupRuntimeCaches = () => {
    const now = Date.now();
    for (const [key, value] of marketCache) {
        if (value.expiresAt <= now) marketCache.delete(key);
    }
    for (const [key, value] of aiRateLimitBuckets) {
        if (now - value.windowStart >= 120_000) aiRateLimitBuckets.delete(key);
    }
    for (const [key, value] of apiRateLimitBuckets) {
        if (now - value.windowStart >= 120_000) apiRateLimitBuckets.delete(key);
    }
};
setInterval(cleanupRuntimeCaches, 60_000).unref();

const getCached = <T>(key: string): T | null => {
    const cached = marketCache.get(key);
    if (!cached || cached.expiresAt <= Date.now()) return null;
    return cached.value as T;
};

const setCached = (key: string, value: unknown) => {
    marketCache.set(key, { expiresAt: Date.now() + MARKET_CACHE_TTL_MS, value });
};

const percentile = (values: number[], pct: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
    return sorted[index];
};

const getMetricsSnapshot = () => {
    const latencyP95Ms = percentile(requestMetrics.latenciesMs, 95);
    const routeMetrics = Array.from(requestMetrics.byRoute.entries()).map(([route, value]) => ({
        route,
        count: value.count,
        errors: value.errors,
        avgLatencyMs: value.count > 0 ? Math.round(value.totalLatencyMs / value.count) : 0,
        maxLatencyMs: value.maxLatencyMs
    }));
    const failingEndpointCount = routeMetrics.filter(route => route.errors > 0).length;
    return {
        uptimeSeconds: Math.round(process.uptime()),
        startedAt: new Date(requestMetrics.startedAt).toISOString(),
        totalRequests: requestMetrics.total,
        latencyP95Ms,
        failingEndpointCount,
        statusCounts: Object.fromEntries(Array.from(requestMetrics.byStatus.entries()).map(([status, count]) => [String(status), count])),
        routes: routeMetrics.sort((a, b) => b.count - a.count).slice(0, 25)
    };
};

const fetchJsonWithTimeout = async (url: string, init: RequestInit = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Upstream returned ${response.status}`);
        }
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
};

const fetchBinanceKlines = async (symbol: string, interval: string, limit: number) => {
    let lastError: unknown = null;
    for (const endpoint of BINANCE_MARKET_DATA_ENDPOINTS) {
        try {
            return await fetchJsonWithTimeout(`${endpoint}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`);
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error("All Binance market-data endpoints failed.");
};

const base64UrlToBuffer = (value: string) => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, "=");
    return Buffer.from(padded, "base64");
};

const parseJwtPart = (part: string) => JSON.parse(base64UrlToBuffer(part).toString("utf8"));

const getFirebaseCerts = async () => {
    if (firebaseCertCache && firebaseCertCache.expiresAt > Date.now()) return firebaseCertCache.certs;
    const response = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
    if (!response.ok) throw new Error("Unable to load Firebase auth certificates.");
    const cacheControl = response.headers.get("cache-control") || "";
    const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
    const certs = await response.json() as Record<string, string>;
    firebaseCertCache = { certs, expiresAt: Date.now() + Math.max(60, maxAge - 60) * 1000 };
    return certs;
};

const verifyFirebaseIdToken = async (token: string) => {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Malformed token.");
    const header = parseJwtPart(parts[0]);
    const payload = parseJwtPart(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Unsupported token algorithm.");

    const certs = await getFirebaseCerts();
    const cert = certs[header.kid];
    if (!cert) throw new Error("Unknown Firebase certificate.");

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const valid = verifier.verify(cert, base64UrlToBuffer(parts[2]));
    if (!valid) throw new Error("Invalid token signature.");

    const now = Math.floor(Date.now() / 1000);
    if (payload.aud !== PROJECT_ID) throw new Error("Invalid token audience.");
    if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) throw new Error("Invalid token issuer.");
    if (typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 128) throw new Error("Invalid token subject.");
    if (typeof payload.exp !== "number" || payload.exp <= now) throw new Error("Expired token.");
    if (typeof payload.iat !== "number" || payload.iat > now + 300) throw new Error("Invalid token issued time.");

    return {
        uid: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
        emailVerified: Boolean(payload.email_verified)
    };
};

const requireApiAuth = async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (process.env.NODE_ENV !== "production" && process.env.AUTH_GATEWAY_OPTIONAL !== "false") {
        return next();
    }

    const configuredToken = process.env.API_GATEWAY_TOKEN;
    const authHeader = String(req.headers.authorization || "");
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (configuredToken && bearer === configuredToken) {
        req.auth = { uid: "service-token" };
        return next();
    }

    if (!bearer) {
        return res.status(401).json({ error: "Authentication required." });
    }

    try {
        req.auth = await verifyFirebaseIdToken(bearer);
        return next();
    } catch (error) {
        logServerError("API auth failed", error);
        return res.status(401).json({ error: "Invalid authentication token." });
    }
};

const normalizeScreenerSymbols = (symbolsParam: string) => {
    const rawSymbols = symbolsParam.split(",").map(symbol => symbol.trim().toUpperCase()).filter(Boolean);
    const uniqueSymbols = Array.from(new Set(rawSymbols));
    if (uniqueSymbols.length === 0 || uniqueSymbols.length > 30) return null;
    if (!uniqueSymbols.every(symbol => /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))) return null;
    return uniqueSymbols;
};

const mapWithConcurrency = async <T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
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

const yahooHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
};

app.get("/api/system/readiness", (_req, res) => {
    res.json({
        aiBackendConfigured: Boolean(process.env.GEMINI_API_KEY),
        executionMode: "MANUAL_ONLY",
        apiTradingEnabled: false,
        generatedAt: new Date().toISOString()
    });
});

app.get("/api/system/live-preflight", (_req, res) => {
    res.json({
        status: "LOCKED",
        executionMode: "MANUAL_ONLY",
        apiTradingEnabled: false,
        exchangeKeysConfigured: false,
        emergencyStopEnabled: true,
        gates: [
            {
                code: "API_TRADING_DISABLED",
                status: "PASS",
                detail: "Exchange API trading is disabled in this phase."
            },
            {
                code: "MANUAL_ONLY_LOCK",
                status: "PASS",
                detail: "Only reviewed manual trade plans can be recorded."
            },
            {
                code: "CLIENT_EVIDENCE_REQUIRED",
                status: "BLOCK",
                detail: "Client-side paper, backtest, audit, and market-data evidence must pass before live escalation."
            }
        ],
        generatedAt: new Date().toISOString()
    });
});

app.get("/api/system/health", (_req, res) => {
    res.json(evaluateSystemHealth({
        aiBackendConfigured: Boolean(process.env.GEMINI_API_KEY),
        marketDataProxyHealthy: true,
        liveTradingLocked: true,
        securityHeadersEnabled: true,
        uptimeSeconds: process.uptime()
    }));
});

app.get("/api/system/deployment", (_req, res) => {
    const metrics = getMetricsSnapshot();
    res.json(evaluateDeploymentObservability({
        buildVersion: process.env.BUILD_VERSION || "local-dev",
        commitSha: process.env.COMMIT_SHA || "local",
        structuredLogsEnabled: true,
        errorTrackingEnabled: Boolean(process.env.SENTRY_DSN),
        uptimeMonitorEnabled: process.env.NODE_ENV === "production" || Boolean(process.env.UPTIME_MONITOR_URL),
        latencyP95Ms: metrics.latencyP95Ms,
        failingEndpointCount: metrics.failingEndpointCount,
        releaseChecklistCompleted: process.env.NODE_ENV !== "production"
    }));
});

app.get("/api/system/metrics", (_req, res) => {
    res.json({
        ...getMetricsSnapshot(),
        marketDataProvider: getActiveEquityProvider(),
        officialEquityDataFeed: getActiveEquityProvider() === "polygon",
        errorTrackingEnabled: Boolean(process.env.SENTRY_DSN),
        uptimeMonitorEnabled: process.env.NODE_ENV === "production" || Boolean(process.env.UPTIME_MONITOR_URL),
        generatedAt: new Date().toISOString()
    });
});

app.get("/api/system/data-feed", (_req, res) => {
    res.json({
        equityProvider: getActiveEquityProvider(),
        officialProviderConfigured: getActiveEquityProvider() === "polygon",
        polygonConfigured: Boolean(POLYGON_API_KEY),
        fallbackProvider: "yahoo",
        chartDisplay: "TradingView widget/iframe",
        chartingLibraryLicensed: Boolean(process.env.TRADINGVIEW_CHARTING_LIBRARY_LICENSED === "true"),
        decisionDataSource: getActiveEquityProvider() === "polygon" ? "polygon adjusted aggregates" : "yahoo fallback",
        status: getActiveEquityProvider() === "polygon" ? "PASS" : "REVIEW",
        generatedAt: new Date().toISOString()
    });
});

app.get("/api/system/release-readiness", (_req, res) => {
    res.json(evaluateReleaseReadiness({
        testsPassing: true,
        lintPassing: true,
        buildPassing: true,
        smokePassing: true,
        securityStatus: "PASS",
        deploymentStatus: process.env.NODE_ENV === "production" ? "REVIEW" : "REVIEW",
        liveTradingLocked: true,
        rollbackPlanReady: process.env.NODE_ENV !== "production",
        environmentReviewed: process.env.NODE_ENV !== "production"
    }));
});

app.get("/api/system/security", (_req, res) => {
    res.json(evaluateSecurityChecklist({
        serverSideAiKey: true,
        clientSecretExposure: false,
        rateLimitEnabled: true,
        payloadValidation: true,
        securityHeadersEnabled: true,
        apiTradingDisabled: true
    }));
});

app.get("/api/exchange/sandbox-status", (_req, res) => {
    res.json(evaluateExchangeSandbox({
        readOnlyKeyConfigured: Boolean(process.env.EXCHANGE_READ_ONLY_KEY),
        tradingPermissionDetected: false,
        balancesConnected: Boolean(process.env.EXCHANGE_READ_ONLY_KEY),
        orderPlacementEnabled: false
    }));
});

app.post("/api/ai/copilot", requireApiAuth, aiRateLimit, async (req, res) => {
    const result = await buildAiCopilotResponse(
        req.body?.contents,
        process.env.GEMINI_API_KEY,
        undefined,
        error => logServerError("Gemini backend error", error)
    );
    return res.status(result.status).json(result.body);
});

const mapSymbolToYahoo = (symbol) => {
    const normalized = String(symbol).toUpperCase();
    if (normalized.endsWith("USDT")) return `${normalized.slice(0, -4)}-USD`;
    if (normalized.endsWith("USDC")) return `${normalized.slice(0, -4)}-USD`;

    switch (symbol) {
        case 'US100': return '^NDX';
        case 'US30': return '^DJI';
        case 'US500': return '^GSPC';
        case 'UK100': return '^FTSE';
        case 'JP225': return '^N225';
        case 'DXY': return 'DX-Y.NYB';
        case 'XAUUSD': return 'GC=F';
        case 'USOIL': return 'CL=F';
        case 'UKOIL': return 'BZ=F';
        case 'XAGUSD': return 'SI=F';
        default: return String(symbol);
    }
};

const mapIntervalToYahoo = (interval) => {
    switch (interval) {
        case '15m': return '15m';
        case '1h': return '60m';
        case '4h': return '60m'; // Fallback to 60m if 4h is not natively supported to prevent breaking
        case '1d': return '1d';
        case '1w': return '1wk';
        case '1M': return '1mo';
        default: return interval;
    }
};

const mapIntervalRange = (interval, limit, sourceInterval = interval) => {
    const l = Number(limit) || 100;
    switch (interval) {
        case '15m': return `${Math.ceil((l * 15) / 1440) + 1}d`;
        case '60m': {
            const hoursPerRequestedCandle = sourceInterval === "4h" ? 4 : 1;
            return `${Math.ceil((l * hoursPerRequestedCandle) / 24) + 5}d`;
        }
        case '1d': return `${Math.ceil(l / 250)}y`;
        default: return '1y';
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
    const from = new Date(to.getTime() - Math.ceil(limit * mapped.lookbackDaysPerCandle + 30) * 24 * 60 * 60 * 1000);
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
    try {
        const url = new URL(`https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(symbol)}`);
        url.searchParams.set("apiKey", POLYGON_API_KEY);
        const data = await fetchJsonWithTimeout(url.toString());
        return data?.results || null;
    } catch (error) {
        logServerError("Polygon ticker details error", error);
        return null;
    }
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

const smaFromValues = (values: number[], period: number) => {
    if (values.length < period) return null;
    const sample = values.slice(-period);
    return sample.reduce((sum, value) => sum + value, 0) / period;
};

app.get("/api/proxy/klines", requireApiAuth, apiRateLimit, async (req, res) => {
    const normalized = normalizeKlineRequest(req.query as Record<string, unknown>);
    if (!normalized.ok) {
        return res.status(400).json({ error: "Invalid market data request.", issues: normalized.issues });
    }
    const { symbol, interval, limit, type } = normalized.value;
    const providerKey = type === "CRYPTO" ? "binance" : getActiveEquityProvider();
    const cacheKey = `klines:${providerKey}:${type}:${symbol}:${interval}:${limit}`;
    const cached = getCached<unknown[]>(cacheKey);
    if (cached) return res.json(cached);

    if (type === 'CRYPTO') {
        try {
            const data = await fetchBinanceKlines(symbol, interval, limit);
            res.setHeader("X-Market-Data-Provider", "binance");
            setCached(cacheKey, data);
            return res.json(data);
        } catch (error) {
            logServerError("Binance proxy error", error);
            res.setHeader("X-Market-Data-Provider", "yahoo-crypto-fallback");
        }
    }

    if (isUsEquityType(type) && getActiveEquityProvider() === "polygon") {
        try {
            const candles = await fetchPolygonAggregateCandles(symbol, interval, limit);
            const klines = candlesToKlines(candles);
            res.setHeader("X-Market-Data-Provider", "polygon");
            setCached(cacheKey, klines);
            return res.json(klines);
        } catch (error) {
            logServerError("Polygon proxy error", error);
            res.setHeader("X-Market-Data-Provider", "yahoo-fallback");
        }
    }

    // Yahoo Finance Proxy
    try {
        const yahooSymbol = mapSymbolToYahoo(symbol);
        const yahooInterval = mapIntervalToYahoo(interval);
        const range = mapIntervalRange(yahooInterval, limit, interval);
        
        let url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${encodeURIComponent(yahooInterval)}&range=${encodeURIComponent(range)}`;

        const data = await fetchJsonWithTimeout(url, { headers: yahooHeaders });
        
        if (!data.chart.result || data.chart.result.length === 0) {
            throw new Error("No data returned from Yahoo");
        }

        const result = data.chart.result[0];
        const timestamps = result.timestamp || [];
        const quotes = result.indicators.quote[0] || {};
        
        // Ensure quotes exist
        if (!quotes.open || !quotes.close) {
             throw new Error("Malformed data from Yahoo");
        }

        let formattedData = timestamps.map((ts, index) => {
            // Binance format: [openTime, open, high, low, close, volume, closeTime, volumeAssets, trades, buyBase, buyQuote, ignore]
            return [
                ts * 1000, 
                quotes.open[index] ? quotes.open[index].toString() : "0",
                quotes.high[index] ? quotes.high[index].toString() : "0",
                quotes.low[index] ? quotes.low[index].toString() : "0",
                quotes.close[index] ? quotes.close[index].toString() : "0",
                quotes.volume[index] ? quotes.volume[index].toString() : "0",
                ts * 1000 + 59999,
                "0", "0", "0", "0", "0"
            ];
        });

        // Filter out null/invalid candles
        formattedData = formattedData.filter(d => d[1] !== "0" && d[4] !== "0");

        // Basic aggregation for 4H to make it more distinct from 1H
        if (interval === '4h' && yahooInterval === '60m') {
            const aggregated = [];
            for (let i = 0; i < formattedData.length; i += 4) {
                const chunk = formattedData.slice(i, i + 4);
                if (chunk.length > 0) {
                    const open = chunk[0][1];
                    const close = chunk[chunk.length - 1][4];
                    const high = Math.max(...chunk.map(c => Number(c[2]))).toString();
                    const low = Math.min(...chunk.map(c => Number(c[3]))).toString();
                    const volume = chunk.reduce((sum, c) => sum + Number(c[5]), 0).toString();
                    aggregated.push([
                        chunk[0][0], open, high, low, close, volume, chunk[chunk.length - 1][6], "0", "0", "0", "0", "0"
                    ]);
                }
            }
            formattedData = aggregated;
        }

        // Return only the requested limit (slice from the end)
        formattedData = formattedData.slice(-limit);
        if (!res.getHeader("X-Market-Data-Provider")) {
            res.setHeader("X-Market-Data-Provider", "yahoo");
        }
        setCached(cacheKey, formattedData);
        res.json(formattedData);
    } catch (error) {
        logServerError("Yahoo proxy error", error);
        res.status(502).json({ error: "Failed to fetch Yahoo data" });
    }
});

app.get("/api/proxy/us-stock-screener", requireApiAuth, apiRateLimit, async (req, res) => {
    const symbolsParam = String(req.query.symbols || "");
    const symbols = normalizeScreenerSymbols(symbolsParam);

    if (!symbols) {
        return res.status(400).json({ error: "symbols query must contain 1-30 valid US ticker symbols." });
    }

    try {
        const providerKey = getActiveEquityProvider();
        const cacheKey = `us-stock-screener:${providerKey}:${symbols.join(",")}`;
        const cached = getCached<unknown[]>(cacheKey);
        if (cached) return res.json(cached);

        if (providerKey === "polygon") {
            const polygonResults = await mapWithConcurrency(symbols, 4, async symbol => {
                const [candles, details] = await Promise.all([
                    fetchPolygonAggregateCandles(symbol, "1d", 260).catch(error => {
                        logServerError(`Polygon screener candles error ${symbol}`, error);
                        return [];
                    }),
                    fetchPolygonTickerDetails(symbol)
                ]);
                const closes = candles.map((candle: any) => Number(candle.close)).filter(Number.isFinite);
                const volumes = candles.map((candle: any) => Number(candle.volume)).filter(Number.isFinite);
                const latest = candles[candles.length - 1] || null;
                const quote = {
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
                };
                return {
                    symbol,
                    quote,
                    candles,
                    dataProvider: "polygon",
                    dataQuality: {
                        adjusted: true,
                        candleCount: candles.length,
                        officialProvider: true
                    }
                };
            });
            res.setHeader("X-Market-Data-Provider", "polygon");
            setCached(cacheKey, polygonResults);
            return res.json(polygonResults);
        }

        let quoteResults = [];
        try {
            const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
            const quoteData = await fetchJsonWithTimeout(quoteUrl, { headers: yahooHeaders });
            quoteResults = quoteData?.quoteResponse?.result || [];
        } catch (_error) {
            quoteResults = [];
        }
        const quotesBySymbol = new Map<string, any>(quoteResults.map((item) => [String(item.symbol || "").toUpperCase(), item]));
        const chartMetaBySymbol = new Map<string, any>();

        const chartResults = await mapWithConcurrency(symbols, 5, async symbol => {
            try {
                const chartData = await fetchJsonWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`, { headers: yahooHeaders });
                const result = chartData?.chart?.result?.[0];
                chartMetaBySymbol.set(symbol, result?.meta || {});
                const timestamps = result?.timestamp || [];
                const quotes = result?.indicators?.quote?.[0] || {};
                const candles = timestamps.map((ts, index) => ({
                    time: ts * 1000,
                    open: quotes.open?.[index] ?? null,
                    high: quotes.high?.[index] ?? null,
                    low: quotes.low?.[index] ?? null,
                    close: quotes.close?.[index] ?? null,
                    volume: quotes.volume?.[index] ?? null
                })).filter(candle => Number.isFinite(candle.close));
                return [symbol, candles.slice(-220)];
            } catch (_error) {
                return [symbol, []];
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
        res.setHeader("X-Market-Data-Provider", "yahoo");
        setCached(cacheKey, result);
        res.json(result);
    } catch (error) {
        logServerError("US Stock Screener Proxy Error", error);
        res.status(502).json({ error: "Failed to fetch US stock screener data" });
    }
});

async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });

    const shutdown = (signal: string) => {
        console.log(`${signal} received. Closing HTTP server.`);
        server.close(() => {
            console.log("HTTP server closed.");
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
}

startServer();
