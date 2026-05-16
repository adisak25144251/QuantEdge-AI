import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildKlineProxyUrl, classifyAssetType, normalizeMultiAssetSymbol } from './multiAssetMarketData';

describe('multiAssetMarketData', () => {
  it('builds proxy urls for crypto and US stocks without exposing provider details to the UI', () => {
    const crypto = buildKlineProxyUrl({ symbol: 'BTCUSDT', interval: '1h', limit: 100, type: 'CRYPTO' });
    const stock = buildKlineProxyUrl({ symbol: 'nvda', interval: '1d', limit: 250, type: 'US_STOCK' });

    assert.equal(crypto, '/api/proxy/klines?symbol=BTCUSDT&interval=1h&limit=100&type=CRYPTO');
    assert.equal(stock, '/api/proxy/klines?symbol=NVDA&interval=1d&limit=250&type=US_STOCK');
  });

  it('normalizes symbols and classifies US equity assets', () => {
    assert.equal(normalizeMultiAssetSymbol(' aapl '), 'AAPL');
    assert.equal(classifyAssetType('SPY'), 'ETF');
    assert.equal(classifyAssetType('MSFT'), 'US_STOCK');
    assert.equal(classifyAssetType('BTCUSDT'), 'CRYPTO');
  });
});
