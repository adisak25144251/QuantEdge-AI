import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Layers, Activity, TrendingUp, TrendingDown, RefreshCw, BarChart2, ShieldAlert, Zap, BrainCircuit, Target, Crosshair } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, AreaChart, Area } from 'recharts';
import { scoreScreenerSetup } from '../domain/strategy/screenerScoring';

// Extract data directly from the dynamic market dataset to calculate actual metrics
// Instead of randomizing, which causes component thrashing/jumping
const generateHeatmapData = (symbols: any[]) => {
  const safeSymbols = (symbols && symbols.length > 0) ? symbols : [
    {symbol: 'BTCUSDT', priceChangePercent: '2.5', volume: '100000'}, 
    {symbol: 'ETHUSDT', priceChangePercent: '-1.2', volume: '80000'}, 
    {symbol: 'SOLUSDT', priceChangePercent: '5.4', volume: '60000'}, 
    {symbol: 'BNBUSDT', priceChangePercent: '1.1', volume: '50000'}, 
    {symbol: 'XRPUSDT', priceChangePercent: '-0.5', volume: '40000'},
    {symbol: 'DOGEUSDT', priceChangePercent: '8.2', volume: '30000'}, 
    {symbol: 'ADAUSDT', priceChangePercent: '0.3', volume: '20000'}, 
    {symbol: 'AVAXUSDT', priceChangePercent: '-3.4', volume: '15000'}, 
    {symbol: 'LINKUSDT', priceChangePercent: '2.1', volume: '10000'}, 
    {symbol: 'MATICUSDT', priceChangePercent: '-1.8', volume: '5000'}
  ];
  
  return safeSymbols.slice(0, 50).map(s => {
    const momentum = parseFloat(s.priceChangePercent || '0');
    let volumeStr = s.volume || '0';
    // Handle volume scaling if it's super large like an actual exchange
    const volume = parseFloat(volumeStr) / 1000000; 

    return {
      symbol: s.symbol,
      volatility: Math.abs(momentum) * 1.5, // estimate volatility based on price change
      momentum: momentum,
      volumeStrength: volume,
      trendScore: Math.max(-50, Math.min(50, momentum * 5)), // Cap between -50 and 50
    };
  }).sort((a, b) => b.volumeStrength - a.volumeStrength);
};

