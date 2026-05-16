import React from 'react';
import { motion } from 'motion/react';
import { useMarketStore } from '../store/useMarketStore';

export const RealtimeTicker = React.memo(() => {
  const marketData = useMarketStore(state => state.marketData);

  if (marketData.length === 0) return (
    <div className="w-full bg-[#050014] border-b border-cyan-500/20 h-10 flex items-center justify-center text-xs text-cyan-500/50 font-mono">
      Loading live market data...
    </div>
  );

  return (
    <div className="w-full bg-[#050014] border-b border-cyan-500/20 overflow-hidden flex items-center h-10 relative z-50">
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#050014] to-transparent z-10 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#050014] to-transparent z-10 pointer-events-none"></div>
      
      <motion.div 
        className="flex whitespace-nowrap items-center gap-8 px-4"
        animate={{ x: [0, -1000] }}
        transition={{ 
          repeat: Infinity, 
          ease: "linear", 
          duration: 30 
        }}
      >
        {/* Duplicate items for seamless loop */}
        {[...marketData, ...marketData, ...marketData, ...marketData].map((ticker, idx) => {
          const isPositive = parseFloat(ticker.priceChangePercent) >= 0;
          const formattedPrice = parseFloat(ticker.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
          const formattedChange = parseFloat(ticker.priceChangePercent).toFixed(2);
          
          return (
            <div key={`${ticker.symbol}-${idx}`} className="flex items-center gap-2 text-sm font-mono">
              <span className="text-cyan-400 font-bold">{ticker.symbol.replace('USDT', '')}</span>
              <span className="text-white">${formattedPrice}</span>
              <span className={isPositive ? 'text-lime-400' : 'text-rose-400'}>
                {isPositive ? '+' : ''}{formattedChange}%
              </span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
});
