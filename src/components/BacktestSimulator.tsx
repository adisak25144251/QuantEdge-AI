import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Play, Database, Activity, Target, Settings, TrendingDown, TrendingUp, AlertTriangle, Clock, ShieldAlert, Zap, Layers, BarChart, Calculator } from 'lucide-react';
import { RSI, MACD, EMA, SMA, BollingerBands, Stochastic, CCI, ADX, WilliamsR } from 'technicalindicators';
import { PositionCalculator } from './PositionCalculator';
import { IncrementalEdgeEvidencePanel } from './IncrementalEdgeEvidencePanel';
import { ForwardCandidateEvidencePanel } from './ForwardCandidateEvidencePanel';
import {
  analyzeRegimePerformance,
  buildWalkForwardWindows,
  classifyMarketRegime,
  evaluateWalkForwardStability,
  summarizeBacktestEvidence,
  type BacktestEvidenceSummary
} from '../domain/backtest/backtestEvidence';

const pad = (arr: any[], len: number) => Array(len - arr.length).fill(null).concat(arr);

export const BacktestSimulator = ({
  marketData,
  fetchHistoricalData,
  setupDetails,
  onEvidence
}: {
  marketData: any[],
  fetchHistoricalData: (symbol: string, interval: string, limit: number) => Promise<any[]>,
  setupDetails?: any,
  onEvidence?: (evidence: BacktestEvidenceSummary) => void
}) => {
  const [activeTab, setActiveTab] = useState<'SIMULATOR' | 'CALCULATOR'>('SIMULATOR');

  // --- Config State ---
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [strategy, setStrategy] = useState('SMC_ADVANCED');
  const [timeframe, setTimeframe] = useState('1h');
  const [limit, setLimit] = useState(1000); // More data for better stats
  
  // --- Advanced Risk & Execution Config ---
  const [riskPerTrade, setRiskPerTrade] = useState(2); // % of total account to risk per trade (Professional sizing)
  const [slPercent, setSlPercent] = useState(2.0); // Distance to SL
  const [tpPercent, setTpPercent] = useState(4.0); // Full TP objective
  
  const [useTrailing, setUseTrailing] = useState(true);
  const [trailPercent, setTrailPercent] = useState(1.5); // Trailing offset
  
  const [slippage, setSlippage] = useState(0.05); // Simulated slippage % (Market orders)
  const [makerFee, setMakerFee] = useState(0.02); // Limit order fee %
  const [takerFee, setTakerFee] = useState(0.05); // Market order fee %

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runBacktest = async () => {
    setIsRunning(true);
    try {
      const data = await fetchHistoricalData(symbol, timeframe, limit);
      if (!data || data.length === 0) {
        setIsRunning(false);
        alert('โหลดข้อมูลสถิติย้อนหลังล้มเหลว หรือไม่มีข้อมูล');
        return;
      }

      // 1. Data Prep
      const closes = data.map(d => parseFloat(d[4]));
      const highs = data.map(d => parseFloat(d[2]));
      const lows = data.map(d => parseFloat(d[3]));
      const opens = data.map(d => parseFloat(d[1]));
      const times = data.map(d => {
        const dt = new Date(d[0]);
        return dt.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }) + ' ' + dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit'});
      });

      // 2. Indicators Calculation
      let indicators: any = {};
      indicators.rsi = pad(RSI.calculate({ values: closes, period: 14 }), closes.length);
      indicators.macd = pad(MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false }), closes.length);
      indicators.ema20 = pad(EMA.calculate({ values: closes, period: 20 }), closes.length);
      indicators.ema50 = pad(EMA.calculate({ values: closes, period: 50 }), closes.length);
      indicators.ema200 = pad(EMA.calculate({ values: closes, period: 200 }), closes.length);
      indicators.sma50 = pad(SMA.calculate({ values: closes, period: 50 }), closes.length);
      indicators.sma200 = pad(SMA.calculate({ values: closes, period: 200 }), closes.length);
      indicators.bb = pad(BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 }), closes.length);
      indicators.stoch = pad(Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 }), closes.length);
      indicators.cci = pad(CCI.calculate({ high: highs, low: lows, close: closes, period: 20 }), closes.length);
      indicators.adx = pad(ADX.calculate({ high: highs, low: lows, close: closes, period: 14 }), closes.length);
      indicators.willR = pad(WilliamsR.calculate({ high: highs, low: lows, close: closes, period: 14 }), closes.length);
      const atrPercent = highs.map((high, index) => {
        const close = closes[index] || 1;
        return ((high - lows[index]) / close) * 100;
      });

      // 3. Professional Simulation Core
      let trades = [];
      let balance = 10000;
      const initialBalance = balance;
      const balanceHistory = [{ id: 0, balance, time: times[0] }];
      let currentPosition: any = null;
      let peakBalance = balance;
      let maxDrawdown = 0;

      const slRatio = slPercent / 100;
      const tpRatio = tpPercent / 100;

      for (let i = 50; i < closes.length; i++) {
        const currentClose = closes[i];
        const currentHigh = highs[i];
        const currentLow = lows[i];
        const currentOpen = opens[i];
        const currentTime = times[i];

        // --- Position Management (Intra-candle Routing) ---
        if (currentPosition) {
            // Predict internal tick path to avoid "Intra-candle Illusion"
            const isBull = currentClose >= currentOpen;
            const path = isBull
                 ? [currentOpen, currentLow, currentHigh, currentClose] // Bulls drop first, then push high
                 : [currentOpen, currentHigh, currentLow, currentClose]; // Bears push high first, then drop

            let exited = false;
            let exitPrice = 0;
            let endReason = '';

            for (const price of path) {
                if (currentPosition.side === 'LONG') {
                     // Update Trailing High Watermark
                     if (price > currentPosition.highWatermark) currentPosition.highWatermark = price;

                     const slPrice = currentPosition.entry * (1 - slRatio);
                     const tpPrice = currentPosition.entry * (1 + tpRatio);
                     const trailPrice = currentPosition.highWatermark * (1 - (trailPercent/100));

                     if (price <= slPrice) {
                         exited = true;
                         exitPrice = slPrice * (1 - (slippage/100)); // Hit SL with downward slippage (Market)
                         endReason = 'Stop Loss';
                         break;
                     } else if (price >= tpPrice) {
                         exited = true;
                         exitPrice = tpPrice; // Limit Order hit, no slippage
                         endReason = 'Take Profit';
                         break;
                     } else if (useTrailing && price <= trailPrice) {
                         exited = true;
                         exitPrice = trailPrice * (1 - (slippage/100)); // Trailing SL hit (Market)
                         endReason = 'Trailing Stop';
                         break;
                     }
                } else {
                     // SHORT logic
                     if (price < currentPosition.lowWatermark) currentPosition.lowWatermark = price;

                     const slPrice = currentPosition.entry * (1 + slRatio);
                     const tpPrice = currentPosition.entry * (1 - tpRatio);
                     const trailPrice = currentPosition.lowWatermark * (1 + (trailPercent/100));

                     if (price >= slPrice) {
                         exited = true;
                         exitPrice = slPrice * (1 + (slippage/100)); // Hit SL with upward slippage (Market)
                         endReason = 'Stop Loss';
                         break;
                     } else if (price <= tpPrice) {
                         exited = true;
                         exitPrice = tpPrice; // Limit Order
                         endReason = 'Take Profit';
                         break;
                     } else if (useTrailing && price >= trailPrice) {
                         exited = true;
                         exitPrice = trailPrice * (1 + (slippage/100)); // Trailing SL hit (Market)
                         endReason = 'Trailing Stop';
                         break;
                     }
                }
            }

            if (exited) {
                 const posSizeUSD = currentPosition.posSizeUSD;
                 const priceDiffMultiplier = currentPosition.side === 'LONG'
                    ? (exitPrice - currentPosition.entry) / currentPosition.entry
                    : (currentPosition.entry - exitPrice) / currentPosition.entry;

                 // Calculate Exact Fees (Maker vs Taker)
                 const exitFeeRate = (endReason === 'Take Profit') ? (makerFee/100) : (takerFee/100);
                 const entryFeeRate = (takerFee/100);

                 const grossPnL = posSizeUSD * priceDiffMultiplier;
                 const feeCost = (posSizeUSD * entryFeeRate) + (posSizeUSD * (exitPrice/currentPosition.entry) * exitFeeRate);

                 const netPnL = grossPnL - feeCost;
                 balance += netPnL;

                 if (balance > peakBalance) peakBalance = balance;
                 const drawdown = (peakBalance - balance) / peakBalance * 100;
                 if (drawdown > maxDrawdown) maxDrawdown = drawdown;

                 trades.push({
                      id: trades.length + 1,
                      side: currentPosition.side,
                      entryTime: currentPosition.entryTime,
                      exitTime: currentTime,
                      entry: currentPosition.entry,
                      exit: exitPrice,
                      pnl: netPnL,
                      rMultiple: currentPosition.riskAmount > 0 ? netPnL / currentPosition.riskAmount : 0,
                      balanceAfter: balance,
                      entryIndex: currentPosition.entryIndex,
                      regime: currentPosition.regime,
                      endReason,
                      won: netPnL > 0
                  });

                  balanceHistory.push({ id: trades.length, balance, time: currentTime });
                  currentPosition = null;
            }
        }

        // --- Signal Generation ---
        if (!currentPosition) {
            let signal = null;
            
            // Evaluated at [i-1] logic to simulate real-time edge without looking into the future
            if (strategy === 'RSI') {
                const r2 = indicators.rsi[i-2], r1 = indicators.rsi[i-1];
                if (r2 !== null && r1 !== null) {
                    if (r2 < 30 && r1 >= 30) signal = 'LONG';
                    else if (r2 > 70 && r1 <= 70) signal = 'SHORT';
                }
            } else if (strategy === 'MACD') {
                const m2 = indicators.macd[i-2], m1 = indicators.macd[i-1];
                if (m2 && m1 && m2.MACD !== null && m1.MACD !== null) {
                    if (m2.MACD < m2.signal && m1.MACD >= m1.signal && m1.MACD < 0) signal = 'LONG';
                    else if (m2.MACD > m2.signal && m1.MACD <= m1.signal && m1.MACD > 0) signal = 'SHORT';
                }
            } else if (strategy === 'EMA_CROSS') {
                const e20m1 = indicators.ema20[i-1], e50m1 = indicators.ema50[i-1];
                const e20m2 = indicators.ema20[i-2], e50m2 = indicators.ema50[i-2];
                if (e20m2 < e50m2 && e20m1 >= e50m1) signal = 'LONG';
                else if (e20m2 > e50m2 && e20m1 <= e50m1) signal = 'SHORT';
            } else if (strategy === 'GOLDEN_CROSS') {
                const s50m1 = indicators.sma50[i-1], s200m1 = indicators.sma200[i-1];
                const s50m2 = indicators.sma50[i-2], s200m2 = indicators.sma200[i-2];
                if (s50m2 < s200m2 && s50m1 >= s200m1) signal = 'LONG';
                else if (s50m2 > s200m2 && s50m1 <= s200m1) signal = 'SHORT';
            } else if (strategy === 'MEAN_REVERSION') {
                const ema200 = indicators.ema200[i-1], rsi1 = indicators.rsi[i-1];
                if (ema200 && rsi1) {
                    if (currentClose > ema200 && rsi1 < 25) signal = 'LONG';
                    else if (currentClose < ema200 && rsi1 > 75) signal = 'SHORT';
                }
            } else if (strategy === 'BOLLINGER_BOUNCE') {
                const bb1 = indicators.bb[i-1];
                if (bb1 && bb1.lower && bb1.upper) {
                    if (currentClose <= bb1.lower) signal = 'LONG';
                    else if (currentClose >= bb1.upper) signal = 'SHORT';
                }
            } else if (strategy === 'STOCHASTIC_CROSS') {
                const st2 = indicators.stoch[i-2], st1 = indicators.stoch[i-1];
                if (st2 && st1) {
                    if (st2.k < st2.d && st1.k >= st1.d && st1.k < 20) signal = 'LONG';
                    else if (st2.k > st2.d && st1.k <= st1.d && st1.k > 80) signal = 'SHORT';
                }
            } else if (strategy === 'CCI_REVERSAL') {
                const c2 = indicators.cci[i-2], c1 = indicators.cci[i-1];
                if (c2 && c1) {
                    if (c2 < -100 && c1 >= -100) signal = 'LONG';
                    else if (c2 > 100 && c1 <= 100) signal = 'SHORT';
                }
            } else if (strategy === 'ADX_TREND') {
                const a1 = indicators.adx[i-1], a2 = indicators.adx[i-2];
                if (a1 && a2) {
                     if (a1.adx > 25 && a2.pdi < a2.mdi && a1.pdi >= a1.mdi) signal = 'LONG';
                     else if (a1.adx > 25 && a2.pdi > a2.mdi && a1.pdi <= a1.mdi) signal = 'SHORT';
                }
            } else if (strategy === 'WILLIAMS_R') {
                const w2 = indicators.willR[i-2], w1 = indicators.willR[i-1];
                if (w2 && w1) {
                    if (w2 < -80 && w1 >= -80) signal = 'LONG';
                    else if (w2 > -20 && w1 <= -20) signal = 'SHORT';
                }
            } else if (strategy === 'SMC_ADVANCED') {
                const ema200 = indicators.ema200[i-1];
                if (ema200) {
                    const isUptrend = closes[i-1] > ema200;
                    if (isUptrend) {
                        for (let j = 2; j <= 20; j++) {
                            const idx = i - j;
                            if (idx < 2) continue;
                            const fvgUpper = lows[idx];
                            const fvgLower = highs[idx-2];
                            if (fvgUpper > fvgLower) {
                                if (lows[i-1] <= fvgUpper && closes[i-1] >= fvgLower) { signal = 'LONG'; break; }
                            }
                        }
                    } else {
                        for (let j = 2; j <= 20; j++) {
                             const idx = i - j;
                             if (idx < 2) continue;
                             const fvgLower = highs[idx];
                             const fvgUpper = lows[idx-2];
                             if (fvgLower < fvgUpper) {
                                  if (highs[i-1] >= fvgLower && closes[i-1] <= fvgUpper) { signal = 'SHORT'; break; }
                             }
                        }
                    }
                }
            }

            if (signal) {
                // Execute Market Order Entry
                const entryPrice = signal === 'LONG' 
                    ? currentClose * (1 + (slippage/100)) // Pay higher due to slippage
                    : currentClose * (1 - (slippage/100)); // Receive lower due to slippage

                // Professional Position Sizing (Risk-Based)
                // Risk Amount = Total Balance * (Risk% / 100)
                const riskAmount = balance * (riskPerTrade / 100);
                
                // Position Size needed so that hitting SL exactly equals Risk Amount
                // PosSize = RiskAmount / (SL distance %)
                const posSizeUSD = riskAmount / (slRatio);
                const adxValue = indicators.adx[i-1]?.adx ?? 0;
                const regime = classifyMarketRegime({
                    adx: adxValue,
                    atrPercent: atrPercent[i-1] ?? 0,
                    emaFast: indicators.ema20[i-1] ?? currentClose,
                    emaSlow: indicators.ema50[i-1] ?? currentClose
                });

                currentPosition = {
                    side: signal,
                    entry: entryPrice, // Exact filled price
                    entryTime: currentTime,
                    entryIndex: i,
                    highWatermark: entryPrice,
                    lowWatermark: entryPrice,
                    posSizeUSD: posSizeUSD,
                    riskAmount,
                    regime
                };
            }
        }
      }

      // Close open position at end natively
      if (currentPosition) {
         const currentClose = closes[closes.length - 1];
         const priceDiffMultiplier = currentPosition.side === 'LONG' ? (currentClose - currentPosition.entry) / currentPosition.entry : (currentPosition.entry - currentClose) / currentPosition.entry;
         const grossPnL = currentPosition.posSizeUSD * priceDiffMultiplier;
         const feeCost = (currentPosition.posSizeUSD * takerFee/100) + (currentPosition.posSizeUSD * (currentClose/currentPosition.entry) * takerFee/100);
         const netPnL = grossPnL - feeCost;
         
         balance += netPnL;
         trades.push({
              id: trades.length + 1,
              side: currentPosition.side,
              entryTime: currentPosition.entryTime,
              exitTime: times[times.length - 1],
              entry: currentPosition.entry,
              exit: currentClose,
              pnl: netPnL,
              rMultiple: currentPosition.riskAmount > 0 ? netPnL / currentPosition.riskAmount : 0,
              balanceAfter: balance,
              entryIndex: currentPosition.entryIndex,
              regime: currentPosition.regime,
              endReason: 'End of Data Constraint',
              won: netPnL > 0
          });
          balanceHistory.push({ id: trades.length, balance, time: times[times.length - 1] });
      }

      // --- Advanced Analytics Calculation ---
      let maxConsWins = 0, currentConsWins = 0;
      let maxConsLosses = 0, currentConsLosses = 0;
      let grossProfit = 0, grossLoss = 0;
      let tradeReturns: number[] = [];

      trades.forEach((t) => {
           if (t.won) {
               currentConsWins++; currentConsLosses = 0;
               if (currentConsWins > maxConsWins) maxConsWins = currentConsWins;
               grossProfit += t.pnl;
           } else {
               currentConsLosses++; currentConsWins = 0;
               if (currentConsLosses > maxConsLosses) maxConsLosses = currentConsLosses;
               grossLoss += Math.abs(t.pnl);
           }
           tradeReturns.push(t.pnl / initialBalance);
      });

      const won = trades.filter(t => t.won).length;
      const winRate = trades.length > 0 ? (won / trades.length) * 100 : 0;
      const netProfit = balance - initialBalance;
      const profitPct = (netProfit / initialBalance) * 100;
      
      const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);
      const expectancy = trades.length > 0 ? (grossProfit - grossLoss) / trades.length : 0;
      
      // Simplified Sharpe Ratio (approximated for trade sequence, assumes 0 risk-free rate)
      const avgReturn = tradeReturns.reduce((sum, r) => sum + r, 0) / (tradeReturns.length || 1);
      const variance = tradeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (tradeReturns.length || 1);
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(trades.length) : 0;
      const evidence = summarizeBacktestEvidence({
        trades,
        initialBalance,
        inSampleRatio: 0.7
      });
      const walkForwardWindows = buildWalkForwardWindows({
        totalCandles: closes.length,
        trainSize: Math.max(120, Math.floor(closes.length * 0.35)),
        testSize: Math.max(40, Math.floor(closes.length * 0.1)),
        stepSize: Math.max(40, Math.floor(closes.length * 0.1))
      });
      const walkForward = evaluateWalkForwardStability(walkForwardWindows.map(window => {
        const windowTrades = trades.filter((trade: any) => trade.entryIndex >= window.testStart && trade.entryIndex <= window.testEnd);
        const windowEvidence = summarizeBacktestEvidence({
          trades: windowTrades.map((trade: any) => ({
            pnl: trade.pnl,
            rMultiple: trade.rMultiple,
            exitTime: trade.exitTime,
            regime: trade.regime
          })),
          initialBalance
        });
        return {
          id: window.id,
          trades: windowTrades.length,
          expectancyR: windowTrades.length > 0
            ? windowTrades.reduce((sum: number, trade: any) => sum + (trade.rMultiple ?? 0), 0) / windowTrades.length
            : 0,
          maxDrawdownPercent: windowEvidence.maxDrawdownPercent
        };
      }));
      const regimePerformance = analyzeRegimePerformance(trades);
      const institutionalEvidence = {
        ...evidence,
        walkForward,
        regimePerformance
      };

      setResults({
          trades: trades.reverse(), // latest first for display
          balanceHistory,
          winRate,
          totalTrades: trades.length,
          netProfit,
          profitPct,
          finalBalance: balance,
          maxDrawdown,
          profitFactor,
          expectancy,
          maxConsWins,
          maxConsLosses,
          sharpeRatio,
          evidence: institutionalEvidence
      });
      onEvidence?.(institutionalEvidence);

    } catch (e) {
      console.error("Backtest Error:", e);
      alert('เกิดข้อผิดพลาดในการรัน Backtest กรุณาลองใหม่');
    }
    setIsRunning(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto p-4 md:p-8 overflow-y-auto w-full pb-32">
       <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
            <Database className="w-6 h-6 text-cyan-400" />
            Professional Workstation
          </h2>
          <p className="text-slate-400 mt-1 text-sm">ระบบจำลองและระบบคำนวณความเสี่ยงสำหรับ research ก่อนใช้งานจริง</p>
        </div>

        <div className="flex bg-slate-900 border border-slate-700 p-1 rounded-lg">
           <button 
             onClick={() => setActiveTab('SIMULATOR')}
             className={`px-4 py-2 flex items-center gap-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'SIMULATOR' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <Database className="w-4 h-4" /> Strategy Backtester
           </button>
           <button 
             onClick={() => setActiveTab('CALCULATOR')}
             className={`px-4 py-2 flex items-center gap-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'CALCULATOR' ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <Calculator className="w-4 h-4" /> Position Size Calculator
           </button>
        </div>
      </div>

      <IncrementalEdgeEvidencePanel />
      <ForwardCandidateEvidencePanel />

      {activeTab === 'CALCULATOR' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <PositionCalculator marketData={marketData} setupDetails={setupDetails} />
        </motion.div>
      )}

      {activeTab === 'SIMULATOR' && (
        <div className="space-y-6">
          <div className="bg-[#0B0F19] rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-6 relative">
         <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
             {/* Left - Strategy Params */}
             <div className="xl:col-span-4 grid grid-cols-1 gap-4 bg-slate-800/20 p-5 rounded-xl border border-slate-700/30 h-fit">
                 <h3 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2"><Layers className="w-4 h-4" /> 1. Market & Strategy</h3>
                 <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 mt-2 mb-2">สินทรัพย์ (Symbol)</label>
                     <select value={symbol} onChange={e => setSymbol(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer">
                         {marketData && marketData.length > 0 ? (
                            marketData.map((m: any, index: number) => (
                                <option key={m.symbol} value={m.symbol}>{index + 1}. {m.symbol}</option>
                            ))
                         ) : (
                            <>
                                <option value="BTCUSDT">1. Bitcoin (BTC)</option>
                                <option value="ETHUSDT">2. Ethereum (ETH)</option>
                                <option value="SOLUSDT">3. Solana (SOL)</option>
                            </>
                         )}
                     </select>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                     <div>
                         <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 mt-2 mb-2">Timeframe</label>
                         <select value={timeframe} onChange={e => setTimeframe(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer text-sm">
                             <option value="15m">15m</option>
                             <option value="1h">1H</option>
                             <option value="4h">4H</option>
                             <option value="1d">1D</option>
                         </select>
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 mt-2 mb-2">Sample Size</label>
                         <select value={limit} onChange={e => setLimit(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer text-sm">
                             <option value={500}>500 แท่ง</option>
                             <option value={1000}>1,000 แท่ง</option>
                             <option value={1500}>1,500 แท่ง</option>
                         </select>
                     </div>
                 </div>
                 <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 mt-2 mb-2 flex justify-between">
                        <span>Trading Core Logic</span>
                     </label>
                     <select value={strategy} onChange={e => setStrategy(e.target.value)} className="w-full bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-600 rounded-lg p-3 text-white font-bold text-sm focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer shadow-inner">
                         <option value="EMA_CROSS">1. EMA 20/50 Crossover</option>
                         <option value="GOLDEN_CROSS">2. Golden Cross 50/200</option>
                         <option value="MACD">3. MACD Zero Crossover</option>
                         <option value="RSI">4. RSI Reversal (&gt; 70 / &lt; 30)</option>
                         <option value="MEAN_REVERSION">5. Mean Reversion + MA200</option>
                         <option value="BOLLINGER_BOUNCE">6. Bollinger Bands Bounce</option>
                         <option value="STOCHASTIC_CROSS">7. Stochastic Cross (&gt; 80 / &lt; 20)</option>
                         <option value="CCI_REVERSAL">8. CCI Reversal (+/- 100)</option>
                         <option value="ADX_TREND">9. ADX DI Momentum (&gt; 25)</option>
                         <option value="WILLIAMS_R">10. Williams %R Momentum</option>
                         <option value="SMC_ADVANCED">11. Smart Money Concepts (FVG)</option>
                     </select>
                 </div>
             </div>

             {/* Right - Risk Params */}
             <div className="xl:col-span-8 bg-slate-800/30 p-5 rounded-xl border border-slate-700/50 flex flex-col justify-between h-fit">
                <div>
                   <h3 className="text-sm font-bold text-fuchsia-400 mb-4 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> 2. Professional Execution & Risk Profiling</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-4">
                           <div className="flex gap-4">
                               <div className="flex-1">
                                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Account Risk / Trade (%)</label>
                                  <input type="number" step="0.5" value={riskPerTrade} onChange={e=>setRiskPerTrade(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700/50 rounded p-2 text-cyan-300 font-bold font-mono focus:border-cyan-500 outline-none" title="เสี่ยงกี่เปอร์เซ็นต์ของพอร์ต หากโดน Stoploss" />
                               </div>
                               <div className="flex-1">
                                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Entry Slippage (%)</label>
                                  <input type="number" step="0.01" value={slippage} onChange={e=>setSlippage(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700/50 rounded p-2 text-slate-300 font-mono text-sm focus:border-cyan-500 outline-none" title="จำลองความคลาดเคลื่อนราคาตลาด" />
                               </div>
                           </div>
                           <div className="flex gap-4">
                               <div className="flex-1">
                                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Maker Fee (%)</label>
                                  <input type="number" step="0.01" value={makerFee} onChange={e=>setMakerFee(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700/50 rounded p-2 text-emerald-400/80 font-mono text-sm outline-none" />
                               </div>
                               <div className="flex-1">
                                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Taker Fee (%)</label>
                                  <input type="number" step="0.01" value={takerFee} onChange={e=>setTakerFee(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700/50 rounded p-2 text-rose-400/80 font-mono text-sm outline-none" />
                               </div>
                           </div>
                       </div>
                       
                       <div className="space-y-4 p-4 bg-[#0a001a]/50 rounded-lg border border-fuchsia-500/20">
                           <div className="flex gap-4">
                               <div className="flex-1 w-full">
                                  <label className="block text-[10px] text-slate-400 uppercase mb-1 text-rose-400">Stop Loss Distance (%)</label>
                                  <input type="number" step="0.1" value={slPercent} onChange={e=>setSlPercent(Number(e.target.value))} className="w-full bg-slate-900 border border-rose-900/50 rounded p-2 text-white font-mono text-sm focus:border-rose-500 outline-none" />
                               </div>
                               <div className="flex-1 w-full">
                                  <label className="block text-[10px] text-slate-400 uppercase mb-1 text-emerald-400">Take Profit Target (%)</label>
                                  <input type="number" step="0.1" value={tpPercent} onChange={e=>setTpPercent(Number(e.target.value))} className="w-full bg-slate-900 border border-emerald-900/50 rounded p-2 text-white font-mono text-sm focus:border-emerald-500 outline-none" />
                               </div>
                           </div>
                           <div className="flex items-center gap-3 pt-2">
                               <button 
                                 onClick={() => setUseTrailing(!useTrailing)}
                                 className={`w-10 h-6 rounded-full transition-colors relative flex items-center ${useTrailing ? 'bg-cyan-500' : 'bg-slate-700'}`}
                               >
                                 <div className={`w-4 h-4 bg-white rounded-full absolute transition-all duration-300 ${useTrailing ? 'left-[22px]' : 'left-1'}`} />
                               </button>
                               <span className="text-xs text-slate-300 flex-1 font-bold">เปิดใช้งาน Trailing Stop</span>
                               {useTrailing && (
                                   <div className="flex items-center gap-2">
                                       <span className="text-xs text-slate-500">ระยะห่าง:</span>
                                       <input type="number" step="0.1" value={trailPercent} onChange={e=>setTrailPercent(Number(e.target.value))} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs outline-none" />
                                       <span className="text-xs text-slate-500">%</span>
                                   </div>
                               )}
                           </div>
                       </div>
                   </div>
                </div>
                 
                 <motion.button 
                    whileHover={{ scale: 1.01, boxShadow: "0 0 20px rgba(6, 182, 212, 0.4)" }} 
                    whileTap={{ scale: 0.98 }}
                    onClick={runBacktest}
                    disabled={isRunning}
                    className="w-full mt-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                 >
                     {isRunning ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap className="w-5 h-5 text-white fill-white" />}
                     {isRunning ? 'ระบบกำลังเดินหน้าจำลองกราฟ...' : 'LAUNCH SIMULATION'}
                 </motion.button>
             </div>
         </div>
      </div>

      {results && (
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 mt-6">
             {/* Key Metrics */}
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Win Rate</p>
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                        {results.winRate.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Gross Return / Net PnL</p>
                    <p className={`text-2xl font-bold ${results.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {results.profitPct >= 0 ? '+' : ''}{results.profitPct.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Profit Factor</p>
                    <p className="text-2xl font-bold text-cyan-400">
                        {results.profitFactor >= 999 ? '∞' : results.profitFactor.toFixed(2)}
                    </p>
                </div>
                <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Max Drawdown</p>
                    <p className="text-2xl font-bold text-rose-400">
                        -{results.maxDrawdown.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Est. Sharpe Ratio</p>
                    <p className={`text-2xl font-bold ${results.sharpeRatio > 1 ? 'text-fuchsia-400' : 'text-slate-300'}`}>
                        {results.sharpeRatio.toFixed(2)}
                    </p>
                </div>
                <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Expectancy / Trade</p>
                    <p className="text-2xl font-bold text-slate-300">
                        ${results.expectancy.toFixed(1)}
                    </p>
                </div>
             </div>

             {results.evidence && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-[#0B0F19] p-5 rounded-xl border border-slate-800">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" /> Walk-Forward Stability
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Status</div>
                        <div className={results.evidence.walkForward?.status === 'PASS' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {results.evidence.walkForward?.status ?? 'BLOCK'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Positive Windows</div>
                        <div className="text-white font-bold">{results.evidence.walkForward?.positiveWindowRate ?? 0}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Min Window Exp.</div>
                        <div className="text-white font-bold">{results.evidence.walkForward?.minWindowExpectancyR ?? 0}R</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Windows</div>
                        <div className="text-white font-bold">{results.evidence.walkForward?.windows ?? 0}</div>
                      </div>
                    </div>
                    {(results.evidence.walkForward?.issues ?? []).slice(0, 3).map((issue: any) => (
                      <div key={issue.code} className="mt-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded p-2">
                        {issue.code}: {issue.message}
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#0B0F19] p-5 rounded-xl border border-slate-800">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-fuchsia-400" /> Regime Performance
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(results.evidence.regimePerformance?.byRegime ?? {}).filter(([, metric]: any) => metric.trades > 0).map(([regime, metric]: any) => (
                        <div key={regime} className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                          <span className="font-bold text-slate-200">{regime}</span>
                          <span className="text-slate-400">{metric.trades} trades</span>
                          <span className={metric.expectancyR >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{metric.expectancyR}R</span>
                        </div>
                      ))}
                    </div>
                    {(results.evidence.regimePerformance?.issues ?? []).slice(0, 3).map((issue: any) => (
                      <div key={issue.code} className="mt-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded p-2">
                        {issue.code}: {issue.message}
                      </div>
                    ))}
                  </div>
                </div>
             )}

             {/* Chart */}
             <div className="bg-[#0B0F19] p-6 rounded-xl border border-slate-800 shadow-md relative overflow-hidden">
                 <div className="absolute top-4 right-6 flex gap-4 text-xs font-mono text-slate-500">
                    <div>Max Wins: <span className="text-emerald-400">{results.maxConsWins}</span></div>
                    <div>Max Loss: <span className="text-rose-400">{results.maxConsLosses}</span></div>
                    <div>Trades: <span className="text-cyan-400">{results.totalTrades}</span></div>
                 </div>
                 <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                     <BarChart className="w-5 h-5 text-fuchsia-400" /> Professional Equity Curve
                 </h3>
                 <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={results.balanceHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis 
                                dataKey="time" 
                                stroke="#64748b" 
                                tick={{ fontSize: 10 }}
                                tickCount={5}
                                interval="preserveStartEnd"
                            />
                            <YAxis 
                                domain={['auto', 'auto']} 
                                stroke="#64748b" 
                                tick={{ fontSize: 10 }}
                                tickFormatter={(val) => `$${Math.round(val)}`}
                                width={80}
                            />
                            <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                                itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
                                labelStyle={{ color: '#94a3b8', marginBottom: '8px' }}
                                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Account Balance']}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="balance" 
                                stroke={results.netProfit >= 0 ? '#10b981' : '#f43f5e'} 
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6, fill: '#fff', strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                 </div>
             </div>

             {/* Trade History */}
             <div className="bg-[#0B0F19] rounded-xl border border-slate-800 shadow-md overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h3 className="font-bold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-cyan-400" /> Trade Ledger (Top 50 Recent)</h3>
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">Fees & Slippage Applied</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="text-[10px] uppercase bg-slate-900 text-slate-500 font-bold tracking-wider">
                            <tr>
                                <th className="px-4 py-3">#</th>
                                <th className="px-4 py-3">Time Range</th>
                                <th className="px-4 py-3">Direction</th>
                                <th className="px-4 py-3">Entry/Exit Price</th>
                                <th className="px-4 py-3">Exit Reason</th>
                                <th className="px-4 py-3 text-right">Net PnL ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {results.trades.slice(0, 50).map((t: any) => (
                                <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-3 font-mono text-slate-500">{t.id}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="text-slate-300 group-hover:text-cyan-400 transition-colors text-xs">{t.entryTime}</div>
                                        <div className="text-slate-500 text-[10px]">to {t.exitTime}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded font-bold text-[10px] ${t.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                            {t.side}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        <div className="text-slate-300">{t.entry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                                        <div className="text-slate-500 mt-0.5">{t.exit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider
                                            ${t.endReason.includes('Take') ? 'bg-emerald-900/40 text-emerald-300' : 
                                              t.endReason.includes('Trailing') ? 'bg-fuchsia-900/40 text-fuchsia-300' : 
                                              t.endReason.includes('Stop Loss') ? 'bg-rose-900/40 text-rose-300' : 
                                              'bg-slate-800 text-slate-400'}`}
                                        >
                                            {t.endReason}
                                        </span>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold font-mono text-sm ${t.won ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        <div className="flex items-center justify-end gap-1">
                                            {t.won ? '+' : ''}{t.pnl.toFixed(2)}$
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {results.trades.length > 50 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-4 text-center text-slate-500 text-xs italic">
                                        + {results.trades.length - 50} historical entries hidden.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
         </motion.div>
      )}
        </div>
      )}
    </div>
  );
};