const generateCoreLogicSetups = (marketData: any[]) => {
    return (marketData || [])
      .filter(d => d && d.symbol && d.priceChangePercent)
      .map(d => scoreScreenerSetup({
        symbol: d.symbol,
        lastPrice: d.lastPrice || '0',
        priceChangePercent: d.priceChangePercent || '0',
        volume: d.volume || '0',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
};

export const MarketScreener = ({ marketData, journal = [], onSelectSymbol }: { marketData: any[], journal?: any[], onSelectSymbol?: (symbol: string) => void }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL'); // ALL, TOP_GAINERS, TOP_LOSERS, HIGH_VOL
  const [topSetups, setTopSetups] = useState<any[]>([]);

  // Advanced Journal-Based Insights
  const personalizedInsights = useMemo(() => {
    if (!journal || journal.length === 0) return null;
    const closed = journal.filter(t => t.status === 'WON' || t.status === 'LOST');
    if (closed.length < 3) return null;

    const won = closed.filter(t => t.status === 'WON');
    const winRate = (won.length / closed.length) * 100;
    
    // Find best asset
    const assetWins: Record<string, number> = {};
    const assetTotals: Record<string, number> = {};
    closed.forEach(t => {
       const sym = t.symbol || 'UNKNOWN';
       assetTotals[sym] = (assetTotals[sym] || 0) + 1;
       if (t.status === 'WON') assetWins[sym] = (assetWins[sym] || 0) + 1;
    });

    let bestAsset = '';
    let bestAssetWR = 0;
    Object.keys(assetTotals).forEach(sym => {
       if (assetTotals[sym] >= 2) { // min 2 trades
           const wr = (assetWins[sym] || 0) / assetTotals[sym];
           if (wr > bestAssetWR) {
               bestAssetWR = wr;
               bestAsset = sym;
           }
       }
    });

    return {
        winRate,
        bestAsset: bestAsset || 'N/A',
        bestAssetWR: bestAssetWR * 100
    };
  }, [journal]);

    useEffect(() => {
    // Generate heatmap data synchronously to avoid being interrupted by rapid marketData updates
    let heatmapData = generateHeatmapData(marketData);
    const setups = generateCoreLogicSetups(marketData);
    
    if (filterType === 'TOP_GAINERS') {
         heatmapData = heatmapData.filter(d => d.momentum > 0).sort((a,b) => b.momentum - a.momentum);
    } else if (filterType === 'TOP_LOSERS') {
         heatmapData = heatmapData.filter(d => d.momentum < 0).sort((a,b) => a.momentum - b.momentum);
    } else if (filterType === 'HIGH_VOL') {
         heatmapData = heatmapData.sort((a,b) => b.volatility - a.volatility);
    }
    
    setData(heatmapData);
    setTopSetups(setups);
    setLoading(false);
  }, [marketData, filterType]);

  return (
    <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto p-4 md:p-8 overflow-y-auto w-full pb-32">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]">
            <Layers className="w-6 h-6 text-pink-500" />
            Institutional Market Screener
          </h2>
          <p className="text-slate-400 mt-1">สแกน setup candidate ด้วยการวิเคราะห์ Volatility, Momentum และ Volume อัตโนมัติ (Professional Research Module)</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded-lg border border-slate-700 w-full md:w-auto overflow-x-auto shrink-0">
             <FilterBtn active={filterType === 'ALL'} onClick={() => setFilterType('ALL')}>All Market</FilterBtn>
             <FilterBtn active={filterType === 'TOP_GAINERS'} onClick={() => setFilterType('TOP_GAINERS')}><TrendingUp className="w-3 h-3 text-emerald-400"/> Strong Bulls</FilterBtn>
             <FilterBtn active={filterType === 'TOP_LOSERS'} onClick={() => setFilterType('TOP_LOSERS')}><TrendingDown className="w-3 h-3 text-rose-400"/> Strong Bears</FilterBtn>
             <FilterBtn active={filterType === 'HIGH_VOL'} onClick={() => setFilterType('HIGH_VOL')}><Zap className="w-3 h-3 text-amber-400"/> High Volatility</FilterBtn>
        </div>
      </div>

      {loading ? (
          <div className="flex justify-center items-center h-64">
              <RefreshCw className="w-8 h-8 text-pink-500 animate-spin" />
              <span className="ml-3 text-slate-400 font-mono">Running Algorithmic Scans...</span>
          </div>
      ) : (
          <>
             {/* AI Personalized Insight Banner */}
             {personalizedInsights && (
                <div className="bg-gradient-to-r from-indigo-900/40 to-fuchsia-900/40 border border-indigo-500/30 rounded-xl p-4 sm:p-6 mb-6 flex items-start gap-4">
                  <div className="bg-indigo-500/20 p-3 rounded-full text-indigo-300 shrink-0">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg mb-1 drop-shadow-md">AI Portfolio Insights based on Your Journal</h3>
                    <p className="text-slate-300 text-sm leading-relaxed max-w-4xl">
                      จากประวัติการเทรดของคุณ มี <strong>Win Rate รวมอยู่ที่ {personalizedInsights.winRate.toFixed(1)}%</strong> 
                      {personalizedInsights.bestAsset !== 'N/A' && (
                        <span> และพบว่าเหรียญที่คุณทำกำไรได้ดีที่สุดคือ <strong className="text-emerald-400">{personalizedInsights.bestAsset}</strong> (Win Rate: {personalizedInsights.bestAssetWR.toFixed(0)}%)</span>
                      )} 
                      <br/>แนะนำให้คุณโฟกัสการหาสัญญาณเทรดจาก Screener ในเหรียญที่คุ้นเคย หรือตั้ง Filter <strong className="text-amber-400">High Volatility</strong> หากสถิติ RR ของคุณในอดีตต้องการรอบเทรดที่เหวี่ยงตัวสูง
                    </p>
                  </div>
                </div>
             )}

             {/* Top Overview Cards */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-[#0B0F19] p-6 rounded-xl border border-slate-800 shadow-md relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10"><Activity className="w-16 h-16 text-pink-500" /></div>
                   <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Market Trend Score</h3>
                   <div className="flex items-end gap-3">
                       <span className="text-4xl font-bold text-white">
                           {(data.reduce((acc, d) => acc + d.trendScore, 0) / (data.length || 1)).toFixed(1)}
                       </span>
                       <span className="text-sm text-slate-500 mb-1 font-mono">/ 50.0</span>
                   </div>
                   <div className="w-full bg-slate-800 h-2 rounded-full mt-4 overflow-hidden flex">
                       <div className="bg-rose-500 h-full" style={{ width: '30%' }}></div>
                       <div className="bg-slate-600 h-full w-0.5"></div>
                       <div className="bg-emerald-500 h-full" style={{ width: '70%' }}></div>
                   </div>
                   <p className="text-xs text-slate-500 mt-2">Overall market breadth is currently bullish dominated.</p>
                </div>
                <div className="hidden md:block col-span-2 bg-[#0B0F19] p-6 rounded-xl border border-slate-800 shadow-md">
                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-cyan-400" /> Relative Momentum (Top 20)
                     </h3>
                     <div className="h-24 w-full">
                         <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart data={data.slice(0,20)}>
                               <Bar dataKey="momentum" radius={[4, 4, 0, 0]}>
                                  {data.slice(0,20).map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={entry.momentum > 0 ? '#10b981' : '#f43f5e'} />
                                  ))}
                               </Bar>
                               <Tooltip 
                                  cursor={{ fill: '#1e293b', opacity: 0.4 }}
                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                               />
                            </BarChart>
                         </ResponsiveContainer>
                     </div>
                </div>
             </div>
             
             {/* Top 10 Trading Core Logic Setups */}
             <div className="bg-[#0B0F19] rounded-xl border border-slate-800 shadow-xl overflow-hidden p-6 mb-6">
                 <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
                     <Target className="w-4 h-4 text-emerald-400" /> Top 10 Scanned Setups (Trading Core Logic)
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                     {topSetups.map((setup, i) => (
                         <div 
                             key={`setup-${i}`} 
                             onClick={() => onSelectSymbol && onSelectSymbol(setup.symbol)}
                             className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 cursor-pointer hover:bg-slate-800 hover:border-slate-500 transition-all flex flex-col justify-between group"
                         >
                             <div className="flex justify-between items-center mb-3">
                                 <div className="flex items-center gap-2">
                                     <span className="text-sm text-slate-500 font-bold bg-slate-800 px-2 py-0.5 rounded-md">#{i+1}</span>
                                     <span className="font-bold text-white group-hover:text-pink-400 transition-colors">{setup.symbol}</span>
                                 </div>
                                 <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${setup.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                     {setup.direction}
                                 </span>
                             </div>
                             
                             <div className="mb-3 flex items-center gap-2">
                                 <Crosshair className="w-4 h-4 text-slate-400" />
                                 <span className="text-xs text-slate-300 font-medium truncate" title={setup.logic}>{setup.logic}</span>
                             </div>
                             
                             <div className="flex justify-between items-end border-t border-slate-800/50 pt-3">
                                 <div>
                                     <span className="text-[10px] text-slate-500 block mb-0.5 uppercase tracking-wider">Confidence</span>
                                     <span className="text-sm font-bold text-amber-400">{setup.confidence}%</span>
                                 </div>
                                 <div className="text-right">
                                     <span className="text-[10px] text-slate-500 block mb-0.5 uppercase tracking-wider">24h Volatility</span>
                                     <span className={`text-sm font-bold ${parseFloat(setup.priceChange) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                         {parseFloat(setup.priceChange) > 0 ? '+' : ''}{setup.priceChange}%
                                     </span>
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
             
             {/* Heatmap Grid */}
             <div className="bg-[#0B0F19] rounded-xl border border-slate-800 shadow-xl overflow-hidden p-6">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
                    <ShieldAlert className="w-4 h-4 text-fuchsia-400" /> Algorithmic Scan Results
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                   {data.map((item, i) => {
                       const isBull = item.momentum > 0;
                       // Heat calculation
                       const heat = Math.min(Math.abs(item.momentum) / 10, 1); // 0 to 1
                       let bgClass = '';
                       let textClass = 'text-white';
                       if (isBull) {
                           if (heat > 0.8) bgClass = 'bg-emerald-500';
                           else if (heat > 0.5) bgClass = 'bg-emerald-600';
                           else if (heat > 0.2) bgClass = 'bg-emerald-800';
                           else bgClass = 'bg-emerald-900/50';
                       } else {
                           if (heat > 0.8) bgClass = 'bg-rose-500';
                           else if (heat > 0.5) bgClass = 'bg-rose-600';
                           else if (heat > 0.2) bgClass = 'bg-rose-800';
                           else bgClass = 'bg-rose-900/50';
                       }

                       return (
                           <div 
                               key={item.symbol} 
                               onClick={() => onSelectSymbol && onSelectSymbol(item.symbol)}
                               className={`rounded-lg p-3 ${bgClass} border border-white/5 cursor-pointer hover:border-white/50 transition-colors flex flex-col justify-between h-24`}
                               title={`Vol: ${item.volatility.toFixed(2)} | Trend: ${item.trendScore.toFixed(1)}`}
                           >
                               <div className="flex justify-between items-start">
                                   <span className="font-bold text-xs truncate max-w-full drop-shadow-md text-white">{item.symbol}</span>
                               </div>
                               <div>
                                  <div className="text-lg font-black tracking-tighter drop-shadow-md flex items-center">
                                     {isBull ? '+' : ''}{item.momentum.toFixed(1)}%
                                  </div>
                                  <div className="text-[9px] text-white/70 uppercase tracking-widest mt-1">Vol: {item.volatility.toFixed(1)}</div>
                               </div>
                           </div>
                       )
                   })}
                </div>
             </div>
          </>
      )}
    </div>
  );
};

const FilterBtn = ({ active, onClick, children }: any) => (
    <button 
        onClick={onClick}
        className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${active ? 'bg-pink-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 hover:bg-slate-700'}`}
    >
        {children}
    </button>
);
