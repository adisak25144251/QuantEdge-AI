import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, Database, LineChart, RefreshCw, Search, ShieldAlert, Target, TrendingUp } from 'lucide-react';
import { analyzeSingleStockBreakoutSwing, evaluateDailyUsStockScan, evaluateSmallCapAiWatchlist, scoreUsStockScreenerAnalystCandidate, type SingleStockBreakoutSwingAnalysis, type SmallCapAiGroup, type UsStockAnalystScore } from '../domain/strategy/usStockScreenerAnalyst';
import { buildUsStockTradingPlan, type UsStockTradingPlan } from '../domain/strategy/usStockTradingPlan';
import { detectCandlePatterns } from '../domain/market/candlePatternEngine';
import { apiFetch } from '../lib/apiClient';
import { describeMaterialFiling, fetchFilingEvidence, type FilingEvidenceItem } from '../lib/researchClient';

type ScreenerRow = UsStockAnalystScore & {
  companyName: string;
  sector: string;
  theme: string;
  price: number | null;
  marketCap: number | null;
  averageVolume: number | null;
  latestVolume: number | null;
  relativeVolume: number | null;
  rsi: number | null;
  sma20Status: string;
  sma50Status: string;
  sma200Status: string;
  distanceFrom52WeekHighPercent: number | null;
  catalyst: string;
  catalystAgeDays: number | null;
  catalystSourceUrl: string | null;
  revenueGrowth: number | null;
  earningsTrend: string;
  cashDebtDilutionRisk: string;
  technicalPattern: string;
  dailyScanStatus: 'PASS' | 'REVIEW' | 'BLOCK';
  dailyFailedCriteria: string[];
  matchedPatterns: string[];
  deepDive: {
    watchReason: string;
    technicalSetup: string;
    catalyst: string;
    risks: string;
    entry: string;
    noChaseZone: string;
    thesisInvalidation: string;
  };
  smallCap: {
    status: 'PASS' | 'REVIEW' | 'BLOCK';
    group: SmallCapAiGroup;
    score: number;
    entryTrigger: string;
    invalidationPoint: string;
    stopLoss: string;
    firstTarget: string;
    secondTarget: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    positionSizeSuggestion: string;
    finalView: string;
    warnings: string[];
  };
};

const WATCHLIST_UNIVERSE = [
  { ticker: 'SOUN', theme: 'AI Back-End / Edge AI', sector: 'Technology', catalyst: 'Enterprise voice AI demand and product adoption watch.', catalystAgeDays: 12, pattern: 'Base near 52-week high / Breakout + Retest' },
  { ticker: 'BBAI', theme: 'Defense AI', sector: 'Technology', catalyst: 'Government AI spending and contract pipeline watch.', catalystAgeDays: 18, pattern: 'Triangle Wave 2 / Relative Strength' },
  { ticker: 'AEHR', theme: 'Semiconductor / Memory', sector: 'Technology', catalyst: 'Semiconductor test equipment cycle recovery watch.', catalystAgeDays: 24, pattern: 'Cup with Handle / Volume Dry-Up' },
  { ticker: 'POET', theme: 'Optical Interconnect / AI Bottleneck', sector: 'Technology', catalyst: 'Optical interconnect demand from AI bottlenecks watch.', catalystAgeDays: 9, pattern: 'VCP / Breakout + Retest' },
  { ticker: 'INDI', theme: 'Edge AI / Semiconductor', sector: 'Technology', catalyst: 'Auto semiconductor and edge AI design-win watch.', catalystAgeDays: 21, pattern: 'Base near 52-week high' },
  { ticker: 'OUST', theme: 'AI Robotics / Edge AI', sector: 'Technology', catalyst: 'Robotics and autonomy sensor demand watch.', catalystAgeDays: 15, pattern: 'Bull Flag / High Tight Flag' },
  { ticker: 'NVTS', theme: 'Power Infrastructure / Data Center Infrastructure', sector: 'Technology', catalyst: 'Power efficiency demand for AI infrastructure watch.', catalystAgeDays: 11, pattern: 'Breakout + Retest' },
  { ticker: 'EAF', theme: 'Power Infrastructure / Data Center Infrastructure', sector: 'Industrials', catalyst: 'Grid and industrial infrastructure demand watch.', catalystAgeDays: 26, pattern: 'VCP / Base near 52-week high' },
  { ticker: 'UUUU', theme: 'Power Infrastructure', sector: 'Energy', catalyst: 'Nuclear fuel cycle and policy support watch.', catalystAgeDays: 17, pattern: 'Triangle Wave 4' },
  { ticker: 'SMR', theme: 'Power Infrastructure / Data Center Infrastructure', sector: 'Energy', catalyst: 'SMR policy, customer, and regulatory milestone watch.', catalystAgeDays: 7, pattern: 'Bull Flag / Base required' },
  { ticker: 'WULF', theme: 'Power Infrastructure / Data Center Infrastructure', sector: 'Technology', catalyst: 'Power-backed compute infrastructure watch.', catalystAgeDays: 14, pattern: 'High Tight Flag / Base near 52-week high' },
  { ticker: 'CRDO', theme: 'AI Bottleneck / Optical Interconnect', sector: 'Technology', catalyst: 'AI networking and connectivity demand watch.', catalystAgeDays: 10, pattern: 'Volume Dry-Up / Base near 52-week high' }
];

const DATA_REQUIRED_TH = 'ต้องมีข้อมูลเพิ่ม';

const formatMoney = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return DATA_REQUIRED_TH;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
};

const formatNumber = (value: number | null, digits = 2) => value === null || !Number.isFinite(value) ? DATA_REQUIRED_TH : value.toFixed(digits);
const formatVolume = (value: number | null) => value === null || !Number.isFinite(value) ? DATA_REQUIRED_TH : value.toLocaleString();

const toThaiDisplay = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return DATA_REQUIRED_TH;
  return String(value)
    .replaceAll('Data required', DATA_REQUIRED_TH)
    .replaceAll('Watchlist Candidate', 'หุ้นเฝ้าติดตาม')
    .replaceAll('Strong Breakout Candidate', 'ผู้สมัคร Breakout แข็งแรง')
    .replaceAll('High Conviction Watchlist', 'Watchlist ความเชื่อมั่นสูง')
    .replaceAll('Speculative / High Risk', 'เก็งกำไร / เสี่ยงสูง')
    .replaceAll('Breakout Watch', 'เฝ้าระวัง Breakout')
    .replaceAll('Buy Watch', 'เฝ้าดูจังหวะซื้อแบบมีเงื่อนไข')
    .replaceAll('Wait Pullback', 'รอย่อ / รอฐานใหม่')
    .replaceAll('Wait for Pullback', 'รอย่อ / รอฐานใหม่')
    .replaceAll('Speculative Trade', 'เทรดเก็งกำไร')
    .replaceAll('Speculative Only', 'เก็งกำไรเท่านั้น')
    .replaceAll('Avoid', 'ควรเลี่ยง')
    .replaceAll('Breakout Ready', 'พร้อม Breakout')
    .replaceAll('LOW', 'ต่ำ')
    .replaceAll('MEDIUM', 'ปานกลาง')
    .replaceAll('HIGH', 'สูง')
    .replaceAll('PASS', 'ผ่าน')
    .replaceAll('REVIEW', 'ต้องทบทวน')
    .replaceAll('BLOCK', 'ไม่ผ่าน')
    .replaceAll('Entry', 'จุดเข้า')
    .replaceAll('Stop', 'จุดตัดขาดทุน')
    .replaceAll('Target', 'เป้าหมาย')
    .replaceAll('Technical setup', 'โครงสร้างเทคนิค')
    .replaceAll('Catalyst', 'ปัจจัยเร่ง')
    .replaceAll('dilution/cash risk', 'ความเสี่ยงเพิ่มทุน/เงินสด')
    .replaceAll('No major warning', 'ยังไม่พบสัญญาณเตือนหลัก')
    .replaceAll('Technology', 'เทคโนโลยี')
    .replaceAll('Industrials', 'อุตสาหกรรม')
    .replaceAll('Energy', 'พลังงาน')
    .replaceAll('AI Back-End / Edge AI', 'AI Back-End / Edge AI')
    .replaceAll('AI Bottleneck / Optical Interconnect', 'AI Bottleneck / โครงข่ายแสง')
    .replaceAll('Power Infrastructure / Data Center Infrastructure', 'โครงสร้างพื้นฐานไฟฟ้า / ศูนย์ข้อมูล')
    .replaceAll('AI Robotics / Edge AI', 'หุ่นยนต์ AI / Edge AI')
};

