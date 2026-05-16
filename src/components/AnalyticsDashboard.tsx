import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Target, TrendingUp, TrendingDown, Activity, Award, Filter } from 'lucide-react';

export const AnalyticsDashboard = ({ journal, marketData }: { journal: any[], marketData?: any[] }) => {
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');

  const availableSymbols = useMemo(() => {
    // If we have market data, use the top 100 active dynamic symbols
    if (marketData && marketData.length > 0) {
        return marketData.map((m: any) => m.symbol);
    }
    // Fallback to journal unique symbols if no market data
    const symbols = new Set(journal.map(t => t.symbol));
    return Array.from(symbols).filter(Boolean); // remove undefined/null
  }, [journal, marketData]);

  const stats = useMemo(() => {
    let rawJournal = journal;
    if (filterSymbol !== 'ALL') {
        rawJournal = journal.filter(t => t.symbol === filterSymbol);
    }
    const closed = rawJournal.filter(t => t.status === 'WON' || t.status === 'LOST');
    const won = closed.filter(t => t.status === 'WON');
    const lost = closed.filter(t => t.status === 'LOST');
    
    const winRate = closed.length > 0 ? (won.length / closed.length) * 100 : 0;
    const totalPnL = closed.reduce((acc, t) => acc + (t.pnlUSD || 0), 0);
    const avgWin = won.length > 0 ? won.reduce((acc, t) => acc + (t.pnlUSD || 0), 0) / won.length : 0;
    const avgLoss = lost.length > 0 ? lost.reduce((acc, t) => acc + (t.pnlUSD || 0), 0) / lost.length : 0;
    
    const profitFactor = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : (avgWin > 0 ? 999 : 0);

    // Advanced Metrics
    const winRateDecimal = closed.length > 0 ? won.length / closed.length : 0;
    const lossRateDecimal = closed.length > 0 ? lost.length / closed.length : 0;
    
    // Expectancy = (Win % x Avg Win) - (Loss % x Avg Loss)
    const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * Math.abs(avgLoss));

    const longTrades = closed.filter(t => t.side === 'LONG');
    const shortTrades = closed.filter(t => t.side === 'SHORT');
    
    const longWinRate = longTrades.length > 0 ? (longTrades.filter(t => t.status === 'WON').length / longTrades.length) * 100 : 0;
    const shortWinRate = shortTrades.length > 0 ? (shortTrades.filter(t => t.status === 'WON').length / shortTrades.length) * 100 : 0;

    // Cumulative PnL & Max Drawdown & Streaks
    let currentPnL = 0;
    let peakPnL = 0;
    let maxDrawdown = 0;
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let lastStatus = '';

    const pnlData = [...closed].reverse().map((t, index) => {
      currentPnL += (t.pnlUSD || 0);
      
      // Calculate Drawdown
      if (currentPnL > peakPnL) peakPnL = currentPnL;
      const drawdown = peakPnL - currentPnL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      // Calculate Streaks
      if (t.status === 'WON') {
          if (lastStatus === 'WON') currentStreak++;
          else currentStreak = 1;
          if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;
          lastStatus = 'WON';
      } else if (t.status === 'LOST') {
          if (lastStatus === 'LOST') currentStreak++;
          else currentStreak = 1;
          if (currentStreak > maxLossStreak) maxLossStreak = currentStreak;
          lastStatus = 'LOST';
      }

      return {
        tradeId: index + 1,
        pnl: currentPnL,
      };
    });

    const pieData = [
      { name: 'ชนะ (Won)', value: won.length },
      { name: 'แพ้ (Lost)', value: lost.length }
    ];

    return {
      total: closed.length,
      winRate,
      totalPnL,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy,
      maxDrawdown,
      maxWinStreak,
      maxLossStreak,
      longWinRate,
      shortWinRate,
      pnlData,
      pieData
    };
  }, [journal, filterSymbol]);

  const COLORS = ['#10B981', '#F43F5E'];

  if (stats.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
        <Activity className="w-16 h-16 opacity-50" />
        <p className="text-lg">ยังไม่มีข้อมูลการเทรดที่ปิดแล้วสำหรับสรุปผล</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto p-4 md:p-8 overflow-y-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-fuchsia-400" />
            Analytics & Statistics Dashboard
          </h2>
          <p className="text-slate-400 mt-1">วิเคราะห์สถิติความแม่นยำและพฤติกรรมการเทรดของคุณจากประวัติ (Trade Journal)</p>
        </div>
        
        {availableSymbols.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded-lg border border-slate-700 w-full md:w-auto overflow-x-auto shrink-0">
             <Filter className="w-4 h-4 text-cyan-400 shrink-0" />
             <select 
                value={filterSymbol}
                onChange={e => setFilterSymbol(e.target.value)}
                className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer w-full"
             >
                 <option value="ALL" className="bg-slate-900">ทุกสินทรัพย์ (All Assets)</option>
                 {availableSymbols.map((sym: any) => (
                    <option key={sym} value={sym} className="bg-slate-900">{sym}</option>
                 ))}
             </select>
          </div>
        )}
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
          <p className="text-slate-400 text-xs md:text-sm mb-1 uppercase tracking-wider">Win Rate</p>
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-400 shrink-0" />
            <p className="text-xl md:text-2xl font-bold text-white">{stats.winRate.toFixed(1)}%</p>
          </div>
        </div>
        <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
          <p className="text-slate-400 text-xs md:text-sm mb-1 uppercase tracking-wider">Net PnL</p>
          <div className="flex items-center gap-2">
            {stats.totalPnL >= 0 ? <TrendingUp className="w-6 h-6 text-emerald-400 shrink-0" /> : <TrendingDown className="w-6 h-6 text-rose-400 shrink-0" />}
            <p className={`text-xl md:text-2xl font-bold truncate ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
          <p className="text-slate-400 text-xs md:text-sm mb-1 uppercase tracking-wider">Profit Factor</p>
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-cyan-400 shrink-0" />
            <p className="text-xl md:text-2xl font-bold text-white">{stats.profitFactor.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
          <p className="text-slate-400 text-xs md:text-sm mb-1 uppercase tracking-wider">Total Trades</p>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-fuchsia-400 shrink-0" />
            <p className="text-xl md:text-2xl font-bold text-white">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Advanced Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
          <p className="text-slate-500 text-[10px] md:text-xs mb-1 uppercase tracking-wider font-bold">Expectancy (ต่อ 1 ไม้)</p>
          <p className={`text-lg md:text-xl font-bold ${stats.expectancy > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.expectancy > 0 ? '+' : ''}{stats.expectancy.toFixed(2)} USD
          </p>
        </div>
        <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
          <p className="text-slate-500 text-[10px] md:text-xs mb-1 uppercase tracking-wider font-bold">Max Drawdown</p>
          <p className="text-lg md:text-xl font-bold text-rose-400">
            -{stats.maxDrawdown.toFixed(2)} USD
          </p>
        </div>
        <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
          <p className="text-slate-500 text-[10px] md:text-xs mb-1 uppercase tracking-wider font-bold">Max Win Streak</p>
          <p className="text-lg md:text-xl font-bold text-emerald-400">
            {stats.maxWinStreak}
          </p>
        </div>
        <div className="bg-[#0B0F19] p-4 rounded-xl border border-slate-800 shadow-md">
          <p className="text-slate-500 text-[10px] md:text-xs mb-1 uppercase tracking-wider font-bold">Max Loss Streak</p>
          <p className="text-lg md:text-xl font-bold text-amber-400">
            {stats.maxLossStreak}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Cumulative PnL */}
        <div className="bg-[#0B0F19] p-6 rounded-xl border border-slate-800 shadow-md">
          <h3 className="text-lg font-bold text-white mb-4">การเติบโตของพอร์ต (Cumulative PnL)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={stats.pnlData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="tradeId" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                  itemStyle={{ color: '#22d3ee' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="pnl" 
                  stroke={stats.totalPnL >= 0 ? '#10b981' : '#f43f5e'} 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0f172a', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win/Loss & Long/Short Stats */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#0B0F19] p-6 rounded-xl border border-slate-800 shadow-md flex-1 flex flex-col justify-center">
            <h3 className="text-lg font-bold text-white mb-4 text-center">สัดส่วน ชนะ/แพ้ (Win/Loss)</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ color: '#94a3b8' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#0B0F19] p-6 rounded-xl border border-slate-800 shadow-md">
             <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase">ความแม่นยำแบ่งตามฝั่งเทรด</h3>
             <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-emerald-400 font-bold">LONG Win Rate</span>
                    <span className="text-white">{stats.longWinRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${stats.longWinRate}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-rose-400 font-bold">SHORT Win Rate</span>
                    <span className="text-white">{stats.shortWinRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${stats.shortWinRate}%` }}></div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
