import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

type ChartStatus = 'loading' | 'ready' | 'blocked';
type TradingViewEndpoint = 'advanced' | 'legacy';

const TRADINGVIEW_LOAD_TIMEOUT_MS = 10_000;

const normalizeTradingViewSymbol = (exchange: string, symbol: string) => {
  const normalizedExchange = exchange.trim().toUpperCase();
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedExchange || !normalizedSymbol) return normalizedSymbol;
  return `${normalizedExchange}:${normalizedSymbol}`;
};

const normalizeTradingViewInterval = (interval: string) => {
  const value = String(interval || '').trim().toUpperCase();
  if (value === '1D') return 'D';
  if (value === '1W') return 'W';
  if (value === '1M') return 'M';
  return value || 'D';
};

const buildTradingViewAdvancedUrl = (symbol: string, exchange: string, interval: string) => {
  const config = {
    autosize: true,
    symbol: normalizeTradingViewSymbol(exchange, symbol),
    interval: normalizeTradingViewInterval(interval),
    timezone: 'Asia/Bangkok',
    theme: 'dark',
    style: '1',
    locale: 'th',
    enable_publishing: false,
    allow_symbol_change: true,
    withdateranges: true,
    hide_side_toolbar: false,
    details: true,
    calendar: true,
    studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies', 'CCI@tv-basicstudies']
  };

  return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=th#${encodeURIComponent(JSON.stringify(config))}`;
};

export const buildTradingViewLegacyUrl = (symbol: string, exchange: string, interval: string, frameElementId: string) => {
  const params = new URLSearchParams({
    frameElementId,
    symbol: normalizeTradingViewSymbol(exchange, symbol),
    interval: normalizeTradingViewInterval(interval),
    hidesidetoolbar: '0',
    symboledit: '1',
    saveimage: '1',
    toolbarbg: '0F172A',
    studies: 'RSI@tv-basicstudies\u001fMACD@tv-basicstudies\u001fCCI@tv-basicstudies',
    theme: 'dark',
    style: '1',
    timezone: 'Asia/Bangkok',
    withdateranges: '1',
    hideideas: '1',
    locale: 'th'
  });

  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
};

const buildTradingViewChartUrl = (symbol: string, exchange: string) => (
  `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(normalizeTradingViewSymbol(exchange, symbol))}`
);

export const TradingViewWidget = memo(({
  symbol,
  exchange,
  interval
}: {
  symbol: string;
  exchange: string;
  interval: string;
}) => {
  const iframeId = useRef(`tv_iframe_${Math.random().toString(36).slice(2)}`);
  const [status, setStatus] = useState<ChartStatus>('loading');
  const [endpoint, setEndpoint] = useState<TradingViewEndpoint>('advanced');
  const [retryNonce, setRetryNonce] = useState(0);
  const tvSymbol = useMemo(() => normalizeTradingViewSymbol(exchange, symbol), [exchange, symbol]);
  const advancedUrl = useMemo(
    () => buildTradingViewAdvancedUrl(symbol, exchange, interval),
    [symbol, exchange, interval]
  );
  const legacyUrl = useMemo(
    () => buildTradingViewLegacyUrl(symbol, exchange, interval, iframeId.current),
    [symbol, exchange, interval]
  );
  const iframeUrl = endpoint === 'advanced' ? advancedUrl : legacyUrl;
  const externalChartUrl = useMemo(
    () => buildTradingViewChartUrl(symbol, exchange),
    [symbol, exchange]
  );

  useEffect(() => {
    setStatus('loading');
    setEndpoint('advanced');
  }, [advancedUrl]);

  useEffect(() => {
    setStatus('loading');

    const timeoutId = window.setTimeout(() => {
      setStatus(current => {
        if (current !== 'loading') return current;
        if (endpoint === 'advanced') {
          setEndpoint('legacy');
          return 'loading';
        }
        return 'blocked';
      });
    }, TRADINGVIEW_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [iframeUrl, endpoint, retryNonce]);

  const handleIframeLoad = () => {
    setStatus('ready');
  };

  const handleIframeError = () => {
    if (endpoint === 'advanced') {
      setEndpoint('legacy');
      setStatus('loading');
      return;
    }
    setStatus('blocked');
  };

  const handleRetry = () => {
    setEndpoint('advanced');
    setRetryNonce(value => value + 1);
    setStatus('loading');
  };

  return (
    <div className="tradingview-widget-container relative h-full min-h-[400px] w-full bg-[#070014]">
      <iframe
        key={`${iframeUrl}-${retryNonce}`}
        id={iframeId.current}
        title={`TradingView chart ${tvSymbol}`}
        src={iframeUrl}
        className="absolute inset-0 h-full min-h-[400px] w-full border-0"
        allow="clipboard-write; fullscreen; display-capture"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />

      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#070014] text-slate-300">
          <div className="px-6 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-400" />
            <div className="text-sm font-bold text-cyan-200">กำลังโหลดกราฟจริงจาก TradingView</div>
            <div className="mt-2 text-xs text-slate-500">{tvSymbol}</div>
            {endpoint === 'legacy' && (
              <div className="mt-2 text-xs text-amber-300">กำลังลองเส้นทางสำรองของ TradingView</div>
            )}
          </div>
        </div>
      )}

      {status === 'blocked' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#070014] text-slate-300">
          <div className="max-w-md rounded-lg border border-rose-500/40 bg-rose-950/20 p-5 text-center">
            <div className="text-sm font-bold text-rose-300">TradingView ไม่สามารถโหลดในหน้านี้ได้</div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              ระบบไม่ใช้ local chart แทนตามการตั้งค่าปัจจุบัน โปรดอนุญาตโดเมน www.tradingview-widget.com,
              s.tradingview.com, s3.tradingview.com และ www.tradingview.com หรือปิด Adblock/Shield/VPN
              ที่บล็อก TradingView แล้วลองใหม่
            </p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20"
              >
                ลองโหลดอีกครั้ง
              </button>
              <a
                href={externalChartUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-500/20"
              >
                เปิดใน TradingView
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
