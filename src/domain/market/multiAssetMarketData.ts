export type MultiAssetType = 'CRYPTO' | 'US_STOCK' | 'ETF' | 'INDEX' | 'COMMODITY' | 'FOREX' | 'UNKNOWN';

export interface KlineProxyRequest {
  symbol: string;
  interval: string;
  limit: number;
  type: MultiAssetType | 'STOCK';
}

const ETF_SYMBOLS = new Set(['SPY', 'QQQ', 'IWM', 'DIA', 'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLU', 'XLI', 'XLB', 'XLRE']);
const INDEX_SYMBOLS = new Set(['US500', 'US100', 'US30', 'DXY', 'UK100', 'JP225']);
const COMMODITY_SYMBOLS = new Set(['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL', 'WTI', 'BRENT']);

export function normalizeMultiAssetSymbol(symbol: string): string {
  return String(symbol ?? '').trim().toUpperCase().replace(/[^A-Z0-9.^=-]/g, '');
}

export function classifyAssetType(symbol: string): MultiAssetType {
  const normalized = normalizeMultiAssetSymbol(symbol);
  if (normalized.endsWith('USDT') || normalized.endsWith('USDC')) return 'CRYPTO';
  if (ETF_SYMBOLS.has(normalized)) return 'ETF';
  if (INDEX_SYMBOLS.has(normalized)) return 'INDEX';
  if (COMMODITY_SYMBOLS.has(normalized)) return 'COMMODITY';
  if (/^[A-Z]{1,5}$/.test(normalized)) return 'US_STOCK';
  if (/^[A-Z]{6}$/.test(normalized)) return 'FOREX';
  return 'UNKNOWN';
}

export function toProxyAssetType(type: KlineProxyRequest['type']): string {
  if (type === 'STOCK') return 'US_STOCK';
  return type;
}

export function buildKlineProxyUrl(input: KlineProxyRequest): string {
  const symbol = encodeURIComponent(normalizeMultiAssetSymbol(input.symbol));
  const interval = encodeURIComponent(input.interval);
  const limit = Math.max(1, Math.min(1000, Math.floor(input.limit)));
  const type = encodeURIComponent(toProxyAssetType(input.type));
  return `/api/proxy/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&type=${type}`;
}
