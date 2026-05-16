import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildTradingViewLegacyUrl } from './TradingViewWidget';

test('buildTradingViewLegacyUrl uses official TradingView fallback endpoint with exchange-qualified symbol', () => {
  const url = new URL(buildTradingViewLegacyUrl('oust', 'nasdaq', '1D', 'tv_frame_test'));

  assert.equal(url.origin, 'https://s.tradingview.com');
  assert.equal(url.pathname, '/widgetembed/');
  assert.equal(url.searchParams.get('symbol'), 'NASDAQ:OUST');
  assert.equal(url.searchParams.get('interval'), 'D');
  assert.equal(url.searchParams.get('theme'), 'dark');
  assert.equal(url.searchParams.get('locale'), 'th');
  assert.equal(url.searchParams.get('frameElementId'), 'tv_frame_test');
});

