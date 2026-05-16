import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calculator, DollarSign, Target, Activity, Zap, Percent, ShieldAlert, ArrowRight, ShieldCheck } from 'lucide-react';

export const PositionCalculator = ({ marketData, setupDetails }: { marketData?: any[], setupDetails?: any }) => {
  // Inputs
  const [accountBalance, setAccountBalance] = useState<number>(10000);
  const [leverage, setLeverage] = useState<number>(10);
  const [riskPercent, setRiskPercent] = useState<number>(1);
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [assetClass, setAssetClass] = useState<'CRYPTO' | 'FOREX' | 'STOCKS'>('CRYPTO');
  const [instrument, setInstrument] = useState<string>('BTCUSDT');
  
  const [entryPrice, setEntryPrice] = useState<number>(65000);
  const [stopLossPrice, setStopLossPrice] = useState<number>(64000);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number>(67000);

  // Sync with setup details from Visual Trade Setup Engine when available
  useEffect(() => {
    if (setupDetails && setupDetails.symbol) {
      setInstrument(setupDetails.symbol);
      setDirection(setupDetails.side === 'LONG' ? 'LONG' : 'SHORT');
      if (setupDetails.entry) setEntryPrice(setupDetails.entry);
      if (setupDetails.sl) setStopLossPrice(setupDetails.sl);
      if (setupDetails.tp) setTakeProfitPrice(setupDetails.tp);
    }
  }, [setupDetails]);

  // Computed results
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    // Auto-calculate logic
    const calc = () => {
      if (!accountBalance || !entryPrice || !stopLossPrice) return null;

      const riskAmount = (accountBalance * riskPercent) / 100;
      
      const slDist = Math.abs(entryPrice - stopLossPrice);
      const slPercent = (slDist / entryPrice) * 100;
      
      let positionSizeUnits = 0;
      if (slDist > 0) {
        positionSizeUnits = riskAmount / slDist;
      }

      let formattedPositionSize = positionSizeUnits.toLocaleString(undefined, { maximumFractionDigits: 6 });
      let positionUnitLabel = 'Units';

      if (assetClass === 'FOREX') {
          // Standard Lot = 100,000 units
          const lots = positionSizeUnits / 100000;
          formattedPositionSize = lots.toLocaleString(undefined, { maximumFractionDigits: 2 });
          positionUnitLabel = 'Standard Lots';
      } else if (assetClass === 'STOCKS') {
          formattedPositionSize = Math.floor(positionSizeUnits).toLocaleString();
          positionUnitLabel = 'Shares';
      } else {
          positionUnitLabel = 'Tokens / Contracts';
      }
      
      const positionSizeUSD = positionSizeUnits * entryPrice; // Notional Value
      const marginUsed = positionSizeUSD / leverage;

      const tpDist = Math.abs(takeProfitPrice - entryPrice);
      const tpPercent = (tpDist / entryPrice) * 100;
      const tpAmount = positionSizeUnits * tpDist;

      const rr = tpDist > 0 && slDist > 0 ? tpDist / slDist : 0;

      let comment = '';
      let isValidDirection = true;
      if (direction === 'LONG' && stopLossPrice >= entryPrice) {
          comment = '⚠ Invalid Stop Loss for LONG position. SL must be below entry price.';
          isValidDirection = false;
      } else if (direction === 'SHORT' && stopLossPrice <= entryPrice) {
          comment = '⚠ Invalid Stop Loss for SHORT position. SL must be above entry price.';
          isValidDirection = false;
      } else if (direction === 'LONG' && takeProfitPrice <= entryPrice) {
          comment = '⚠ Invalid Take Profit for LONG position. TP must be above entry price.';
          isValidDirection = false;
      } else if (direction === 'SHORT' && takeProfitPrice >= entryPrice) {
          comment = '⚠ Invalid Take Profit for SHORT position. TP must be below entry price.';
          isValidDirection = false;
      }

      if (isValidDirection) {
          if (rr >= 3) {
            comment = 'Excellent risk to reward on this position. High probability of long-term profitability if win rate is moderate.';
          } else if (rr >= 2) {
            comment = 'Good risk to reward. Standard professional target.';
          } else if (rr >= 1) {
            comment = 'Marginal risk to reward. Requires a high win rate to be profitable.';
          } else {
            comment = 'Poor risk to reward. Not recommended. Potential losses outweigh potential gains.';
          }
      }

      if (marginUsed > accountBalance) {
        comment += ' \nWARNING: Insufficient margin. Leverage too low or position size too large for current account balance.';
      }

      return {
        riskAmount,
        slPercent,
        tpPercent,
        tpAmount,
        positionSizeUnits,
        formattedPositionSize,
        positionUnitLabel,
        positionSizeUSD,
        marginUsed,
        rr,
        comment,
        isValidDirection
      };
    };

    setResults(calc());
  }, [accountBalance, riskPercent, leverage, entryPrice, stopLossPrice, takeProfitPrice]);

  return (
    <div className="space-y-6">
      <div className="bg-[#0B0F19] rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column - Inputs */}
              <div className="lg:col-span-5 space-y-6">
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                      <Calculator className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-lg font-bold text-white">Position Size Settings</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                              <DollarSign className="w-3 h-3 text-emerald-400" /> Account Balance
                          </label>
                          <input 
                              type="number" 
                              value={accountBalance} 
                              onChange={e => setAccountBalance(Number(e.target.value))} 
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 font-mono"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-400" /> Leverage
                          </label>
                          <div className="relative">
                              <input 
                                  type="number" 
                                  value={leverage} 
                                  onChange={e => setLeverage(Number(e.target.value))} 
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 font-mono pr-8"
                              />
                              <span className="absolute right-3 top-2.5 text-slate-500 font-bold">x</span>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex flex-col gap-1">
                              <span>Risk Percent (%)</span>
                              <span className="text-[10px] text-slate-500 normal-case">Professional: 1-2%</span>
                          </label>
                          <div className="relative">
                              <input 
                                  type="number" 
                                  step="0.1"
                                  value={riskPercent} 
                                  onChange={e => setRiskPercent(Number(e.target.value))} 
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 font-mono"
                              />
                              <span className="absolute right-3 top-2.5 text-slate-500 font-bold">%</span>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                              Risk Amount
                          </label>
                          <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-rose-400 font-mono font-bold">
                              ${results ? results.riskAmount.toFixed(2) : '0.00'}
                          </div>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Asset Class</label>
                          <select 
                              value={assetClass} 
                              onChange={e => setAssetClass(e.target.value as any)} 
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                          >
                              <option value="CRYPTO">Crypto</option>
                              <option value="FOREX">Forex</option>
                              <option value="STOCKS">Stocks</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Instrument</label>
                          {assetClass === 'CRYPTO' ? (
                              <select 
                                  value={instrument} 
                                  onChange={e => setInstrument(e.target.value)} 
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 font-mono tracking-wider cursor-pointer"
                              >
                                  {marketData && marketData.length > 0 ? (
                                      marketData.map((m: any, index: number) => (
                                          <option key={m.symbol} value={m.symbol}>{index + 1}. {m.symbol}</option>
                                      ))
                                  ) : (
                                      <>
                                          <option value="BTCUSDT">1. BTCUSDT</option>
                                          <option value="ETHUSDT">2. ETHUSDT</option>
                                          <option value="SOLUSDT">3. SOLUSDT</option>
                                      </>
                                  )}
                              </select>
                          ) : (
                              <input 
                                  type="text" 
                                  value={instrument} 
                                  onChange={e => setInstrument(e.target.value.toUpperCase())} 
                                  placeholder={assetClass === 'FOREX' ? 'EURUSD' : 'AAPL'}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 uppercase font-mono tracking-wider"
                              />
                          )}
                      </div>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Direction</label>
                      <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                          <button 
                              onClick={() => setDirection('LONG')}
                              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                              LONG (Buy)
                          </button>
                          <button 
                              onClick={() => setDirection('SHORT')}
                              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${direction === 'SHORT' ? 'bg-rose-500/20 text-rose-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                              SHORT (Sell)
                          </button>
                      </div>
                  </div>

                  <div className="space-y-4 bg-slate-800/10 p-4 rounded-xl border border-slate-700/50">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Entry Price</label>
                          <input 
                              type="number" 
                              value={entryPrice} 
                              onChange={e => setEntryPrice(Number(e.target.value))} 
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 font-mono"
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-rose-400 uppercase tracking-widest mb-2">Stop Loss Price</label>
                              <input 
                                  type="number" 
                                  value={stopLossPrice} 
                                  onChange={e => setStopLossPrice(Number(e.target.value))} 
                                  className="w-full bg-rose-950/30 border border-rose-900/50 rounded-lg p-2.5 text-rose-300 focus:outline-none focus:border-rose-500 font-mono"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Take Profit Price</label>
                              <input 
                                  type="number" 
                                  value={takeProfitPrice} 
                                  onChange={e => setTakeProfitPrice(Number(e.target.value))} 
                                  className="w-full bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-2.5 text-emerald-300 focus:outline-none focus:border-emerald-500 font-mono"
                              />
                          </div>
                      </div>
                  </div>

              </div>

              {/* Right Column - Results */}
              <div className="lg:col-span-7 bg-slate-900 p-6 rounded-xl border border-slate-700">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                      <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-fuchsia-400" />
                          <h3 className="text-lg font-bold text-white uppercase tracking-widest">Execution Plan</h3>
                      </div>
                      <div className="px-3 py-1 bg-slate-800 rounded-full text-xs font-bold text-slate-300 border border-slate-700">
                          {assetClass} / {instrument}
                      </div>
                  </div>

                  {results ? (
                      <div className="space-y-6">
                          
                          {/* Core Position Metrics */}
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Direction</div>
                                  <div className={`text-xl font-black ${direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {direction}
                                  </div>
                              </div>
                              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Position Size</div>
                                  <div className="text-xl font-bold text-white font-mono break-words">
                                      {results.formattedPositionSize}
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-1">{results.positionUnitLabel}</div>
                              </div>
                              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Entry Price</div>
                                  <div className="text-xl font-bold text-white font-mono">
                                      {entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-1">USD</div>
                              </div>
                          </div>

                          <div className="h-px w-full bg-slate-800" />

                          {/* Risk & Reward Analysis */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                  <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                      <ShieldAlert className="w-4 h-4 text-rose-400" /> Stop Loss Details
                                  </h4>
                                  <div className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                          <span className="text-slate-400">Price:</span>
                                          <span className="font-mono text-white font-bold">{stopLossPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                          <span className="text-slate-400">Amount at Risk:</span>
                                          <span className="font-mono text-rose-400 font-bold">-${results.riskAmount.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-sm pb-2 border-b border-slate-700">
                                          <span className="text-slate-400">Distance Percent:</span>
                                          <span className="font-mono text-rose-400/80">{results.slPercent.toFixed(2)}%</span>
                                      </div>
                                      <div className="flex justify-between text-sm pt-1">
                                          <span className="text-slate-400">Margin Used:</span>
                                          <span className="font-mono text-slate-300">${results.marginUsed.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                          <span className="text-slate-400">Leverage Used:</span>
                                          <span className="font-mono text-amber-400 font-bold">{leverage}x</span>
                                      </div>
                                  </div>
                              </div>

                              <div className="space-y-4">
                                  <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                      <Target className="w-4 h-4 text-emerald-400" /> Take Profit Details
                                  </h4>
                                  <div className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                          <span className="text-slate-400">Price:</span>
                                          <span className="font-mono text-white font-bold">{takeProfitPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                          <span className="text-slate-400">Target Amount:</span>
                                          <span className="font-mono text-emerald-400 font-bold">+${results.tpAmount.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-sm pb-2 border-b border-slate-700">
                                          <span className="text-slate-400">Distance Percent:</span>
                                          <span className="font-mono text-emerald-400/80">{results.tpPercent.toFixed(2)}%</span>
                                      </div>
                                      <div className="flex justify-between text-sm pt-1">
                                          <span className="text-slate-400">Notional Value:</span>
                                          <span className="font-mono text-slate-300">${results.positionSizeUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                          <span className="text-slate-400">Risk/Reward Ratio:</span>
                                          <span className={`font-mono font-bold ${results.rr >= 2 ? 'text-amber-400' : 'text-slate-300'}`}>1 : {results.rr.toFixed(2)}</span>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* Professional Comment */}
                          <div className={`p-4 rounded-xl border ${!results.isValidDirection ? 'bg-rose-900/10 border-rose-500/30' : results.rr >= 2 ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700'}`}>
                              <h4 className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 ${!results.isValidDirection ? 'text-rose-400' : 'text-slate-400'}`}>
                                  <ShieldCheck className={`w-4 h-4 ${!results.isValidDirection ? 'text-rose-400' : results.rr >= 2 ? 'text-emerald-400' : 'text-slate-400'}`} />
                                  Professional Analysis & Comments
                              </h4>
                              <p className={`text-sm whitespace-pre-line ${!results.isValidDirection ? 'text-rose-300' : results.rr >= 2 ? 'text-emerald-300' : 'text-slate-400'}`}>
                                  {results.comment}
                              </p>
                              {results.marginUsed > accountBalance && (
                                  <p className="text-sm text-amber-400 mt-2 font-bold animate-pulse">
                                      Warning: Required margin (${results.marginUsed.toFixed(2)}) exceeds account balance. Please increase leverage or reduce risk %.
                                  </p>
                              )}
                          </div>

                      </div>
                  ) : (
                      <div className="h-48 flex items-center justify-center text-slate-500 italic text-sm">
                          Enter entry and stop loss prices to calculate position size.
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};
