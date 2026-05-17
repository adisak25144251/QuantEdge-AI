import { GoogleGenAI } from '@google/genai';

export type AiRole = 'user' | 'model';

export interface AiContentPart {
  text: string;
}

export interface AiContent {
  role: AiRole;
  parts: AiContentPart[];
}

export interface AiCopilotResult {
  status: number;
  body: {
    text?: string;
    error?: string;
  };
}

export type AiTextGenerator = (contents: AiContent[], apiKey: string) => Promise<string>;

const DEFAULT_AI_TIMEOUT_MS = 8_000;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function validateAiContents(contents: unknown): contents is AiContent[] {
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

export async function buildAiCopilotResponse(
  contents: unknown,
  apiKey = process.env.GEMINI_API_KEY,
  generateText: AiTextGenerator = generateGeminiText,
  onError?: (error: unknown) => void,
  timeoutMs = Number(process.env.AI_COPILOT_TIMEOUT_MS || DEFAULT_AI_TIMEOUT_MS)
): Promise<AiCopilotResult> {
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
    const text = await withTimeout(
      generateText(contents, apiKey),
      normalizeTimeoutMs(timeoutMs)
    );
    return {
      status: 200,
      body: { text: text || '' }
    };
  } catch (error) {
    onError?.(error);
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

async function generateGeminiText(contents: AiContent[], apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    contents,
    config: {
      maxOutputTokens: 700,
      temperature: 0.2,
      thinkingConfig: {
        thinkingBudget: 0
      }
    }
  });

  return response.text || '';
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