export const USStockScreenerAnalyst = ({ onSelectSymbol }: { onSelectSymbol?: (symbol: string) => void }) => {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeFilter, setThemeFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [singleTicker, setSingleTicker] = useState('SOUN');
  const [singleAnalysis, setSingleAnalysis] = useState<SingleStockBreakoutSwingAnalysis | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const dailySectionRef = useRef<HTMLElement | null>(null);
  const tradingPlanSectionRef = useRef<HTMLElement | null>(null);
  const tableSectionRef = useRef<HTMLElement | null>(null);
  const riskSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const symbols = WATCHLIST_UNIVERSE.map(item => item.ticker).join(',');
        const [response, filingEvidence] = await Promise.all([
          apiFetch(`/api/proxy/us-stock-screener?symbols=${encodeURIComponent(symbols)}`),
          fetchFilingEvidence(WATCHLIST_UNIVERSE.map(item => item.ticker)).catch(() => new Map<string, FilingEvidenceItem>())
        ]);
        if (!response.ok) throw new Error('US stock screener data unavailable.');
        const payload = await response.json();
        if (cancelled) return;
        setRows(buildRows(payload, filingEvidence));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'US stock screener data unavailable.');
        setRows(buildRows([]));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => rows
    .filter(row => themeFilter === 'ALL' || row.theme.includes(themeFilter))
    .filter(row => `${row.ticker} ${row.companyName} ${row.theme}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.score - a.score), [rows, themeFilter, query]);

  const topThree = filteredRows.slice(0, 3);
  const dailyScanRows = useMemo(() => [...filteredRows]
    .sort((a, b) => {
      const statusWeight = (status: ScreenerRow['dailyScanStatus']) => status === 'PASS' ? 2 : status === 'REVIEW' ? 1 : 0;
      return statusWeight(b.dailyScanStatus) - statusWeight(a.dailyScanStatus) || b.score - a.score;
    })
    .slice(0, 10), [filteredRows]);
  const dailyTopThree = dailyScanRows.filter(row => row.dailyScanStatus === 'PASS').slice(0, 3);
  const dailyPassedCount = dailyScanRows.filter(row => row.dailyScanStatus === 'PASS').length;
  const smallCapRows = useMemo(() => [...filteredRows]
    .filter(row => row.theme.includes('AI Back-End') || row.theme.includes('AI Bottleneck') || row.theme.includes('AI Robotics'))
    .sort((a, b) => b.smallCap.score - a.smallCap.score)
    .slice(0, 10), [filteredRows]);
  const smallCapGroups = useMemo(() => ({
    breakoutReady: smallCapRows.filter(row => row.smallCap.group === 'Breakout Ready'),
    waitForPullback: smallCapRows.filter(row => row.smallCap.group === 'Wait for Pullback'),
    speculativeOnly: smallCapRows.filter(row => row.smallCap.group === 'Speculative Only')
  }), [smallCapRows]);
  const riskRows = [...filteredRows].sort((a, b) => b.warnings.length + b.missingData.length - (a.warnings.length + a.missingData.length)).slice(0, 5);
  const tradingPlanRows = useMemo(() => {
    return dailyScanRows
      .filter(row => row.finalView !== 'Avoid' && row.dailyScanStatus === 'PASS')
      .slice(0, 10)
      .map(row => ({ row, plan: buildTradingPlan(row) }));
  }, [dailyScanRows]);

  const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAnalyzeSingleStock = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const ticker = singleTicker.trim().toUpperCase();
    if (!ticker) return;
    setSingleLoading(true);
    setSingleError(null);
    try {
      const [response, researchResponse] = await Promise.all([
        apiFetch(`/api/proxy/us-stock-screener?symbols=${encodeURIComponent(ticker)}`),
        apiFetch(`/api/research/us-stock?symbol=${encodeURIComponent(ticker)}`).catch(() => null)
      ]);
      if (!response.ok) throw new Error('Single-stock data unavailable.');
      const payload = await response.json();
      const research = researchResponse?.ok ? await researchResponse.json() : null;
      setSingleAnalysis(buildSingleAnalysisFromPayload(payload, ticker, research));
    } catch (err) {
      setSingleError(err instanceof Error ? err.message : 'Single-stock data unavailable.');
      setSingleAnalysis(buildSingleAnalysisFromPayload([], ticker));
    } finally {
      setSingleLoading(false);
    }
  };

  return (
    <div className="font-sarabun-psk space-y-6 animate-in fade-in max-w-7xl mx-auto p-4 md:p-8 overflow-y-auto w-full pb-32">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-black">นักวิเคราะห์สแกนหุ้นสหรัฐ</div>
          <h2 className="text-2xl md:text-3xl font-black text-white mt-1 flex items-center gap-2">
            <Search className="w-7 h-7 text-cyan-400" />
            Watchlist หุ้นสหรัฐเชิงระบบ
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-4xl">
            Watchlist เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำลงทุนส่วนบุคคล ระบบคัดกรองธีมเติบโตพร้อมเชื่อมต่อเมนูวิเคราะห์กราฟเพื่อดู price action, risk/reward และฐานราคาเพิ่มเติม
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-200 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          รีเฟรชข้อมูล
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <InfoCard onClick={() => scrollToSection(dailySectionRef)} icon={<BarChart3 className="w-5 h-5" />} title="ภาพรวมตลาด" value={`${dailyPassedCount} ผ่านเกณฑ์จาก ${dailyScanRows.length} ตัว`} detail="Watchlist หุ้นสหรัฐที่อาจเกิด breakout ภายใน 1-4 สัปดาห์ในธีม AI infrastructure" />
        <InfoCard onClick={() => scrollToSection(tableSectionRef)} icon={<Target className="w-5 h-5" />} title="เกณฑ์รายวัน" value="RVOL > 1.5" detail="ราคา $1-$30, Market Cap $100M-$10B, RSI 50-75, อยู่เหนือ SMA20/SMA50, catalyst ไม่เกิน 30 วัน" />
        <InfoCard onClick={() => scrollToSection(riskSectionRef)} icon={<ShieldAlert className="w-5 h-5" />} title="นโยบายความเสี่ยง" value="ไม่ไล่ราคา" detail="RSI > 85 หรือราคาพุ่งแรงเกิน 50% ให้รอสร้างฐานใหม่ก่อน" />
        <InfoCard onClick={() => scrollToSection(tradingPlanSectionRef)} icon={<Database className="w-5 h-5" />} title="คุณภาพข้อมูล" value={error ? 'โหมดสำรอง' : loading ? 'กำลังโหลด' : 'เชื่อมต่อข้อมูลสด'} detail={error ? toThaiDisplay(error) : `ข้อมูลพื้นฐานที่ขาดจะแสดงเป็น ${DATA_REQUIRED_TH} แทนการเดา`} />
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหา ticker, บริษัท, ธีม..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
        />
        <select
          value={themeFilter}
          onChange={(event) => setThemeFilter(event.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
        >
          <option value="ALL">ทุกธีม</option>
          <option value="AI">ปัญญาประดิษฐ์</option>
          <option value="Semiconductor">เซมิคอนดักเตอร์</option>
          <option value="Memory">หน่วยความจำ</option>
          <option value="Optical">โครงข่ายแสง / Optical</option>
          <option value="Power">พลังงานและไฟฟ้า</option>
          <option value="Data Center">ศูนย์ข้อมูล</option>
          <option value="Defense">กลาโหม AI</option>
          <option value="Robotics">หุ่นยนต์</option>
        </select>
      </div>

      <section className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-white">วิเคราะห์หุ้นรายตัว: Breakout / Swing Trade</h3>
            <p className="text-sm text-slate-400 mt-1">
              ใส่ ticker เพื่อประเมินแบบมีเงื่อนไข ไม่ใช่คำแนะนำซื้อขายแบบฟันธง ระบบจะแยกเงื่อนไขที่ควรเข้า ควรรอ และควรเลี่ยง
            </p>
          </div>
          <form onSubmit={handleAnalyzeSingleStock} className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <input
              value={singleTicker}
              onChange={(event) => setSingleTicker(event.target.value.toUpperCase())}
              placeholder="ใส่ Ticker เช่น SOUN"
              className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 min-w-52"
            />
            <button
              type="submit"
              disabled={singleLoading}
              className="inline-flex items-center justify-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 border border-cyan-500/30 text-cyan-200 px-4 py-3 rounded-lg text-sm font-black transition-colors"
            >
              {singleLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              วิเคราะห์
            </button>
          </form>
        </div>
        {singleError && (
          <div className="mt-3 text-xs text-amber-300">โหมดข้อมูลสำรอง: {toThaiDisplay(singleError)}. ข้อมูลที่ขาดจะถูกระบุว่า {DATA_REQUIRED_TH} แทนการเดา</div>
        )}
        {singleAnalysis && <SingleStockAnalysisPanel analysis={singleAnalysis} onSelectSymbol={onSelectSymbol} />}
      </section>

      {loading ? (
        <div className="h-72 flex items-center justify-center border border-slate-800 rounded-lg bg-slate-950">
          <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
          <span className="ml-3 text-slate-400 text-sm font-bold">กำลังสแกนหุ้นสหรัฐ...</span>
        </div>
      ) : (
        <>
          <section ref={dailySectionRef} className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-5 scroll-mt-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">สแกนหุ้นสหรัฐรายวัน: Watchlist Breakout 1-4 สัปดาห์</h3>
                <p className="text-sm text-slate-400 mt-1">
                  สแกนรายวันสำหรับหุ้นธีม AI infrastructure ที่อาจเริ่มเร่งตัวใน 1-4 สัปดาห์ข้างหน้า เป็น watchlist เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำลงทุนส่วนบุคคล
                </p>
              </div>
              <div className="text-xs text-slate-400">
                ผ่าน {dailyScanRows.filter(row => row.dailyScanStatus === 'PASS').length} | ต้องทบทวน {dailyScanRows.filter(row => row.dailyScanStatus === 'REVIEW').length} | ไม่ผ่าน {dailyScanRows.filter(row => row.dailyScanStatus === 'BLOCK').length}
              </div>
            </div>
          </section>

          <section ref={tradingPlanSectionRef} className="bg-[#0B0F19] border border-emerald-500/20 rounded-lg overflow-hidden scroll-mt-6">
            <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-black">แผนเทรดหุ้นสหรัฐ</div>
                <h3 className="text-lg font-black text-white mt-1">แผนเทรดแบบบริหารความเสี่ยงสำหรับหุ้นที่ผ่าน Screener</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-4xl">
                  คำนวณ position size สำหรับพอร์ต $500, $1,000, $3,000 โดยใช้ความเสี่ยง 1%-2% ต่อเทรด, จำกัด microcap ไม่เกิน 2%, quality small-cap ไม่เกิน 5%, และห้ามถัวลงหลังหลุด stop-loss
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-300">
                <div className="border border-slate-800 rounded-lg p-2">$500</div>
                <div className="border border-slate-800 rounded-lg p-2">$1,000</div>
                <div className="border border-slate-800 rounded-lg p-2">$3,000</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500 uppercase">
                  <tr>
                    {['Ticker', 'เงื่อนไขเข้า', 'โซนซื้อ', 'Stop-loss', 'Target 1', 'Target 2', 'R:R', '$500', '$1,000', '$3,000', 'เงื่อนไขเพิ่มไม้', 'ขายทำกำไร', 'ตัดขาดทุน'].map(header => (
                      <th key={header} className="px-3 py-3 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tradingPlanRows.map(({ row, plan }) => (
                    <tr key={`trade-plan-${row.ticker}`} className="border-t border-slate-800 hover:bg-slate-900/60">
                      <td className="px-3 py-3">
                        <button className="font-black text-emerald-300 hover:text-white" onClick={() => onSelectSymbol?.(row.ticker)}>
                          {row.ticker}
                        </button>
                        <div className="text-[10px] text-slate-500">{toThaiDisplay(plan.finalView)}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-300 min-w-64">{toThaiDisplay(plan.entryTrigger)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-36">{toThaiDisplay(plan.buyZone)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(plan.stopLoss)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-28">{toThaiDisplay(plan.target1)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-28">{toThaiDisplay(plan.target2)}</td>
                      <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{toThaiDisplay(plan.riskReward)}</td>
                      {plan.positionSizes.map(size => (
                        <td key={`${row.ticker}-${size.portfolioValue}`} className="px-3 py-3 text-slate-300 min-w-40">
                          <UsPositionSizeCell plan={plan} portfolioSize={size.portfolioValue} />
                        </td>
                      ))}
                      <td className="px-3 py-3 text-slate-300 min-w-72">{toThaiDisplay(plan.addRule)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-72">{toThaiDisplay(plan.takeProfitRule)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-72">{toThaiDisplay(plan.cutLossRule)}</td>
                    </tr>
                  ))}
                  {tradingPlanRows.length === 0 && (
                    <tr>
                      <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                        ยังไม่มีหุ้นที่ผ่านเงื่อนไขสำหรับสร้างแผนเทรด
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section ref={tableSectionRef} className="bg-[#0B0F19] border border-slate-800 rounded-lg overflow-hidden scroll-mt-6">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-200">ตาราง Watchlist รายวัน Top 10</h3>
              <span className="text-[11px] text-slate-500">Ticker | บริษัท | ธีม | ราคา | มูลค่าตลาด | ปริมาณซื้อขาย | RVOL | RSI | รูปแบบกราฟ | ปัจจัยเร่ง | จุดเข้า | จุดตัดขาดทุน | เป้าหมาย | R/R | คะแนน | มุมมอง</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500 uppercase">
                  <tr>
                    {['Ticker', 'บริษัท', 'ธีม', 'ราคา', 'มูลค่าตลาด', 'ปริมาณซื้อขาย', 'Relative Volume', 'RSI', 'รูปแบบกราฟ', 'ปัจจัยเร่ง', 'โซนเข้า', 'Stop Loss', 'โซนเป้าหมาย', 'Risk/Reward', 'คะแนน', 'มุมมองสุดท้าย'].map(header => (
                      <th key={header} className="px-3 py-3 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyScanRows.map(row => (
                    <tr key={row.ticker} className="border-t border-slate-800 hover:bg-slate-900/60">
                      <td className="px-3 py-3">
                        <button className="font-black text-cyan-300 hover:text-white" onClick={() => onSelectSymbol?.(row.ticker)}>
                          {row.ticker}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-slate-300 min-w-40">{toThaiDisplay(row.companyName)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-40">{toThaiDisplay(row.theme)}</td>
                      <td className="px-3 py-3 text-white">{row.price === null ? DATA_REQUIRED_TH : `$${row.price.toFixed(2)}`}</td>
                      <td className="px-3 py-3 text-slate-300">{formatMoney(row.marketCap)}</td>
                      <td className="px-3 py-3 text-slate-300">{formatVolume(row.latestVolume ?? row.averageVolume)}</td>
                      <td className="px-3 py-3 text-slate-300">{formatNumber(row.relativeVolume, 2)}</td>
                      <td className={`px-3 py-3 ${row.rsi !== null && row.rsi > 85 ? 'text-rose-300' : 'text-slate-300'}`}>{formatNumber(row.rsi, 1)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-48">{toThaiDisplay(row.technicalPattern)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-56">
                        {toThaiDisplay(row.catalyst)} ({row.catalystAgeDays === null ? DATA_REQUIRED_TH : `${row.catalystAgeDays} วัน`})
                        {row.catalystSourceUrl && <a href={row.catalystSourceUrl} target="_blank" rel="noreferrer" className="block mt-1 text-[10px] text-cyan-300 hover:text-white">SEC source</a>}
                      </td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.entryZone)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.stopLossZone)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.targetZone)}</td>
                      <td className="px-3 py-3 text-slate-300">{toThaiDisplay(row.riskReward ?? DATA_REQUIRED_TH)}</td>
                      <td className="px-3 py-3"><ScoreBadge score={row.score} /></td>
                      <td className="px-3 py-3 text-slate-200 whitespace-nowrap">
                        <div>{toThaiDisplay(row.finalView)}</div>
                        <div className={`text-[10px] font-bold ${row.dailyScanStatus === 'PASS' ? 'text-emerald-300' : row.dailyScanStatus === 'REVIEW' ? 'text-amber-300' : 'text-rose-300'}`}>{toThaiDisplay(row.dailyScanStatus)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-200 mb-4">วิเคราะห์เชิงลึก Top 3: Setup รายวัน 1-4 สัปดาห์</h3>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {dailyTopThree.map(row => (
                <div key={row.ticker} className="border border-slate-800 rounded-lg p-4 bg-slate-950/40">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-xl font-black text-white">{row.ticker}</div>
                      <div className="text-xs text-slate-500">{row.companyName}</div>
                    </div>
                    <ScoreBadge score={row.score} />
                  </div>
                  <DeepDiveItem label="1. เหตุผลที่น่าจับตา" value={row.deepDive.watchReason} />
                  <DeepDiveItem label="2. โครงสร้างเทคนิค" value={toThaiDisplay(row.deepDive.technicalSetup)} />
                  <DeepDiveItem label="3. ปัจจัยเร่ง" value={toThaiDisplay(row.deepDive.catalyst)} />
                  <DeepDiveItem label="4. ความเสี่ยง" value={row.deepDive.risks} />
                  <DeepDiveItem label="5. จุดเข้าที่เหมาะสม" value={row.deepDive.entry} />
                  <DeepDiveItem label="6. จุดที่ไม่ควรไล่ราคา" value={row.deepDive.noChaseZone} />
                  <DeepDiveItem label="7. เงื่อนไขที่ทำให้ thesis ผิด" value={row.deepDive.thesisInvalidation} />
                  <button
                    onClick={() => onSelectSymbol?.(row.ticker)}
                    className="mt-4 w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 rounded-lg py-2 text-xs font-black transition-colors"
                  >
                    เปิดในเมนูวิเคราะห์กราฟ
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#0B0F19] border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-200">Watchlist หุ้นเล็กธีม AI สำหรับนักลงทุนงบน้อย</h3>
                <p className="text-xs text-slate-500 mt-1">เน้น $1-$15, market cap $100M-$3B, volume/RVOL ผ่านเกณฑ์, และฐาน AI Back-End / AI Bottleneck / AI Robotics</p>
              </div>
              <span className="text-[11px] text-slate-500">Position sizing เป็นกรอบความเสี่ยงเพื่อการศึกษา ไม่ใช่คำแนะนำลงทุนส่วนบุคคล</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500 uppercase">
                  <tr>
                    {['Ticker', 'ธีม', 'Pattern', 'เงื่อนไขเข้า', 'จุด Thesis ผิด', 'Stop-loss', 'เป้าหมายแรก', 'เป้าหมายสอง', 'ระดับความเสี่ยง', 'ขนาดไม้ที่แนะนำ', 'Score', 'มุมมองสุดท้าย'].map(header => (
                      <th key={header} className="px-3 py-3 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {smallCapRows.map(row => (
                    <tr key={`small-${row.ticker}`} className="border-t border-slate-800 hover:bg-slate-900/60">
                      <td className="px-3 py-3">
                        <button className="font-black text-cyan-300 hover:text-white" onClick={() => onSelectSymbol?.(row.ticker)}>
                          {row.ticker}
                        </button>
                        <div className={`text-[10px] font-bold ${row.smallCap.group === 'Breakout Ready' ? 'text-emerald-300' : row.smallCap.group === 'Wait for Pullback' ? 'text-amber-300' : 'text-rose-300'}`}>{toThaiDisplay(row.smallCap.group)}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.theme)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.technicalPattern)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-48">{toThaiDisplay(row.smallCap.entryTrigger)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-48">{toThaiDisplay(row.smallCap.invalidationPoint)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-36">{toThaiDisplay(row.smallCap.stopLoss)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-36">{toThaiDisplay(row.smallCap.firstTarget)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-36">{toThaiDisplay(row.smallCap.secondTarget)}</td>
                      <td className={`px-3 py-3 font-bold ${row.smallCap.riskLevel === 'HIGH' ? 'text-rose-300' : row.smallCap.riskLevel === 'MEDIUM' ? 'text-amber-300' : 'text-emerald-300'}`}>{toThaiDisplay(row.smallCap.riskLevel)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-72">{toThaiDisplay(row.smallCap.positionSizeSuggestion)}</td>
                      <td className="px-3 py-3"><ScoreBadge score={row.smallCap.score} /></td>
                      <td className="px-3 py-3 text-slate-200 whitespace-nowrap">{toThaiDisplay(row.smallCap.finalView)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SmallCapGroupPanel title="1. พร้อม Breakout" rows={smallCapGroups.breakoutReady} onSelectSymbol={onSelectSymbol} />
            <SmallCapGroupPanel title="2. รอย่อ / รอฐานใหม่" rows={smallCapGroups.waitForPullback} onSelectSymbol={onSelectSymbol} />
            <SmallCapGroupPanel title="3. เก็งกำไรเท่านั้น" rows={smallCapGroups.speculativeOnly} onSelectSymbol={onSelectSymbol} />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {topThree.map(row => (
              <div key={row.ticker} className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-white">{row.ticker}</h3>
                    <p className="text-xs text-slate-500 mt-1">{row.companyName}</p>
                  </div>
                  <ScoreBadge score={row.score} />
                </div>
                <div className="text-xs text-cyan-300 font-bold mt-4">{row.rank}</div>
                <p className="text-sm text-slate-300 mt-2">{row.catalyst}</p>
                <div className="grid grid-cols-3 gap-2 mt-4 text-[11px]">
                  <MiniMetric label="จุดเข้า" value={toThaiDisplay(row.entryZone)} />
                  <MiniMetric label="จุดตัดขาดทุน" value={toThaiDisplay(row.stopLossZone)} />
                  <MiniMetric label="เป้าหมาย" value={toThaiDisplay(row.targetZone)} />
                </div>
                <button
                  onClick={() => onSelectSymbol?.(row.ticker)}
                  className="mt-4 w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 rounded-lg py-2 text-xs font-black transition-colors"
                >
                  เปิดในเมนูวิเคราะห์กราฟ
                </button>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="วิเคราะห์รูปแบบกราฟเทคนิค" icon={<LineChart className="w-4 h-4" />}>
              {filteredRows.slice(0, 6).map(row => (
                <LineItem key={row.ticker} left={`${row.ticker} - ${row.technicalPattern}`} right={`RSI ${formatNumber(row.rsi, 1)} | RVOL ${formatNumber(row.relativeVolume, 2)}`} />
              ))}
            </Panel>
            <Panel title="สรุปพื้นฐานและปัจจัยเร่ง" icon={<TrendingUp className="w-4 h-4" />}>
              {filteredRows.slice(0, 6).map(row => (
                <LineItem key={row.ticker} left={`${row.ticker} - ${row.bucket}`} right={row.catalyst} />
              ))}
            </Panel>
          </section>

          <section ref={riskSectionRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4 scroll-mt-6">
            <Panel title="จัดอันดับความเสี่ยง" icon={<AlertTriangle className="w-4 h-4" />}>
              {riskRows.map(row => (
                <LineItem
                  key={row.ticker}
                  left={`${row.ticker} - ${row.cashDebtDilutionRisk} dilution/cash risk`}
                  right={toThaiDisplay([...row.warnings, ...row.missingData.slice(0, 2)].join(' | ') || 'No major warning')}
                />
              ))}
            </Panel>
            <Panel title="เช็กลิสต์ติดตาม" icon={<Target className="w-4 h-4" />}>
              <ul className="space-y-2 text-xs text-slate-300">
                <li>ยืนยันว่าราคายังยืนเหนือ SMA20/SMA50 และไม่ล้มเหลวตอน retest หลัง breakout</li>
                <li>วัน breakout ควรมี Relative Volume มากกว่า 1.5 ไม่ใช่แค่ราคากระชากจากหุ้นสภาพคล่องต่ำ</li>
                <li>ตรวจ 10-Q/10-K ล่าสุดเรื่อง cash runway, หนี้ครบกำหนด, ATM offering และ going concern</li>
                <li>ไม่ไล่ราคาหุ้นที่ขึ้นเกิน 50% ในไม่กี่วัน ควรรอฐานใหม่ก่อน</li>
                <li>กด ticker ที่สนใจไปเมนูวิเคราะห์กราฟเพื่อตรวจจุดเข้า stop target และ exposure ของพอร์ตอีกครั้ง</li>
              </ul>
            </Panel>
          </section>
        </>
      )}
    </div>
  );
};

function buildRows(payload: any[], filingEvidence = new Map<string, FilingEvidenceItem>()): ScreenerRow[] {
  return WATCHLIST_UNIVERSE.map(meta => {
    const item = payload.find(entry => entry.symbol === meta.ticker);
    const candles = Array.isArray(item?.candles) ? item.candles : [];
    const closes = candles.map((candle: any) => Number(candle.close)).filter(Number.isFinite);
    const volumes = candles.map((candle: any) => Number(candle.volume)).filter(Number.isFinite);
    const price = numberOrNull(item?.quote?.regularMarketPrice ?? closes[closes.length - 1]);
    const averageVolume = numberOrNull(item?.quote?.averageDailyVolume3Month ?? average(volumes.slice(-60)));
    const latestVolume = numberOrNull(item?.quote?.regularMarketVolume ?? volumes[volumes.length - 1]);
    const relativeVolume = latestVolume !== null && averageVolume !== null && averageVolume > 0 ? latestVolume / averageVolume : null;
    const rsi = closes.length >= 15 ? computeRsi(closes, 14) : null;
    const sma20 = sma(closes, 20);
    const sma50 = numberOrNull(item?.quote?.fiftyDayAverage ?? sma(closes, 50));
    const sma200 = numberOrNull(item?.quote?.twoHundredDayAverage ?? sma(closes, 200));
    const high52 = numberOrNull(item?.quote?.fiftyTwoWeekHigh ?? max(closes));
    const distanceFrom52WeekHighPercent = price !== null && high52 !== null && high52 > 0 ? ((high52 - price) / high52) * 100 : null;
    const recentRunUpPercent = closes.length >= 5 ? ((closes[closes.length - 1] - closes[closes.length - 5]) / Math.max(Math.abs(closes[closes.length - 5]), 1)) * 100 : null;
    const patternReport = detectCandlePatterns(candles);
    const candlePattern = patternReport.primaryPattern === 'Pattern requires manual confirmation'
      ? meta.pattern
      : `${patternReport.patternSummary} / ${meta.pattern}`;
    const filing = filingEvidence.get(meta.ticker);
    const verifiedCatalyst = describeMaterialFiling(filing, meta.catalyst);
    const dilutionRisk = filing?.dilution && filing.dilution.ageDays <= 180 ? 'HIGH' : 'UNKNOWN';

    const candidateInput = {
      ticker: meta.ticker,
      companyName: item?.quote?.shortName ?? null,
      exchange: item?.quote?.exchange ?? null,
      sector: meta.sector,
      theme: meta.theme,
      price,
      marketCap: numberOrNull(item?.quote?.marketCap),
      averageVolume,
      relativeVolume,
      rsi,
      sma20Status: price !== null && sma20 !== null ? price >= sma20 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
      sma50Status: price !== null && sma50 !== null ? price >= sma50 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
      sma200Status: price !== null && sma200 !== null ? price >= sma200 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
      distanceFrom52WeekHighPercent,
      catalyst: verifiedCatalyst.catalyst,
      catalystAgeDays: verifiedCatalyst.catalystAgeDays,
      revenueGrowth: null,
      earningsTrend: 'UNKNOWN',
      cashDebtDilutionRisk: dilutionRisk,
      technicalPattern: candlePattern,
      recentRunUpPercent,
      sectorRotation: meta.theme.includes('AI') || meta.theme.includes('Nuclear') ? 'LEADING' : 'NEUTRAL'
    } as const;

    const scored = scoreUsStockScreenerAnalystCandidate(candidateInput);
    const dailyScan = evaluateDailyUsStockScan(candidateInput);
    const smallCap = evaluateSmallCapAiWatchlist(candidateInput);
    const companyName = item?.quote?.shortName ?? 'Data required';

    return {
      ...scored,
      companyName,
      sector: meta.sector,
      theme: meta.theme,
      price,
      marketCap: numberOrNull(item?.quote?.marketCap),
      averageVolume,
      latestVolume,
      relativeVolume,
      rsi,
      sma20Status: price !== null && sma20 !== null ? price >= sma20 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
      sma50Status: price !== null && sma50 !== null ? price >= sma50 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
      sma200Status: price !== null && sma200 !== null ? price >= sma200 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
      distanceFrom52WeekHighPercent,
      catalyst: verifiedCatalyst.catalyst,
      catalystAgeDays: verifiedCatalyst.catalystAgeDays,
      catalystSourceUrl: filing?.material?.sourceUrl ?? null,
      revenueGrowth: null,
      earningsTrend: 'UNKNOWN',
      cashDebtDilutionRisk: dilutionRisk,
      technicalPattern: candlePattern,
      dailyScanStatus: dailyScan.status,
      dailyFailedCriteria: dailyScan.failedCriteria,
      matchedPatterns: dailyScan.matchedPatterns,
      warnings: Array.from(new Set([...scored.warnings, ...patternReport.warnings])),
      deepDive: buildDeepDive({
        ticker: meta.ticker,
        companyName,
        theme: meta.theme,
        catalyst: verifiedCatalyst.catalyst,
        pattern: candlePattern,
        score: scored.score,
        entryZone: scored.entryZone,
        stopLossZone: scored.stopLossZone,
        targetZone: scored.targetZone,
        warnings: Array.from(new Set([...scored.warnings, ...patternReport.warnings])),
        failedCriteria: dailyScan.failedCriteria,
        matchedPatterns: dailyScan.matchedPatterns,
        rsi,
        relativeVolume,
        recentRunUpPercent
      }),
      smallCap: {
        status: smallCap.status,
        group: smallCap.group,
        score: smallCap.score,
        entryTrigger: buildSmallCapEntryTrigger(price, candlePattern),
        invalidationPoint: buildSmallCapInvalidation(price),
        stopLoss: price !== null ? `$${(price * 0.91).toFixed(2)}-$${(price * 0.94).toFixed(2)}` : 'Data required',
        firstTarget: price !== null ? `$${(price * 1.15).toFixed(2)}` : 'Data required',
        secondTarget: price !== null ? `$${(price * 1.3).toFixed(2)}` : 'Data required',
        riskLevel: smallCap.group === 'Speculative Only' || smallCap.warnings.length > 0 ? 'HIGH' : smallCap.group === 'Wait for Pullback' ? 'MEDIUM' : 'LOW',
        positionSizeSuggestion: smallCap.positionSizeSuggestion,
        finalView: smallCap.finalView,
        warnings: smallCap.warnings
      }
    };
  });
}

function buildTradingPlan(row: ScreenerRow): UsStockTradingPlan {
  return buildUsStockTradingPlan({
    ticker: row.ticker,
    price: row.price,
    marketCap: row.marketCap,
    averageVolume: row.averageVolume,
    rsi: row.rsi,
    score: row.score,
    finalView: row.finalView,
    dailyScanStatus: row.dailyScanStatus,
    smallCapGroup: row.smallCap.group,
    smallCapRiskLevel: row.smallCap.riskLevel,
    entryZone: row.entryZone,
    stopLossZone: row.stopLossZone,
    targetZone: row.targetZone,
    riskReward: row.riskReward,
    warnings: [...row.warnings, ...row.smallCap.warnings]
  });
}

function buildSingleAnalysisFromPayload(payload: any[], ticker: string, research: any = null): SingleStockBreakoutSwingAnalysis {
  const item = payload.find(entry => entry.symbol === ticker);
  const candles = Array.isArray(item?.candles) ? item.candles : [];
  const closes = candles.map((candle: any) => Number(candle.close)).filter(Number.isFinite);
  const lows = candles.map((candle: any) => Number(candle.low)).filter(Number.isFinite);
  const highs = candles.map((candle: any) => Number(candle.high)).filter(Number.isFinite);
  const volumes = candles.map((candle: any) => Number(candle.volume)).filter(Number.isFinite);
  const price = numberOrNull(item?.quote?.regularMarketPrice ?? closes[closes.length - 1]);
  const averageVolume = numberOrNull(item?.quote?.averageDailyVolume3Month ?? average(volumes.slice(-60)));
  const latestVolume = numberOrNull(item?.quote?.regularMarketVolume ?? volumes[volumes.length - 1]);
  const relativeVolume = latestVolume !== null && averageVolume !== null && averageVolume > 0 ? latestVolume / averageVolume : null;
  const rsi = closes.length >= 15 ? computeRsi(closes, 14) : null;
  const sma20 = sma(closes, 20);
  const sma50 = numberOrNull(item?.quote?.fiftyDayAverage ?? sma(closes, 50));
  const sma200 = numberOrNull(item?.quote?.twoHundredDayAverage ?? sma(closes, 200));
  const high52 = numberOrNull(item?.quote?.fiftyTwoWeekHigh ?? max(closes));
  const distanceFrom52WeekHighPercent = price !== null && high52 !== null && high52 > 0 ? ((high52 - price) / high52) * 100 : null;
  const recentRunUpPercent = closes.length >= 5 ? ((closes[closes.length - 1] - closes[closes.length - 5]) / Math.max(Math.abs(closes[closes.length - 5]), 1)) * 100 : null;
  const supportLevel = lows.length > 0 ? Math.min(...lows.slice(-20)) : null;
  const resistanceLevel = highs.length > 0 ? Math.max(...highs.slice(-20)) : null;
  const patternReport = detectCandlePatterns(candles);
  const fallbackPattern = inferPatternFromChart({ closes, volumes, price, sma20, sma50, distanceFrom52WeekHighPercent });
  const pattern = patternReport.primaryPattern === 'Pattern requires manual confirmation'
    ? fallbackPattern
    : patternReport.patternSummary;
  const filingEvidence = research?.filingEvidence as FilingEvidenceItem | undefined;
  const verifiedCatalyst = describeMaterialFiling(filingEvidence, 'Latest catalyst requires verification from timestamped news, filings, earnings, contracts, or product updates.');
  const dilutionRisk = filingEvidence?.dilution && filingEvidence.dilution.ageDays <= 180 ? 'HIGH' : 'UNKNOWN';

  return analyzeSingleStockBreakoutSwing({
    ticker,
    companyName: item?.quote?.shortName ?? research?.sec?.company ?? null,
    exchange: item?.quote?.exchange ?? null,
    sector: 'Data required',
    theme: inferThemeFromTicker(ticker),
    price,
    marketCap: numberOrNull(item?.quote?.marketCap),
    averageVolume,
    latestVolume,
    relativeVolume,
    rsi,
    sma20Status: price !== null && sma20 !== null ? price >= sma20 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
    sma50Status: price !== null && sma50 !== null ? price >= sma50 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
    sma200Status: price !== null && sma200 !== null ? price >= sma200 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
    distanceFrom52WeekHighPercent,
    catalyst: verifiedCatalyst.catalyst,
    catalystAgeDays: verifiedCatalyst.catalystAgeDays,
    revenueGrowth: null,
    earningsTrend: 'UNKNOWN',
    cashDebtDilutionRisk: dilutionRisk,
    technicalPattern: pattern,
    recentRunUpPercent,
    sectorRotation: 'UNKNOWN',
    supportLevel,
    resistanceLevel
  });
}

function inferThemeFromTicker(ticker: string): string {
  const known = WATCHLIST_UNIVERSE.find(item => item.ticker === ticker);
  return known?.theme ?? 'Custom ticker / Theme requires analyst verification';
}

function inferPatternFromChart(input: {
  closes: number[];
  volumes: number[];
  price: number | null;
  sma20: number | null;
  sma50: number | null;
  distanceFrom52WeekHighPercent: number | null;
}): string {
  const recent = input.closes.slice(-20);
  const earlier = input.closes.slice(-50, -20);
  const recentRange = recent.length > 1 ? (Math.max(...recent) - Math.min(...recent)) / Math.max(Math.abs(recent[0]), 1) : null;
  const earlierRange = earlier.length > 1 ? (Math.max(...earlier) - Math.min(...earlier)) / Math.max(Math.abs(earlier[0]), 1) : null;
  const recentVolume = average(input.volumes.slice(-10));
  const priorVolume = average(input.volumes.slice(-40, -10));
  const volumeDryUp = recentVolume !== null && priorVolume !== null && recentVolume < priorVolume * 0.8;

  if (recentRange !== null && earlierRange !== null && recentRange < earlierRange * 0.65) return volumeDryUp ? 'VCP / Volume Dry-Up' : 'VCP';
  if (input.distanceFrom52WeekHighPercent !== null && input.distanceFrom52WeekHighPercent <= 12) return 'Base near 52-week high / Breakout Retest watch';
  if (input.price !== null && input.sma20 !== null && input.sma50 !== null && input.price > input.sma20 && input.price > input.sma50) return 'Bull Flag / Breakout Watch';
  return 'Pattern requires manual chart confirmation';
}

function buildSmallCapEntryTrigger(price: number | null, pattern: string): string {
  if (price === null) return 'Data required';
  if (/retest/i.test(pattern)) return `Reclaim/retest hold above $${(price * 0.98).toFixed(2)} with RVOL > 1.5`;
  if (/vcp|triangle|cup|flag/i.test(pattern)) return `Break above base pivot near $${(price * 1.03).toFixed(2)} with volume expansion`;
  return `Wait for close above $${(price * 1.03).toFixed(2)} and no failed breakout`;
}

function buildSmallCapInvalidation(price: number | null): string {
  if (price === null) return 'Data required';
  return `Close below $${(price * 0.9).toFixed(2)} or loss of SMA20/SMA50 reclaim`;
}

function buildDeepDive(input: {
  ticker: string;
  companyName: string;
  theme: string;
  catalyst: string;
  pattern: string;
  score: number;
  entryZone: string;
  stopLossZone: string;
  targetZone: string;
  warnings: string[];
  failedCriteria: string[];
  matchedPatterns: string[];
  rsi: number | null;
  relativeVolume: number | null;
  recentRunUpPercent: number | null;
}) {
  const riskText = input.warnings.length > 0
    ? input.warnings.join(' | ')
    : input.failedCriteria.length > 0
      ? `ยังมีเงื่อนไขที่ต้องติดตาม: ${input.failedCriteria.slice(0, 3).join(', ')}`
      : 'ความเสี่ยงหลักคือ breakout fail, liquidity แห้ง, catalyst ไม่ต่อเนื่อง หรือ sector rotation พลิกกลับ';

  return {
    watchReason: `${input.ticker} อยู่ในธีม ${input.theme} และมีคะแนน daily scan ${input.score}/100 สำหรับ watchlist 1-4 สัปดาห์`,
    technicalSetup: `${input.pattern}; patterns detected: ${input.matchedPatterns.join(', ') || 'ต้องยืนยัน pattern เพิ่ม'}; RSI ${formatNumber(input.rsi, 1)} และ RVOL ${formatNumber(input.relativeVolume, 2)}`,
    catalyst: `${input.catalyst} ต้องตรวจข่าว/filing ล่าสุดซ้ำก่อนใช้เงินจริง เพราะระบบไม่เดาข้อมูลที่ขาด`,
    risks: riskText,
    entry: input.entryZone,
    noChaseZone: input.recentRunUpPercent !== null && input.recentRunUpPercent > 50
      ? 'ไม่ควรไล่ราคา เพราะขึ้นเกิน 50% ใน 5 วัน ควรรอฐานใหม่หรือ retest ที่ volume แห้ง'
      : 'ไม่ควรไล่เมื่อราคาหลุด entry framework มากกว่า 3-5% หรือ RSI เร่งเกิน 75 โดยไม่มีฐานใหม่',
    thesisInvalidation: `Thesis ผิดถ้าราคาหลุด ${input.stopLossZone}, RVOL หาย, catalyst ไม่ต่อเนื่อง หรือราคากลับลงใต้ SMA20/SMA50`
  };
}

const InfoCard: React.FC<{ icon: React.ReactNode; title: string; value: string; detail: string; onClick?: () => void }> = ({ icon, title, value, detail, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left bg-[#0B0F19] border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/60 rounded-lg p-4 transition-colors"
  >
    <div className="flex items-center gap-2 text-cyan-300 mb-3">{icon}<span className="text-[10px] uppercase tracking-widest font-black">{title}</span></div>
    <div className="text-lg font-black text-white">{toThaiDisplay(value)}</div>
    <div className="text-xs text-slate-500 mt-1">{toThaiDisplay(detail)}</div>
  </button>
);

const Panel: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5">
    <h3 className="text-sm font-black uppercase tracking-widest text-slate-200 mb-4 flex items-center gap-2">{icon}{title}</h3>
    <div className="space-y-3">{children}</div>
  </div>
);

const LineItem: React.FC<{ left: string; right: string }> = ({ left, right }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 border-b border-slate-800 pb-2 last:border-0">
    <div className="text-xs font-bold text-white">{toThaiDisplay(left)}</div>
    <div className="text-xs text-slate-400 sm:text-right max-w-xl">{toThaiDisplay(right)}</div>
  </div>
);

const DeepDiveItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border-b border-slate-800 py-2 last:border-0">
    <div className="text-[10px] uppercase tracking-wider text-cyan-300 font-black">{label}</div>
    <div className="text-xs text-slate-300 mt-1 leading-relaxed">{toThaiDisplay(value)}</div>
  </div>
);

const SmallCapGroupPanel: React.FC<{ title: string; rows: ScreenerRow[]; onSelectSymbol?: (symbol: string) => void }> = ({ title, rows, onSelectSymbol }) => (
  <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5">
    <h3 className="text-sm font-black uppercase tracking-widest text-slate-200 mb-4">{title}</h3>
    {rows.length === 0 ? (
      <div className="text-xs text-slate-500">ยังไม่มีหุ้นในกลุ่มนี้ตามข้อมูลปัจจุบัน</div>
    ) : (
      <div className="space-y-3">
        {rows.map(row => (
          <button
            key={`${title}-${row.ticker}`}
            onClick={() => onSelectSymbol?.(row.ticker)}
            className="w-full text-left border border-slate-800 hover:border-cyan-500/40 rounded-lg p-3 bg-slate-950/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-black text-white">{row.ticker}</div>
              <ScoreBadge score={row.smallCap.score} />
            </div>
            <div className="text-xs text-slate-400 mt-1">{toThaiDisplay(row.technicalPattern)}</div>
            <div className="text-[11px] text-slate-500 mt-2">{toThaiDisplay(row.smallCap.entryTrigger)}</div>
            {row.smallCap.warnings.length > 0 && (
              <div className="text-[11px] text-rose-300 mt-2">{toThaiDisplay(row.smallCap.warnings.slice(0, 2).join(' | '))}</div>
            )}
          </button>
        ))}
      </div>
    )}
  </div>
);

const SingleStockAnalysisPanel: React.FC<{ analysis: SingleStockBreakoutSwingAnalysis; onSelectSymbol?: (symbol: string) => void }> = ({ analysis, onSelectSymbol }) => (
  <div className="mt-5 border border-slate-800 rounded-lg bg-slate-950/40 overflow-hidden">
    <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-black">วิเคราะห์หุ้นรายตัว Breakout / Swing Trade</div>
        <h4 className="text-2xl font-black text-white mt-1">{analysis.ticker}</h4>
        <p className="text-xs text-slate-400 mt-1">ไม่ใช่คำแนะนำลงทุนส่วนบุคคล ใช้เป็น framework เพื่อรอ confirmation, pullback หรือหลีกเลี่ยงตามเงื่อนไข</p>
      </div>
      <div className="flex items-center gap-3">
        <ScoreBadge score={analysis.score} />
        <span className={`text-xs font-black px-3 py-2 rounded border ${analysis.finalView === 'Breakout Watch' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' : analysis.finalView === 'Avoid' ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'}`}>
          {toThaiDisplay(analysis.finalView)}
        </span>
        <button
          onClick={() => onSelectSymbol?.(analysis.ticker)}
          className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 rounded-lg px-3 py-2 text-xs font-black transition-colors"
        >
          เปิดกราฟ
        </button>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
      <AnalysisBlock title="1. ภาพรวมธุรกิจ" value={analysis.businessOverview} />
      <AnalysisBlock title="2. ความเกี่ยวข้องกับธีม" value={analysis.themeRelevance} />
      <AnalysisBlock title="3. ปัจจัยเร่งล่าสุด" value={analysis.latestCatalyst} />
      <AnalysisBlock title="4. แนวโน้มรายได้ / กำไร" value={analysis.revenueEarningsTrend} />
      <AnalysisBlock title="5. ความเสี่ยง Cash / Debt / Dilution" value={analysis.cashDebtDilutionRisk} />
      <div className="border border-slate-800 rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-black mb-3">6. โครงสร้างเทคนิค</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(analysis.technicalSetup).map(([key, value]) => (
            <div key={key} className="bg-slate-900/60 rounded p-2">
              <div className="text-[10px] uppercase text-slate-500">{key}</div>
              <div className="text-slate-200 mt-1">{value}</div>
            </div>
          ))}
        </div>
      </div>
      <AnalysisBlock title="7. โซนเข้า" value={analysis.entryZone} />
      <AnalysisBlock title="8. โซน Stop-loss" value={analysis.stopLossZone} />
      <AnalysisBlock title="9. โซนเป้าหมาย" value={analysis.targetZone} />
      <AnalysisBlock title="10. Risk/Reward" value={analysis.riskReward === null ? DATA_REQUIRED_TH : `${analysis.riskReward}:1 กรอบประเมินเบื้องต้น`} />
      <AnalysisBlock title="11. ถ้าราคาวิ่งแรงแล้ว ควรรอฐานใหม่ตรงไหน" value={analysis.noChaseBase} />
      <AnalysisBlock title="12-13. คะแนน / มุมมองสุดท้าย" value={`${analysis.score}/100 | ${toThaiDisplay(analysis.finalView)}`} />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 border-t border-slate-800">
      <ConditionList title="เงื่อนไขที่ควรเข้า" items={analysis.enterConditions} tone="green" />
      <ConditionList title="เงื่อนไขที่ควรรอ" items={analysis.waitConditions} tone="amber" />
      <ConditionList title="เงื่อนไขที่ควรเลี่ยง" items={analysis.avoidConditions} tone="red" />
    </div>
    {(analysis.missingData.length > 0 || analysis.warnings.length > 0) && (
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
        <span className="font-black text-amber-300">หมายเหตุข้อมูล/ความเสี่ยง:</span> {toThaiDisplay([...analysis.missingData, ...analysis.warnings].slice(0, 8).join(' | '))}
      </div>
    )}
  </div>
);

const AnalysisBlock: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/30">
    <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-black">{title}</div>
    <div className="text-xs text-slate-300 mt-2 leading-relaxed">{toThaiDisplay(value)}</div>
  </div>
);

const ConditionList: React.FC<{ title: string; items: string[]; tone: 'green' | 'amber' | 'red' }> = ({ title, items, tone }) => (
  <div className="border border-slate-800 rounded-lg p-4">
    <div className={`text-[10px] uppercase tracking-widest font-black mb-3 ${tone === 'green' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-rose-300'}`}>{title}</div>
    <ul className="space-y-2 text-xs text-slate-300">
      {items.map(item => <li key={item}>{toThaiDisplay(item)}</li>)}
    </ul>
  </div>
);

const MiniMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 min-h-20">
    <div className="text-[10px] uppercase text-slate-500 font-bold">{label}</div>
    <div className="text-[11px] text-slate-300 mt-1">{toThaiDisplay(value)}</div>
  </div>
);

