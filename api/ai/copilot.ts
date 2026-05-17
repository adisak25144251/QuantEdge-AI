import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

type ApiRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
};

type AuthenticatedUser = {
  uid: string;
  email?: string;
  emailVerified?: boolean;
};

type AiContent = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tutor-intelligence';
const REQUEST_BODY_LIMIT_BYTES = 1_000_000;
const AI_RATE_LIMIT_PER_MINUTE = 30;
const DEFAULT_AI_TIMEOUT_MS = 8_000;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const rateLimitBuckets = new Map<string, { windowStart: number; count: number }>();
let firebaseCertCache: { expiresAt: number; certs: Record<string, string> } | null = null;

export default async function handler(req: ApiRequest, res: ServerResponse) {
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const auth = await authenticateRequest(req);
  if (auth.ok === false) {
    sendJson(res, auth.status, { error: auth.error });
    return;
  }

  const rateLimit = checkRateLimit(auth.user.uid || getClientKey(req));
  if (!rateLimit.ok) {
    sendJson(res, 429, { error: 'AI request rate limit exceeded.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const result = await buildAiCopilotResponse((body as any)?.contents);
    sendJson(res, result.status, result.body);
  } catch (error) {
    console.error('AI copilot route error', getErrorMessage(error));
    sendJson(res, 400, { error: 'Invalid JSON request body.' });
  }
}

async function buildAiCopilotResponse(contents: unknown): Promise<{
  status: number;
  body: { text?: string; error?: string };
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      status: 503,
      body: { error: 'AI backend is not configured. Set GEMINI_API_KEY on the server.' }
    };
  }

  if (!validateAiContents(contents)) {
    return {
      status: 400,
      body: { error: 'Invalid AI request payload.' }
    };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await withTimeout(
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
        contents,
        config: {
          maxOutputTokens: 700,
          temperature: 0.2,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      }),
      normalizeTimeoutMs(Number(process.env.AI_COPILOT_TIMEOUT_MS || DEFAULT_AI_TIMEOUT_MS))
    );

    return {
      status: 200,
      body: { text: response.text || '' }
    };
  } catch (error) {
    console.error('Gemini backend error', getErrorMessage(error));
    if (error instanceof AiCopilotTimeoutError) {
      return {
        status: 504,
        body: { error: 'AI backend timed out. Please retry with a shorter prompt.' }
      };
    }

    return {
      status: 502,
      body: { error: 'AI backend request failed.' }
    };
  }
}

function validateAiContents(contents: unknown): contents is AiContent[] {
  if (!Array.isArray(contents) || contents.length === 0 || contents.length > 30) return false;

  let totalTextLength = 0;
  return contents.every((item: any) => {
    if (!item || !['user', 'model'].includes(item.role) || !Array.isArray(item.parts) || item.parts.length === 0 || item.parts.length > 8) {
      return false;
    }

    return item.parts.every((part: any) => {
      if (!part || typeof part.text !== 'string' || part.text.length === 0 || part.text.length > 12_000) return false;
      totalTextLength += part.text.length;
      return totalTextLength <= 60_000;
    });
  });
}

function setSecurityHeaders(res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>) {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const current = rateLimitBuckets.get(key);

  if (!current || now - current.windowStart >= 60_000) {
    rateLimitBuckets.set(key, { windowStart: now, count: 1 });
    return { ok: true };
  }

  current.count += 1;
  return { ok: current.count <= AI_RATE_LIMIT_PER_MINUTE };
}

async function authenticateRequest(req: ApiRequest): Promise<
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; status: number; error: string }
> {
  const configuredToken = process.env.API_GATEWAY_TOKEN;
  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (configuredToken && bearer === configuredToken) {
    return { ok: true, user: { uid: 'service-token' } };
  }

  if (!bearer) {
    return { ok: false, status: 401, error: 'Authentication required.' };
  }

  try {
    const user = await verifyFirebaseIdToken(bearer);
    return { ok: true, user };
  } catch (error) {
    console.error('API auth failed', getErrorMessage(error));
    return { ok: false, status: 401, error: 'Invalid authentication token.' };
  }
}

async function readJsonBody(req: ApiRequest): Promise<unknown> {
  if (req.body !== undefined) return req.body;

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > REQUEST_BODY_LIMIT_BYTES) throw new Error('Request body too large.');
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function verifyFirebaseIdToken(token: string): Promise<AuthenticatedUser> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token.');

  const header = parseJwtPart(parts[0]);
  const payload = parseJwtPart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('Unsupported token algorithm.');
  }

  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Unknown Firebase certificate.');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();

  const valid = verifier.verify(cert, base64UrlToBuffer(parts[2]));
  if (!valid) throw new Error('Invalid token signature.');

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) throw new Error('Invalid token audience.');
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) throw new Error('Invalid token issuer.');
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) throw new Error('Invalid token subject.');
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new Error('Expired token.');
  if (typeof payload.iat !== 'number' || payload.iat > now + 300) throw new Error('Invalid token issued time.');

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: Boolean(payload.email_verified)
  };
}

async function getFirebaseCerts(): Promise<Record<string, string>> {
  if (firebaseCertCache && firebaseCertCache.expiresAt > Date.now()) return firebaseCertCache.certs;

  const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw new Error('Unable to load Firebase auth certificates.');

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
  const certs = await response.json() as Record<string, string>;
  firebaseCertCache = { certs, expiresAt: Date.now() + Math.max(60, maxAge - 60) * 1000 };
  return certs;
}

function parseJwtPart(part: string): any {
  return JSON.parse(base64UrlToBuffer(part).toString('utf8'));
}

function base64UrlToBuffer(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=');
  return Buffer.from(padded, 'base64');
}

function getClientKey(req: ApiRequest): string {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwardedFor || req.socket.remoteAddress || 'unknown';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class AiCopilotTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`AI copilot provider timeout after ${timeoutMs}ms.`);
    this.name = 'AiCopilotTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new AiCopilotTimeoutError(timeoutMs)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function normalizeTimeoutMs(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs)) return DEFAULT_AI_TIMEOUT_MS;
  return Math.min(Math.max(timeoutMs, 2_000), 12_000);
}