const UsPositionSizeCell: React.FC<{ plan: UsStockTradingPlan; portfolioSize: number }> = ({ plan, portfolioSize }) => {
  const size = plan.positionSizes.find(item => item.portfolioValue === portfolioSize);
  if (!size || size.shares === null || size.dollars === null || size.maxLossDollars === null) {
    return <div className="text-amber-300">ต้องการข้อมูลเพิ่ม / ยังไม่เข้า</div>;
  }

  return (
    <div className="space-y-1">
      <div className="font-bold text-white">{size.shares} sh / ${size.dollars.toFixed(2)}</div>
      <div className="text-[10px] text-slate-500">เสี่ยง ${size.maxLossDollars.toFixed(2)} | งบเสี่ยง ${size.riskBudgetLow.toFixed(2)}-${size.riskBudgetHigh.toFixed(2)}</div>
      <div className="text-[10px] text-slate-500">Cap {(size.allocationCapPercent * 100).toFixed(1)}%</div>
    </div>
  );
};

const ScoreBadge: React.FC<{ score: number }> = ({ score }) => (
  <span className={`inline-flex items-center justify-center min-w-12 px-2 py-1 rounded border text-xs font-black ${
    score >= 85 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
      score >= 75 ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' :
        score >= 65 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
          score >= 50 ? 'bg-orange-500/10 text-orange-300 border-orange-500/30' :
            'bg-rose-500/10 text-rose-300 border-rose-500/30'
  }`}>{score}</span>
);

function numberOrNull(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return average(values.slice(-period));
}

function max(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.max(...values);
}

function computeRsi(values: number[], period: number): number {
  const slice = values.slice(-(period + 1));
  let gains = 0;
  let losses = 0;
  for (let index = 1; index < slice.length; index += 1) {
    const delta = slice[index] - slice[index - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }
  const averageGain = gains / period;
  const averageLoss = losses / period;
  if (averageLoss === 0) return 100;
  const rs = averageGain / averageLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}
