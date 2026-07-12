import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Cpu, Database, Gauge, LineChart, RefreshCw, Search, Zap } from 'lucide-react';
import { scoreAiBottleneckCandidate, type AiBottleneckCategory, type AiBottleneckGroup, type AiBottleneckScore } from '../domain/strategy/aiBottleneckScreener';
import { buildAiBottleneckTradingPlan, type AiBottleneckTradingPlan } from '../domain/strategy/aiBottleneckTradingPlan';
import { detectCandlePatterns } from '../domain/market/candlePatternEngine';
import { evaluateAiBottleneckDailyEligibility, evaluateAiBottleneckSmallMidEligibility } from '../domain/strategy/aiBottleneckEligibility';
import { apiFetch } from '../lib/apiClient';
import { describeMaterialFiling, fetchFilingEvidence, type FilingEvidenceItem } from '../lib/researchClient';

type BottleneckMeta = {
  ticker: string;
  companyName: string;
  category: AiBottleneckCategory;
  catalyst: string;
  catalystAgeDays: number | null;
  backlogOrContract: string;
  revenueGrowth: number | null;
  grossMarginTrend: 'EXPANDING' | 'STABLE' | 'COMPRESSING' | 'UNKNOWN';
  netIncomeTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNKNOWN';
  freeCashFlow: number | null;
  cashDebtProfile: 'NET_CASH' | 'MANAGEABLE' | 'LEVERED' | 'UNKNOWN';
  dilutionRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  valuation: { ps: number | null; pe: number | null; evSales: number | null };
  pattern: string;
};

type BottleneckRow = AiBottleneckScore & {
  marketCap: number | null;
  price: number | null;
  averageVolume: number | null;
  relativeVolume: number | null;
  revenueGrowth: number | null;
  grossMarginTrend: string;
  netIncomeTrend: string;
  freeCashFlow: number | null;
  cashDebtProfile: string;
  backlogOrContract: string;
  catalyst: string;
  catalystAgeDays: number | null;
  catalystSourceUrl: string | null;
  valuation: { ps: number | null; pe: number | null; evSales: number | null };
  technical: {
    sma20: string;
    sma50: string;
    sma200: string;
    rsi: number | null;
    relativeStrength: number | null;
    monthlyRunUpPercent: number | null;
    distanceFrom52WeekHigh: number | null;
    pattern: string;
  };
};

type SmallMidGroup = 'Breakout Ready' | 'Wait Pullback' | 'Early Accumulation' | 'Speculative Only' | 'Avoid / Too Extended';

const BOTTLENECK_UNIVERSE: BottleneckMeta[] = [
  { ticker: 'CRDO', companyName: 'Credo Technology', category: 'Optical Interconnect / Photonics', catalyst: 'AI networking demand and optical interconnect design-win watch.', catalystAgeDays: 10, backlogOrContract: 'AI data center connectivity backlog and hyperscaler demand watch.', revenueGrowth: 35, grossMarginTrend: 'EXPANDING', netIncomeTrend: 'IMPROVING', freeCashFlow: null, cashDebtProfile: 'MANAGEABLE', dilutionRisk: 'LOW', valuation: { ps: 18, pe: null, evSales: 17 }, pattern: 'Base near 52-week high / Breakout Retest' },
  { ticker: 'POET', companyName: 'POET Technologies', category: 'Optical Interconnect / Photonics', catalyst: 'Photonics platform and optical engine commercialization watch.', catalystAgeDays: 16, backlogOrContract: 'Optical engine capacity and customer qualification thesis.', revenueGrowth: null, grossMarginTrend: 'UNKNOWN', netIncomeTrend: 'UNKNOWN', freeCashFlow: -25_000_000, cashDebtProfile: 'MANAGEABLE', dilutionRisk: 'MEDIUM', valuation: { ps: null, pe: null, evSales: null }, pattern: 'VCP / Volume Dry-Up' },
  { ticker: 'AEHR', companyName: 'Aehr Test Systems', category: 'Advanced Packaging / Testing', catalyst: 'Semiconductor test equipment cycle recovery watch.', catalystAgeDays: 24, backlogOrContract: 'Wafer-level test capacity for advanced semiconductor supply chain.', revenueGrowth: 10, grossMarginTrend: 'STABLE', netIncomeTrend: 'STABLE', freeCashFlow: 8_000_000, cashDebtProfile: 'NET_CASH', dilutionRisk: 'LOW', valuation: { ps: 6, pe: 28, evSales: 5 }, pattern: 'Cup with Handle / Volume Dry-Up' },
  { ticker: 'NVTS', companyName: 'Navitas Semiconductor', category: 'Power Management / Cooling / Grid Infrastructure', catalyst: 'Power efficiency demand for AI and data center infrastructure watch.', catalystAgeDays: 11, backlogOrContract: 'Power management design-win pipeline for AI infrastructure.', revenueGrowth: 22, grossMarginTrend: 'STABLE', netIncomeTrend: 'IMPROVING', freeCashFlow: -40_000_000, cashDebtProfile: 'MANAGEABLE', dilutionRisk: 'MEDIUM', valuation: { ps: 9, pe: null, evSales: 8 }, pattern: 'Breakout Retest / Bull Flag' },
  { ticker: 'WULF', companyName: 'TeraWulf', category: 'AI Data Center Conversion', catalyst: 'Power-backed compute/data center conversion watch.', catalystAgeDays: 14, backlogOrContract: 'Power capacity and data center conversion optionality.', revenueGrowth: 28, grossMarginTrend: 'STABLE', netIncomeTrend: 'IMPROVING', freeCashFlow: null, cashDebtProfile: 'LEVERED', dilutionRisk: 'MEDIUM', valuation: { ps: 7, pe: null, evSales: 8 }, pattern: 'High Tight Flag / Base required' },
  { ticker: 'CORZ', companyName: 'Core Scientific', category: 'Neo Cloud / GPU Cloud / Compute Capacity', catalyst: 'AI compute hosting and capacity contract watch.', catalystAgeDays: 20, backlogOrContract: 'Long-duration AI compute hosting contract and capacity expansion.', revenueGrowth: 20, grossMarginTrend: 'STABLE', netIncomeTrend: 'IMPROVING', freeCashFlow: null, cashDebtProfile: 'LEVERED', dilutionRisk: 'MEDIUM', valuation: { ps: 5, pe: null, evSales: 6 }, pattern: 'Bull Flag / Breakout Retest' },
  { ticker: 'IREN', companyName: 'IREN', category: 'AI Data Center Conversion', catalyst: 'Data center power and AI cloud expansion watch.', catalystAgeDays: 18, backlogOrContract: 'Power pipeline for AI cloud/data center conversion.', revenueGrowth: 30, grossMarginTrend: 'EXPANDING', netIncomeTrend: 'IMPROVING', freeCashFlow: null, cashDebtProfile: 'MANAGEABLE', dilutionRisk: 'MEDIUM', valuation: { ps: 8, pe: null, evSales: 8 }, pattern: 'VCP / Base near 52-week high' },
  { ticker: 'SOUN', companyName: 'SoundHound AI', category: 'Edge AI / Robotics Infrastructure', catalyst: 'Enterprise voice AI and edge inference adoption watch.', catalystAgeDays: 12, backlogOrContract: 'Enterprise AI deployment and product adoption pipeline.', revenueGrowth: 45, grossMarginTrend: 'EXPANDING', netIncomeTrend: 'IMPROVING', freeCashFlow: -60_000_000, cashDebtProfile: 'MANAGEABLE', dilutionRisk: 'MEDIUM', valuation: { ps: 16, pe: null, evSales: 16 }, pattern: 'Base near 52-week high / Breakout Retest' },
  { ticker: 'BBAI', companyName: 'BigBear.ai', category: 'Edge AI / Robotics Infrastructure', catalyst: 'Defense AI contract and government spending watch.', catalystAgeDays: 18, backlogOrContract: 'Government AI backlog and contract pipeline.', revenueGrowth: 12, grossMarginTrend: 'STABLE', netIncomeTrend: 'IMPROVING', freeCashFlow: -20_000_000, cashDebtProfile: 'LEVERED', dilutionRisk: 'HIGH', valuation: { ps: 5, pe: null, evSales: 6 }, pattern: 'Triangle Wave 2 / Reclaim watch' },
  { ticker: 'UUUU', companyName: 'Energy Fuels', category: 'Power / Energy for Data Centers', catalyst: 'Nuclear fuel cycle and energy security policy support watch.', catalystAgeDays: 17, backlogOrContract: 'Strategic energy supply chain optionality for power-constrained data center buildout.', revenueGrowth: null, grossMarginTrend: 'UNKNOWN', netIncomeTrend: 'UNKNOWN', freeCashFlow: null, cashDebtProfile: 'NET_CASH', dilutionRisk: 'LOW', valuation: { ps: null, pe: null, evSales: null }, pattern: 'Triangle Wave 4 / Base' },
  { ticker: 'INDI', companyName: 'indie Semiconductor', category: 'Edge AI / Robotics Infrastructure', catalyst: 'Edge AI and automotive semiconductor design-win watch.', catalystAgeDays: 21, backlogOrContract: 'Auto/edge AI design-win backlog watch.', revenueGrowth: 18, grossMarginTrend: 'STABLE', netIncomeTrend: 'IMPROVING', freeCashFlow: -30_000_000, cashDebtProfile: 'MANAGEABLE', dilutionRisk: 'MEDIUM', valuation: { ps: 4, pe: null, evSales: 4 }, pattern: 'Base near 52-week high' },
  { ticker: 'MU', companyName: 'Micron Technology', category: 'Memory / HBM / DRAM / NAND', catalyst: 'HBM and memory supply/demand cycle watch.', catalystAgeDays: 28, backlogOrContract: 'HBM capacity tightness and AI memory demand.', revenueGrowth: 40, grossMarginTrend: 'EXPANDING', netIncomeTrend: 'IMPROVING', freeCashFlow: 1_000_000_000, cashDebtProfile: 'MANAGEABLE', dilutionRisk: 'LOW', valuation: { ps: 5, pe: 26, evSales: 5 }, pattern: 'Bull Flag / Base near 52-week high' },
  { ticker: 'AAOI', companyName: 'Applied Optoelectronics', category: 'Optical Interconnect / Photonics', catalyst: 'Optical transceiver demand and data center customer qualification watch.', catalystAgeDays: 34, backlogOrContract: 'Optical transceiver demand tied to AI data center bandwidth bottlenecks.', revenueGrowth: 18, grossMarginTrend: 'EXPANDING', netIncomeTrend: 'IMPROVING', freeCashFlow: null, cashDebtProfile: 'MANAGEABLE', dilutionRisk: 'MEDIUM', valuation: { ps: 3, pe: null, evSales: 3 }, pattern: 'Bull Flag / Breakout Retest' },
  { ticker: 'LASR', companyName: 'nLIGHT', category: 'Optical Interconnect / Photonics', catalyst: 'Photonics and advanced laser supply chain demand watch.', catalystAgeDays: 42, backlogOrContract: 'Photonics manufacturing optionality for advanced industrial and AI infrastructure supply chains.', revenueGrowth: 8, grossMarginTrend: 'STABLE', netIncomeTrend: 'IMPROVING', freeCashFlow: null, cashDebtProfile: 'NET_CASH', dilutionRisk: 'LOW', valuation: { ps: 2, pe: null, evSales: 2 }, pattern: 'Triangle / Early Accumulation' },
  { ticker: 'ACMR', companyName: 'ACM Research', category: 'Advanced Packaging / Testing', catalyst: 'Semiconductor equipment demand and advanced packaging capacity watch.', catalystAgeDays: 38, backlogOrContract: 'Semiconductor cleaning/equipment backlog tied to capacity expansion.', revenueGrowth: 24, grossMarginTrend: 'STABLE', netIncomeTrend: 'IMPROVING', freeCashFlow: 30_000_000, cashDebtProfile: 'NET_CASH', dilutionRisk: 'LOW', valuation: { ps: 3, pe: 22, evSales: 3 }, pattern: 'Cup with Handle / Base near 52-week high' },
  { ticker: 'BE', companyName: 'Bloom Energy', category: 'Power / Energy for Data Centers', catalyst: 'Data center power and fuel-cell deployment watch.', catalystAgeDays: 44, backlogOrContract: 'On-site power solutions for power-constrained data center customers.', revenueGrowth: 15, grossMarginTrend: 'STABLE', netIncomeTrend: 'IMPROVING', freeCashFlow: null, cashDebtProfile: 'LEVERED', dilutionRisk: 'MEDIUM', valuation: { ps: 2, pe: null, evSales: 2 }, pattern: 'VCP / Reclaim SMA50' },
  { ticker: 'EOSE', companyName: 'Eos Energy Enterprises', category: 'Power / Energy for Data Centers', catalyst: 'Grid-scale energy storage manufacturing ramp watch.', catalystAgeDays: 36, backlogOrContract: 'Energy storage backlog tied to grid resiliency and data center power constraints.', revenueGrowth: 30, grossMarginTrend: 'UNKNOWN', netIncomeTrend: 'IMPROVING', freeCashFlow: -140_000_000, cashDebtProfile: 'LEVERED', dilutionRisk: 'HIGH', valuation: { ps: 6, pe: null, evSales: 7 }, pattern: 'Speculative Triangle / Base required' },
  { ticker: 'SLDP', companyName: 'Solid Power', category: 'Power / Energy for Data Centers', catalyst: 'Energy storage technology commercialization watch.', catalystAgeDays: 57, backlogOrContract: 'Battery technology optionality; AI infrastructure link requires clearer commercialization evidence.', revenueGrowth: null, grossMarginTrend: 'UNKNOWN', netIncomeTrend: 'DETERIORATING', freeCashFlow: -70_000_000, cashDebtProfile: 'NET_CASH', dilutionRisk: 'MEDIUM', valuation: { ps: null, pe: null, evSales: null }, pattern: 'Early Accumulation / Volume Dry-Up' },
  { ticker: 'AMPX', companyName: 'Amprius Technologies', category: 'Power / Energy for Data Centers', catalyst: 'High-density battery production capacity and customer qualification watch.', catalystAgeDays: 49, backlogOrContract: 'Energy storage capacity expansion optionality for power-dense applications.', revenueGrowth: 35, grossMarginTrend: 'UNKNOWN', netIncomeTrend: 'IMPROVING', freeCashFlow: -55_000_000, cashDebtProfile: 'MANAGEABLE', dilutionRisk: 'MEDIUM', valuation: { ps: 14, pe: null, evSales: 14 }, pattern: 'VCP / Volume Dry-Up' },
  { ticker: 'STEM', companyName: 'Stem', category: 'Storage / Data Lake Infrastructure', catalyst: 'Energy storage software and grid optimization restructuring watch.', catalystAgeDays: 63, backlogOrContract: 'Storage and grid optimization backlog must improve to support the AI power thesis.', revenueGrowth: -5, grossMarginTrend: 'COMPRESSING', netIncomeTrend: 'DETERIORATING', freeCashFlow: -120_000_000, cashDebtProfile: 'LEVERED', dilutionRisk: 'HIGH', valuation: { ps: 1, pe: null, evSales: 2 }, pattern: 'Avoid / Broken Base' }
];

const DATA_REQUIRED_TH = 'ต้องมีข้อมูลเพิ่ม';

const formatMoney = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return DATA_REQUIRED_TH;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
};
const formatNumber = (value: number | null, digits = 2) => value === null || !Number.isFinite(value) ? DATA_REQUIRED_TH : value.toFixed(digits);
const formatVolume = (value: number | null) => value === null || !Number.isFinite(value) ? DATA_REQUIRED_TH : value.toLocaleString();

const toThaiDisplay = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return DATA_REQUIRED_TH;
  return String(value)
    .replaceAll('Data required', DATA_REQUIRED_TH)
    .replaceAll('Core Bottleneck', 'คอขวดหลัก')
    .replaceAll('Emerging Bottleneck', 'คอขวดเกิดใหม่')
    .replaceAll('Speculative Bottleneck', 'เก็งกำไรสูง')
    .replaceAll('Avoid / Too Extended', 'ควรเลี่ยง / วิ่งไกลเกินไป')
    .replaceAll('Breakout Ready', 'พร้อม Breakout')
    .replaceAll('Wait Pullback', 'รอย่อ / รอฐานใหม่')
    .replaceAll('Early Accumulation', 'สะสมระยะแรก')
    .replaceAll('Speculative Only', 'เก็งกำไรเท่านั้น')
    .replaceAll('Avoid / Wait New Base', 'ควรเลี่ยง / รอฐานใหม่')
    .replaceAll('Why it matters', 'เหตุผลที่สำคัญ')
    .replaceAll('Underappreciated supplier check', 'ตรวจผู้ขายที่ตลาดอาจมองข้าม')
    .replaceAll('Catalyst Summary', 'สรุปปัจจัยเร่ง')
    .replaceAll('Catalyst', 'ปัจจัยเร่ง')
    .replaceAll('Technical setup', 'โครงสร้างเทคนิค')
    .replaceAll('Technical Setup', 'โครงสร้างเทคนิค')
    .replaceAll('Watchlist Top 10', 'Watchlist 10 อันดับแรก')
    .replaceAll('If AI scales 5-10x, this candidate sells into', 'หาก AI โต 5-10 เท่า บริษัทนี้ขายของเข้าสู่หมวด')
    .replaceAll('Sells into', 'ขายของเข้าสู่หมวด')
    .replaceAll('thesis needs revenue, backlog, contract, or capacity evidence rather than AI branding alone', 'thesis ต้องมีรายได้ backlog contract หรือ capacity ยืนยัน ไม่ใช่แค่การใช้คำว่า AI')
    .replaceAll('Valuation, execution, liquidity, customer concentration, failed breakout, and sector rotation risk.', 'ความเสี่ยงด้าน valuation, การดำเนินงาน, สภาพคล่อง, การกระจุกตัวของลูกค้า, breakout ล้มเหลว และ sector rotation')
    .replaceAll('Track whether revenue, margin, backlog, or contract data confirms the bottleneck thesis.', 'ติดตามว่ารายได้ margin backlog หรือ contract ยืนยัน thesis คอขวดจริงหรือไม่')
    .replaceAll('Separate 13F idea generation from real-time trade signals.', 'แยก 13F ที่ใช้หาไอเดียออกจากสัญญาณเทรดแบบ real-time')
    .replaceAll('Do not chase extended moves; wait for VCP, retest, volume dry-up, or a new base.', 'ไม่ไล่ราคาที่วิ่งไกล ควรรอ VCP, retest, volume dry-up หรือฐานใหม่')
    .replaceAll('Check valuation versus growth and financial survivability before any live escalation.', 'ตรวจ valuation เทียบกับการเติบโตและความอยู่รอดทางการเงินก่อนยกระดับไปใช้เงินจริง')
    .replaceAll('Optical Interconnect / Photonics', 'โครงข่ายแสง / โฟโตนิกส์')
    .replaceAll('Advanced Packaging / Testing', 'บรรจุภัณฑ์ชิปขั้นสูง / ทดสอบชิป')
    .replaceAll('Power Management / Cooling / Grid Infrastructure', 'จัดการพลังงาน / ระบายความร้อน / โครงข่ายไฟฟ้า')
    .replaceAll('AI Data Center Conversion', 'แปลงศูนย์ข้อมูลเพื่อ AI')
    .replaceAll('Neo Cloud / GPU Cloud / Compute Capacity', 'Neo Cloud / GPU Cloud / กำลังประมวลผล')
    .replaceAll('Edge AI / Robotics Infrastructure', 'Edge AI / โครงสร้างพื้นฐานหุ่นยนต์')
    .replaceAll('Power / Energy for Data Centers', 'พลังงานสำหรับศูนย์ข้อมูล')
    .replaceAll('Memory / HBM / DRAM / NAND', 'หน่วยความจำ / HBM / DRAM / NAND')
    .replaceAll('Storage / Data Lake Infrastructure', 'Storage / Data Lake Infrastructure')
    .replaceAll('Strong Candidate', 'ผู้สมัครแข็งแรง')
    .replaceAll('Watchlist Candidate', 'หุ้นเฝ้าติดตาม')
    .replaceAll('High Conviction AI Bottleneck Watchlist', 'Watchlist AI Bottleneck ความเชื่อมั่นสูง')
    .replaceAll('Speculative / High Risk', 'เก็งกำไร / เสี่ยงสูง')
    .replaceAll('Extended / Wait Pullback', 'วิ่งไกล / รอย่อ')
    .replaceAll('LOW', 'ต่ำ')
    .replaceAll('MEDIUM', 'ปานกลาง')
    .replaceAll('HIGH', 'สูง')
    .replaceAll('UNKNOWN', 'ต้องยืนยันข้อมูล')
    .replaceAll('NET_CASH', 'เงินสดสุทธิ')
    .replaceAll('MANAGEABLE', 'บริหารได้')
    .replaceAll('LEVERED', 'มีภาระหนี้')
    .replaceAll('EXPANDING', 'ขยายตัว')
    .replaceAll('STABLE', 'ทรงตัว')
    .replaceAll('COMPRESSING', 'ถูกบีบตัว')
    .replaceAll('IMPROVING', 'ดีขึ้น')
    .replaceAll('DETERIORATING', 'แย่ลง')
    .replaceAll('No major model issue', 'ยังไม่พบประเด็นเสี่ยงหลักจากโมเดล');
};

export const AIBottleneckScreenerAnalyst = ({ onSelectSymbol }: { onSelectSymbol?: (symbol: string) => void }) => {
  const [rows, setRows] = useState<BottleneckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const dailySectionRef = useRef<HTMLElement | null>(null);
  const smallMidSectionRef = useRef<HTMLElement | null>(null);
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const riskSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const symbols = BOTTLENECK_UNIVERSE.map(item => item.ticker).join(',');
        const [response, filingEvidence] = await Promise.all([
          apiFetch(`/api/proxy/us-stock-screener?symbols=${encodeURIComponent(symbols)}`),
          fetchFilingEvidence(BOTTLENECK_UNIVERSE.map(item => item.ticker)).catch(() => new Map<string, FilingEvidenceItem>())
        ]);
        if (!response.ok) throw new Error('AI bottleneck screener data unavailable.');
        const payload = await response.json();
        if (!cancelled) setRows(buildBottleneckRows(payload, filingEvidence));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'AI bottleneck screener data unavailable.');
          setRows(buildBottleneckRows([]));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredRows = useMemo(() => rows
    .filter(row => categoryFilter === 'ALL' || row.category === categoryFilter)
    .sort((a, b) => b.score - a.score), [rows, categoryFilter]);
  const topTen = filteredRows.slice(0, 10);
  const topThree = topTen.slice(0, 3);
  const dailyRows = useMemo(() => {
    return filteredRows.filter(qualifiesDailyScan).slice(0, 10);
  }, [filteredRows]);
  const dailyTopThree = dailyRows.slice(0, 3);
  const smallMidRows = useMemo(() => {
    return filteredRows.filter(qualifiesSmallMidScan).slice(0, 15);
  }, [filteredRows]);
  const smallMidGroups = useMemo(() => groupSmallMidRows(smallMidRows), [smallMidRows]);
  const tradingPlanRows = useMemo(() => buildTradingPlanRows(smallMidRows, dailyRows), [smallMidRows, dailyRows]);
  const riskRows = [...filteredRows].sort((a, b) => b.issues.length - a.issues.length || a.score - b.score).slice(0, 6);
  const groups = groupRows(filteredRows);

  const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="font-sarabun-psk space-y-6 animate-in fade-in max-w-7xl mx-auto p-4 md:p-8 overflow-y-auto w-full pb-32">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-black">นักวิเคราะห์สแกนหุ้น AI Bottleneck</div>
          <h2 className="text-2xl md:text-3xl font-black text-white mt-1 flex items-center gap-2">
            <Cpu className="w-7 h-7 text-cyan-400" />
            Watchlist หุ้นคอขวดโครงสร้างพื้นฐาน AI
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-5xl">
            Watchlist เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำลงทุนส่วนบุคคล โฟกัส second-level thinking: ถ้า AI โต 5-10 เท่า โลกจะขาดอะไร ใครขายของให้คอขวดนั้น และตลาดสะท้อนไปมากแค่ไหนแล้ว
          </p>
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
        >
          <option value="ALL">ทุกหมวดคอขวด</option>
          {Array.from(new Set(BOTTLENECK_UNIVERSE.map(item => item.category))).map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <InfoCard onClick={() => { setCategoryFilter('ALL'); scrollToSection(dailySectionRef); }} icon={<Zap className="w-5 h-5" />} title="ภาพรวมตลาด" value="ข้อจำกัดเชิงกายภาพของ AI" detail="พลังงาน, compute, optical, memory, packaging, data center conversion และ edge infrastructure" />
        <InfoCard onClick={() => scrollToSection(mapSectionRef)} icon={<Database className="w-5 h-5" />} title="แผนที่ AI Bottleneck" value={`${filteredRows.length} ตัวที่เฝ้าดู`} detail="แบ่งเป็น Core, Emerging, Speculative และ Too Extended" />
        <InfoCard onClick={() => scrollToSection(dailySectionRef)} icon={<Gauge className="w-5 h-5" />} title="เกณฑ์คัดกรอง" value="โมเดล 8 ปัจจัย" detail="Bottleneck relevance, scarcity, catalyst, financials, technicals, valuation, liquidity และ risk" />
        <InfoCard onClick={() => scrollToSection(riskSectionRef)} icon={<AlertTriangle className="w-5 h-5" />} title="นโยบายความเสี่ยง" value="ไม่ FOMO" detail="13F ใช้หาไอเดียเท่านั้น หุ้นที่วิ่งแรงต้องรอฐานใหม่ก่อน" />
      </div>

      {error && <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">โหมดข้อมูลสำรอง: {toThaiDisplay(error)}. ข้อมูลที่ขาดจะขึ้น {DATA_REQUIRED_TH} แทนการเดา</div>}

      {loading ? (
        <div className="h-72 flex items-center justify-center border border-slate-800 rounded-lg bg-slate-950">
          <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
          <span className="ml-3 text-slate-400 text-sm font-bold">กำลังสแกนหุ้นธีม AI Bottleneck...</span>
        </div>
      ) : (
        <>
          <section ref={dailySectionRef} className="bg-[#0B0F19] border border-cyan-500/20 rounded-lg overflow-hidden scroll-mt-6">
            <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-black">สแกน AI Bottleneck รายวัน</div>
                <h3 className="text-lg font-black text-white mt-1">Watchlist โครงสร้างพื้นฐาน AI ระยะ 1-12 เดือน</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-4xl">
                  Watchlist เพื่อการศึกษา ไม่ใช่คำแนะนำลงทุนส่วนบุคคล สแกนหุ้น NYSE/Nasdaq/AMEX ที่อยู่ตรงคอขวด AI Economy เช่น power, neo cloud, data center conversion, optical, memory, storage, packaging, testing, foundry, grid และ cooling.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-300">
                <div className="border border-slate-800 rounded-lg p-2">MCap $100M-$20B</div>
                <div className="border border-slate-800 rounded-lg p-2">Price $1-$100</div>
                <div className="border border-slate-800 rounded-lg p-2">Avg Vol &gt; 500K</div>
                <div className="border border-slate-800 rounded-lg p-2">Catalyst 30-180d</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500 uppercase">
                  <tr>
                    {['อันดับ', 'Ticker', 'บริษัท', 'หมวดคอขวด', 'มูลค่าตลาด', 'ราคา', 'ปัจจัยเร่ง', 'รูปแบบกราฟ', 'RSI', 'Relative Volume', 'โซนเข้า', 'Stop Loss', 'โซนเป้าหมาย', 'R:R', 'คะแนน', 'มุมมองสุดท้าย'].map(header => (
                      <th key={header} className="px-3 py-3 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((row, index) => (
                    <tr key={`daily-${row.ticker}`} className="border-t border-slate-800 hover:bg-slate-900/60">
                      <td className="px-3 py-3 text-slate-400 font-black">#{index + 1}</td>
                      <td className="px-3 py-3">
                        <button className="font-black text-cyan-300 hover:text-white" onClick={() => onSelectSymbol?.(row.ticker)}>{row.ticker}</button>
                        <div className="text-[10px] text-slate-500">{toThaiDisplay(row.group)}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-300 min-w-40">{toThaiDisplay(row.companyName)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-56">{toThaiDisplay(row.category)}</td>
                      <td className="px-3 py-3 text-slate-300">{formatMoney(row.marketCap)}</td>
                      <td className="px-3 py-3 text-white">{row.price === null ? DATA_REQUIRED_TH : `$${row.price.toFixed(2)}`}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-56">
                        {toThaiDisplay(row.catalyst)} ({row.catalystAgeDays === null ? DATA_REQUIRED_TH : `${row.catalystAgeDays} วัน`})
                        {row.catalystSourceUrl && <a href={row.catalystSourceUrl} target="_blank" rel="noreferrer" className="block mt-1 text-[10px] text-cyan-300 hover:text-white">SEC source</a>}
                      </td>
                      <td className="px-3 py-3 text-slate-300 min-w-48">{toThaiDisplay(row.technical.pattern)}</td>
                      <td className="px-3 py-3 text-slate-300">{formatNumber(row.technical.rsi, 1)}</td>
                      <td className="px-3 py-3 text-slate-300">{formatNumber(row.relativeVolume, 2)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.entryZone)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.stopLossZone)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.targetZone)}</td>
                      <td className="px-3 py-3 text-slate-300">{toThaiDisplay(row.riskReward ?? DATA_REQUIRED_TH)}</td>
                      <td className="px-3 py-3"><ScoreBadge score={row.score} /></td>
                      <td className="px-3 py-3 text-slate-200 whitespace-nowrap">{toThaiDisplay(row.finalView)}</td>
                    </tr>
                  ))}
                  {dailyRows.length === 0 && (
                    <tr>
                      <td colSpan={16} className="px-4 py-8 text-center text-slate-500">
                        ยังไม่มีหุ้นที่ผ่านตัวกรองรายวันจากข้อมูลที่มีอยู่ ข้อมูลตลาดที่ขาดจะแสดงเป็น {DATA_REQUIRED_TH} แทนการเดา
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {dailyTopThree.length > 0 && (
            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {dailyTopThree.map(row => (
                <div key={`daily-deep-${row.ticker}`} className="bg-[#0B0F19] border border-cyan-500/20 rounded-lg p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-black">วิเคราะห์เชิงลึก Top รายวัน</div>
                      <h3 className="text-xl font-black text-white mt-1">{row.ticker}</h3>
                      <p className="text-xs text-slate-500 mt-1">{toThaiDisplay(row.category)}</p>
                    </div>
                    <ScoreBadge score={row.score} />
                  </div>
                  <DeepLine label="1. ทำไมเป็น AI Bottleneck" value={`อยู่ในหมวด ${row.category} ซึ่งเป็นข้อจำกัดเชิงกายภาพของ AI infrastructure ไม่ใช่แค่ AI software narrative.`} />
                  <DeepLine label="2. ตลาดอาจประเมินผิด" value={`ตลาดอาจยังให้ค่าน้ำหนักกับ ${row.backlogOrContract} ต่ำกว่าความสำคัญหาก AI capacity โตต่อเนื่อง 1-12 เดือน.`} />
                  <DeepLine label="3. Catalyst re-rate" value={`${row.catalyst} | อายุ catalyst: ${row.catalystAgeDays === null ? 'Data required' : `${row.catalystAgeDays} วัน`} และต้องยืนยันจากข่าว/filing ที่มี timestamp จริงก่อนใช้เป็น gate.`} />
                  <DeepLine label="4. ความเสี่ยงหลัก" value={row.issues.length > 0 ? row.issues.join(' | ') : 'Valuation, execution, liquidity, customer concentration, failed breakout, and sector rotation risk.'} />
                  <DeepLine label="5. จุดเข้าที่เหมาะสม" value={row.entryZone} />
                  <DeepLine label="6. ไม่ควรไล่ราคา" value={`ถ้า RSI > 80, RVOL พุ่งแต่ปิดต่ำ, หรือราคาวิ่งเกิน 100% ใน 1 เดือนโดยยังไม่มี VCP/retest/base ใหม่ ให้จัดเป็น Extended / Wait Pullback.`} />
                  <DeepLine label="7. Thesis ผิดเมื่อ" value="Demand ไม่ไหลเข้า revenue/backlog, margin แย่ลง, cash burn/dilution สูงขึ้น, หลุด SMA50 พร้อม volume ขาย หรือ catalyst ไม่เกิดตามรอบ 30-180 วัน." />
                  <button onClick={() => onSelectSymbol?.(row.ticker)} className="mt-4 w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 rounded-lg py-2 text-xs font-black transition-colors">
                    เปิดในเมนูวิเคราะห์กราฟ
                  </button>
                </div>
              ))}
            </section>
          )}

          <section ref={smallMidSectionRef} className="bg-[#0B0F19] border border-fuchsia-500/20 rounded-lg overflow-hidden scroll-mt-6">
            <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-fuchsia-300 font-black">หุ้นเล็ก/กลางธีม AI Bottleneck</div>
                <h3 className="text-lg font-black text-white mt-1">Watchlist ผู้ชนะ AI Bottleneck รุ่นถัดไป</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-4xl">
                  โฟกัสหุ้นขนาดเล็กถึงกลางในธีม Data Center Power, Fuel Cell/Grid/Energy Storage, Neo Cloud, Bitcoin Miner to AI Data Center Conversion, Photonics, Memory/Storage, Advanced Packaging, Semiconductor Testing, Cooling และ Edge AI Infrastructure.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-300">
                <div className="border border-slate-800 rounded-lg p-2">MCap $100M-$5B</div>
                <div className="border border-slate-800 rounded-lg p-2">Price $1-$50</div>
                <div className="border border-slate-800 rounded-lg p-2">Avg Vol &gt; 300K</div>
                <div className="border border-slate-800 rounded-lg p-2">RVOL &gt; 1.3</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 p-4 border-b border-slate-800">
              <SmallMidGroupCard title="Breakout Ready" rows={smallMidGroups.breakoutReady} onSelectSymbol={onSelectSymbol} />
              <SmallMidGroupCard title="Wait Pullback" rows={smallMidGroups.waitPullback} onSelectSymbol={onSelectSymbol} />
              <SmallMidGroupCard title="Early Accumulation" rows={smallMidGroups.earlyAccumulation} onSelectSymbol={onSelectSymbol} />
              <SmallMidGroupCard title="Speculative Only" rows={smallMidGroups.speculativeOnly} onSelectSymbol={onSelectSymbol} />
              <SmallMidGroupCard title="Avoid / Too Extended" rows={smallMidGroups.avoidTooExtended} onSelectSymbol={onSelectSymbol} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500 uppercase">
                  <tr>
                    {['อันดับ', 'Ticker', 'กลุ่ม', 'หมวด AI Bottleneck', 'เหตุผลที่สำคัญ', 'ปัจจัยเร่ง', 'รูปแบบกราฟ', 'เงื่อนไขเข้า', 'Stop-loss', 'Target 1', 'Target 2', 'ระดับความเสี่ยง', 'คะแนน', 'มุมมองสุดท้าย'].map(header => (
                      <th key={header} className="px-3 py-3 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {smallMidRows.map((row, index) => {
                    const profile = buildSmallMidProfile(row);
                    return (
                      <tr key={`small-mid-${row.ticker}`} className="border-t border-slate-800 hover:bg-slate-900/60">
                        <td className="px-3 py-3 text-slate-400 font-black">#{index + 1}</td>
                        <td className="px-3 py-3">
                          <button className="font-black text-fuchsia-300 hover:text-white" onClick={() => onSelectSymbol?.(row.ticker)}>{row.ticker}</button>
                          <div className="text-[10px] text-slate-500">{row.companyName}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-200 whitespace-nowrap">{toThaiDisplay(profile.group)}</td>
                        <td className="px-3 py-3 text-slate-300 min-w-56">{toThaiDisplay(row.category)}</td>
                        <td className="px-3 py-3 text-slate-300 min-w-64">{toThaiDisplay(profile.whyItMatters)}</td>
                        <td className="px-3 py-3 text-slate-300 min-w-56">{toThaiDisplay(row.catalyst)}</td>
                        <td className="px-3 py-3 text-slate-300 min-w-48">{toThaiDisplay(row.technical.pattern)}</td>
                        <td className="px-3 py-3 text-slate-300 min-w-52">{toThaiDisplay(profile.entryTrigger)}</td>
                        <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.stopLossZone)}</td>
                        <td className="px-3 py-3 text-slate-300 min-w-32">{profile.target1}</td>
                        <td className="px-3 py-3 text-slate-300 min-w-32">{profile.target2}</td>
                        <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{toThaiDisplay(profile.riskLevel)}</td>
                        <td className="px-3 py-3"><ScoreBadge score={row.score} /></td>
                        <td className="px-3 py-3 text-slate-200 whitespace-nowrap">{toThaiDisplay(profile.finalView)}</td>
                      </tr>
                    );
                  })}
                  {smallMidRows.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-4 py-8 text-center text-slate-500">
                        ยังไม่มีหุ้นเล็ก/กลางธีม AI Bottleneck ที่ผ่านตัวกรองจากข้อมูลปัจจุบัน ข้อมูลตลาดที่ขาดจะแสดงเป็น {DATA_REQUIRED_TH} แทนการเดา
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section ref={riskSectionRef} className="bg-[#0B0F19] border border-emerald-500/20 rounded-lg overflow-hidden scroll-mt-6">
            <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-black">แผนเทรดแบบบริหารความเสี่ยง</div>
                <h3 className="text-lg font-black text-white mt-1">กรอบคำนวณขนาดไม้แบบมีเงื่อนไข</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-4xl">
                  Watchlist เพื่อการศึกษาเท่านั้น ค่าเริ่มต้นเสี่ยง 1% ต่อดีล ห้ามถัวลงหลังหลุด stop-loss และถ้า RSI &gt; 85 หรือราคาวิ่งแรงเกินไปต้องรอฐานใหม่ก่อน
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-300">
                <div className="border border-slate-800 rounded-lg p-2">$500 portfolio</div>
                <div className="border border-slate-800 rounded-lg p-2">$1,000 portfolio</div>
                <div className="border border-slate-800 rounded-lg p-2">$3,000 portfolio</div>
                <div className="border border-slate-800 rounded-lg p-2">$10,000 portfolio</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500 uppercase">
                  <tr>
                    {['Ticker', 'เงื่อนไขเข้า', 'โซนซื้อ', 'Stop-loss', 'Target 1', 'Target 2', 'R:R', '$500', '$1,000', '$3,000', '$10,000', 'เงื่อนไขเพิ่มไม้', 'ขายทำกำไร', 'ตัดขาดทุน', 'Thesis ผิดเมื่อ'].map(header => (
                      <th key={header} className="px-3 py-3 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tradingPlanRows.map(({ row, plan }) => (
                    <tr key={`trade-plan-${row.ticker}`} className="border-t border-slate-800 hover:bg-slate-900/60">
                      <td className="px-3 py-3">
                        <button className="font-black text-emerald-300 hover:text-white" onClick={() => onSelectSymbol?.(row.ticker)}>{row.ticker}</button>
                        <div className="text-[10px] text-slate-500">{toThaiDisplay(plan.finalView)}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-300 min-w-64">{toThaiDisplay(plan.entryTrigger)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(plan.buyZone)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(plan.stopLoss)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-28">{toThaiDisplay(plan.target1)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-28">{toThaiDisplay(plan.target2)}</td>
                      <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{toThaiDisplay(plan.riskReward)}</td>
                      {plan.positionSizes.map(size => (
                        <td key={`${row.ticker}-${size.portfolioValue}`} className="px-3 py-3 text-slate-300 min-w-40">
                          <PositionSizeCell plan={plan} portfolioSize={size.portfolioValue} />
                        </td>
                      ))}
                      <td className="px-3 py-3 text-slate-300 min-w-72">{toThaiDisplay(plan.addRule)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-72">{toThaiDisplay(plan.takeProfitRule)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-72">{toThaiDisplay(plan.cutLossRule)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-72">{toThaiDisplay(plan.thesisBreak)}</td>
                    </tr>
                  ))}
                  {tradingPlanRows.length === 0 && (
                    <tr>
                      <td colSpan={15} className="px-4 py-8 text-center text-slate-500">
                        ยังไม่มีหุ้น AI Bottleneck ที่เข้าเงื่อนไขสำหรับสร้างแผนเทรดแบบบริหารความเสี่ยง
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section ref={mapSectionRef} className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5 scroll-mt-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-200 mb-4">แผนที่กลุ่ม AI Bottleneck</h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <GroupCard title="Core Bottleneck" rows={groups.core} onSelectSymbol={onSelectSymbol} />
              <GroupCard title="Emerging Bottleneck" rows={groups.emerging} onSelectSymbol={onSelectSymbol} />
              <GroupCard title="Speculative Bottleneck" rows={groups.speculative} onSelectSymbol={onSelectSymbol} />
              <GroupCard title="Avoid / Too Extended" rows={groups.avoid} onSelectSymbol={onSelectSymbol} />
            </div>
          </section>

          <section className="bg-[#0B0F19] border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-200">Watchlist 10 อันดับแรก</h3>
              <p className="text-xs text-slate-500 mt-1">อุปสงค์ระยะยาว + ข้อจำกัดเชิงกายภาพ + ผู้ขายที่ตลาดยังมองข้าม + Catalyst + ความอยู่รอดทางการเงิน + จังหวะเทคนิค + การบริหารความเสี่ยง</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500 uppercase">
                  <tr>
                    {['Ticker', 'บริษัท', 'หมวด', 'มูลค่าตลาด', 'ราคา', 'Avg Vol', 'RVOL', 'รายได้เติบโต', 'Gross Margin', 'กำไรสุทธิ/EPS', 'FCF', 'เงินสด/หนี้', 'Backlog/Contract', 'ปัจจัยเร่ง', 'Valuation', 'เทคนิค', 'รูปแบบกราฟ', 'R/R', 'จุดเข้า', 'Stop', 'เป้าหมาย', 'คะแนน', 'มุมมองสุดท้าย'].map(header => (
                      <th key={header} className="px-3 py-3 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topTen.map(row => (
                    <tr key={row.ticker} className="border-t border-slate-800 hover:bg-slate-900/60">
                      <td className="px-3 py-3">
                        <button className="font-black text-cyan-300 hover:text-white" onClick={() => onSelectSymbol?.(row.ticker)}>{row.ticker}</button>
                        <div className="text-[10px] text-slate-500">{toThaiDisplay(row.group)}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-300 min-w-40">{toThaiDisplay(row.companyName)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-56">{toThaiDisplay(row.category)}</td>
                      <td className="px-3 py-3 text-slate-300">{formatMoney(row.marketCap)}</td>
                      <td className="px-3 py-3 text-white">{row.price === null ? DATA_REQUIRED_TH : `$${row.price.toFixed(2)}`}</td>
                      <td className="px-3 py-3 text-slate-300">{formatVolume(row.averageVolume)}</td>
                      <td className="px-3 py-3 text-slate-300">{formatNumber(row.relativeVolume, 2)}</td>
                      <td className="px-3 py-3 text-slate-300">{formatNumber(row.revenueGrowth, 1)}%</td>
                      <td className="px-3 py-3 text-slate-300">{toThaiDisplay(row.grossMarginTrend)}</td>
                      <td className="px-3 py-3 text-slate-300">{toThaiDisplay(row.netIncomeTrend)}</td>
                      <td className="px-3 py-3 text-slate-300">{formatMoney(row.freeCashFlow)}</td>
                      <td className="px-3 py-3 text-slate-300">{toThaiDisplay(row.cashDebtProfile)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-64">{toThaiDisplay(row.backlogOrContract)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-56">
                        {toThaiDisplay(row.catalyst)} ({row.catalystAgeDays === null ? DATA_REQUIRED_TH : `${row.catalystAgeDays} วัน`})
                        {row.catalystSourceUrl && <a href={row.catalystSourceUrl} target="_blank" rel="noreferrer" className="block mt-1 text-[10px] text-cyan-300 hover:text-white">SEC source</a>}
                      </td>
                      <td className="px-3 py-3 text-slate-300">P/S {formatNumber(row.valuation.ps, 1)} | EV/S {formatNumber(row.valuation.evSales, 1)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-48">SMA {toThaiDisplay(row.technical.sma20)}/{toThaiDisplay(row.technical.sma50)}/{toThaiDisplay(row.technical.sma200)} | RSI {formatNumber(row.technical.rsi, 1)} | RS {formatNumber(row.technical.relativeStrength, 1)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-48">{toThaiDisplay(row.technical.pattern)}</td>
                      <td className="px-3 py-3 text-slate-300">{toThaiDisplay(row.riskReward ?? DATA_REQUIRED_TH)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.entryZone)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.stopLossZone)}</td>
                      <td className="px-3 py-3 text-slate-300 min-w-44">{toThaiDisplay(row.targetZone)}</td>
                      <td className="px-3 py-3"><ScoreBadge score={row.score} /></td>
                      <td className="px-3 py-3 text-slate-200 whitespace-nowrap">{toThaiDisplay(row.finalView)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {topThree.map(row => (
              <div key={`deep-${row.ticker}`} className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-white">{row.ticker}</h3>
                    <p className="text-xs text-slate-500 mt-1">{toThaiDisplay(row.category)}</p>
                  </div>
                  <ScoreBadge score={row.score} />
                </div>
                <DeepLine label="Why it matters" value={`If AI scales 5-10x, this candidate sells into ${row.category}.`} />
                <DeepLine label="Underappreciated supplier check" value={row.backlogOrContract} />
                <DeepLine label="Catalyst" value={row.catalyst} />
                <DeepLine label="Technical setup" value={`${row.technical.pattern}; SMA ${row.technical.sma20}/${row.technical.sma50}/${row.technical.sma200}; RSI ${formatNumber(row.technical.rsi, 1)}`} />
                  <DeepLine label="ความเสี่ยง" value={row.issues.length > 0 ? row.issues.join(' | ') : 'ต้องติดตาม valuation, liquidity, dilution และความเสี่ยง breakout fail อย่างต่อเนื่อง'} />
                <button onClick={() => onSelectSymbol?.(row.ticker)} className="mt-4 w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 rounded-lg py-2 text-xs font-black transition-colors">
                  เปิดในเมนูวิเคราะห์กราฟ
                </button>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Technical Setup" icon={<LineChart className="w-4 h-4" />}>
              {topTen.slice(0, 6).map(row => <LineItem key={row.ticker} left={`${row.ticker} - ${row.technical.pattern}`} right={`RSI ${formatNumber(row.technical.rsi, 1)} | RVOL ${formatNumber(row.relativeVolume, 2)} | ${row.finalView}`} />)}
            </Panel>
            <Panel title="Catalyst Summary" icon={<Activity className="w-4 h-4" />}>
              {topTen.slice(0, 6).map(row => <LineItem key={row.ticker} left={`${row.ticker} - ${row.category}`} right={row.catalyst} />)}
            </Panel>
            <Panel title="จัดอันดับความเสี่ยง" icon={<AlertTriangle className="w-4 h-4" />}>
              {riskRows.map(row => <LineItem key={row.ticker} left={`${row.ticker} - ${row.group}`} right={row.issues.join(' | ') || 'No major model issue'} />)}
            </Panel>
            <Panel title="Checklist สำหรับติดตาม" icon={<Search className="w-4 h-4" />}>
              <ul className="space-y-2 text-xs text-slate-300">
                <li>Track whether revenue, margin, backlog, or contract data confirms the bottleneck thesis.</li>
                <li>Separate 13F idea generation from real-time trade signals.</li>
                <li>Do not chase extended moves; wait for VCP, retest, volume dry-up, or a new base.</li>
                <li>Check valuation versus growth and financial survivability before any live escalation.</li>
                <li>เปิด ticker ที่สนใจในเมนูวิเคราะห์กราฟ เพื่อตรวจ entry, stop, target และ risk control อีกครั้ง</li>
              </ul>
            </Panel>
          </section>
        </>
      )}
    </div>
  );
};

function buildBottleneckRows(payload: any[], filingEvidence = new Map<string, FilingEvidenceItem>()): BottleneckRow[] {
  return BOTTLENECK_UNIVERSE.map(meta => {
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
    const fiftyTwoWeekHigh = numberOrNull(item?.quote?.fiftyTwoWeekHigh ?? (closes.length > 0 ? Math.max(...closes.slice(-252)) : null));
    const distanceFrom52WeekHigh = price !== null && fiftyTwoWeekHigh !== null && fiftyTwoWeekHigh > 0 ? ((fiftyTwoWeekHigh - price) / fiftyTwoWeekHigh) * 100 : null;
    const recentRunUpPercent = closes.length >= 5 ? ((closes[closes.length - 1] - closes[closes.length - 5]) / Math.max(Math.abs(closes[closes.length - 5]), 1)) * 100 : null;
    const monthlyRunUpPercent = closes.length >= 22 ? ((closes[closes.length - 1] - closes[closes.length - 22]) / Math.max(Math.abs(closes[closes.length - 22]), 1)) * 100 : null;
    const relativeStrength = closes.length >= 20 ? ((closes[closes.length - 1] - closes[closes.length - 20]) / Math.max(Math.abs(closes[closes.length - 20]), 1)) * 100 : null;
    const companyName = item?.quote?.shortName ?? meta.companyName;
    const patternReport = detectCandlePatterns(candles);
    const candlePattern = patternReport.primaryPattern === 'Pattern requires manual confirmation'
      ? meta.pattern
      : `${patternReport.patternSummary} / ${meta.pattern}`;
    const filing = filingEvidence.get(meta.ticker);
    const verifiedCatalyst = describeMaterialFiling(filing, meta.catalyst);
    const dilutionRisk = filing?.dilution && filing.dilution.ageDays <= 180 ? 'HIGH' : meta.dilutionRisk;

    const scored = scoreAiBottleneckCandidate({
      ticker: meta.ticker,
      companyName,
      category: meta.category,
      marketCap: numberOrNull(item?.quote?.marketCap),
      price,
      averageVolume,
      relativeVolume,
      revenueGrowth: meta.revenueGrowth,
      grossMarginTrend: meta.grossMarginTrend,
      netIncomeTrend: meta.netIncomeTrend,
      freeCashFlow: meta.freeCashFlow,
      cashDebtProfile: meta.cashDebtProfile,
      backlogOrContract: meta.backlogOrContract,
      catalyst: verifiedCatalyst.catalyst,
      catalystAgeDays: verifiedCatalyst.catalystAgeDays,
      valuation: meta.valuation,
      sma20Status: price !== null && sma20 !== null ? price >= sma20 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
      sma50Status: price !== null && sma50 !== null ? price >= sma50 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
      sma200Status: price !== null && sma200 !== null ? price >= sma200 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
      rsi,
      relativeStrength,
      pattern: candlePattern,
      recentRunUpPercent,
      monthlyRunUpPercent,
      dilutionRisk,
      fundamentalsVerified: false
    });

    return {
      ...scored,
      marketCap: numberOrNull(item?.quote?.marketCap),
      price,
      averageVolume,
      relativeVolume,
      revenueGrowth: meta.revenueGrowth,
      grossMarginTrend: meta.grossMarginTrend,
      netIncomeTrend: meta.netIncomeTrend,
      freeCashFlow: meta.freeCashFlow,
      cashDebtProfile: meta.cashDebtProfile,
      backlogOrContract: meta.backlogOrContract,
      catalyst: verifiedCatalyst.catalyst,
      catalystAgeDays: verifiedCatalyst.catalystAgeDays,
      catalystSourceUrl: filing?.material?.sourceUrl ?? null,
      valuation: meta.valuation,
      issues: Array.from(new Set([...scored.issues, ...patternReport.warnings])),
      technical: {
        sma20: price !== null && sma20 !== null ? price >= sma20 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
        sma50: price !== null && sma50 !== null ? price >= sma50 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
        sma200: price !== null && sma200 !== null ? price >= sma200 ? 'ABOVE' : 'BELOW' : 'UNKNOWN',
        rsi,
        relativeStrength,
        monthlyRunUpPercent,
        distanceFrom52WeekHigh,
        pattern: candlePattern
      }
    };
  });
}

function qualifiesDailyScan(row: BottleneckRow): boolean {
  return evaluateAiBottleneckDailyEligibility({
    marketCap: row.marketCap,
    price: row.price,
    averageVolume: row.averageVolume,
    relativeVolume: row.relativeVolume,
    catalystAgeDays: row.catalystAgeDays,
    hasDemandEvidence: Boolean(row.backlogOrContract && row.backlogOrContract !== 'Data required'),
    sma20Status: row.technical.sma20,
    sma50Status: row.technical.sma50,
    rsi: row.technical.rsi,
    monthlyRunUpPercent: row.technical.monthlyRunUpPercent,
    distanceFrom52WeekHighPercent: row.technical.distanceFrom52WeekHigh,
    pattern: row.technical.pattern
  }).eligible;
}

function qualifiesSmallMidScan(row: BottleneckRow): boolean {
  const themeOk = /Power|Energy|Cloud|Compute|Data Center|Optical|Photonics|Memory|Storage|Packaging|Testing|Cooling|Grid|Edge AI/i.test(`${row.category} ${row.backlogOrContract}`);
  return themeOk && evaluateAiBottleneckSmallMidEligibility({
    marketCap: row.marketCap,
    price: row.price,
    averageVolume: row.averageVolume,
    relativeVolume: row.relativeVolume,
    catalystAgeDays: row.catalystAgeDays,
    hasDemandEvidence: Boolean(row.backlogOrContract && row.backlogOrContract !== 'Data required'),
    sma20Status: row.technical.sma20,
    sma50Status: row.technical.sma50,
    rsi: row.technical.rsi,
    monthlyRunUpPercent: row.technical.monthlyRunUpPercent,
    distanceFrom52WeekHighPercent: row.technical.distanceFrom52WeekHigh,
    pattern: row.technical.pattern
  }).eligible;
}

function buildTradingPlanRows(smallMidRows: BottleneckRow[], dailyRows: BottleneckRow[]): { row: BottleneckRow; plan: AiBottleneckTradingPlan }[] {
  const candidates = [...smallMidRows, ...dailyRows];
  const unique = new Map<string, BottleneckRow>();
  candidates.forEach(row => {
    if (!unique.has(row.ticker)) unique.set(row.ticker, row);
  });

  return Array.from(unique.values())
    .filter(row => row.group !== 'Avoid / Too Extended' || row.technical.rsi !== null && row.technical.rsi > 85 || row.issues.length > 0)
    .slice(0, 15)
    .map(row => ({
      row,
      plan: buildAiBottleneckTradingPlan({
        ticker: row.ticker,
        price: row.price,
        marketCap: row.marketCap,
        averageVolume: row.averageVolume,
        relativeVolume: row.relativeVolume,
        rsi: row.technical.rsi,
        score: row.score,
        group: row.group,
        issues: row.issues,
        pattern: row.technical.pattern,
        entryZone: row.entryZone,
        stopLossZone: row.stopLossZone,
        targetZone: row.targetZone,
        riskReward: row.riskReward,
        backlogOrContract: row.backlogOrContract,
        revenueGrowth: row.revenueGrowth,
        cashDebtProfile: row.cashDebtProfile
      })
    }));
}

function classifySmallMidGroup(row: BottleneckRow): SmallMidGroup {
  const rsi = row.technical.rsi;
  const extended = row.issues.includes('TOO_EXTENDED_WAIT_FOR_BASE')
    || row.issues.includes('MONTHLY_RUNUP_OVER_100_NO_BASE')
    || (rsi !== null && rsi > 85);
  const hasBase = /vcp|bull flag|triangle|cup|handle|base|retest|dry-up/i.test(row.technical.pattern);
  const nearHigh = row.technical.distanceFrom52WeekHigh !== null && row.technical.distanceFrom52WeekHigh <= 25;
  const liquid = row.averageVolume !== null && row.averageVolume > 300_000;
  const confirmingVolume = row.relativeVolume !== null && row.relativeVolume > 1.3;
  const speculative = row.issues.includes('DILUTION_RISK_HIGH')
    || row.cashDebtProfile === 'LEVERED'
    || row.revenueGrowth === null
    || /unproven|requires clearer|must improve|optionality/i.test(row.backlogOrContract);

  if (extended || !liquid || row.score < 50) return 'Avoid / Too Extended';
  if (speculative) return 'Speculative Only';
  if (row.score >= 75 && hasBase && nearHigh && confirmingVolume && rsi !== null && rsi >= 50 && rsi <= 75) return 'Breakout Ready';
  if (row.score >= 65 && hasBase && rsi !== null && rsi >= 50 && rsi <= 80) return 'Early Accumulation';
  if (row.score >= 60) return 'Wait Pullback';
  return 'Speculative Only';
}

function groupSmallMidRows(rows: BottleneckRow[]) {
  return {
    breakoutReady: rows.filter(row => classifySmallMidGroup(row) === 'Breakout Ready'),
    waitPullback: rows.filter(row => classifySmallMidGroup(row) === 'Wait Pullback'),
    earlyAccumulation: rows.filter(row => classifySmallMidGroup(row) === 'Early Accumulation'),
    speculativeOnly: rows.filter(row => classifySmallMidGroup(row) === 'Speculative Only'),
    avoidTooExtended: rows.filter(row => classifySmallMidGroup(row) === 'Avoid / Too Extended')
  };
}

function buildSmallMidProfile(row: BottleneckRow) {
  const group = classifySmallMidGroup(row);
  const price = row.price ?? 0;
  const riskLevel = group === 'Breakout Ready' || group === 'Early Accumulation'
    ? 'Medium'
    : group === 'Wait Pullback'
      ? 'Medium-High'
      : 'High';

  return {
    group,
    whyItMatters: `Sells into ${row.category}; thesis needs revenue, backlog, contract, or capacity evidence rather than AI branding alone.`,
    entryTrigger: price > 0
      ? `Breakout/retest above $${(price * 1.03).toFixed(2)} with RVOL > 1.3 and base holding`
      : 'Confirmed breakout/retest with RVOL > 1.3 and base holding',
    target1: price > 0 ? `$${(price * 1.18).toFixed(2)}` : 'Data required',
    target2: price > 0 ? `$${(price * 1.35).toFixed(2)}` : 'Data required',
    riskLevel,
    finalView: group === 'Avoid / Too Extended'
      ? 'Avoid / Wait New Base'
      : group === 'Speculative Only'
        ? 'Speculative Only'
        : group
  };
}

function groupRows(rows: BottleneckRow[]) {
  return {
    core: rows.filter(row => row.group === 'Core Bottleneck'),
    emerging: rows.filter(row => row.group === 'Emerging Bottleneck'),
    speculative: rows.filter(row => row.group === 'Speculative Bottleneck'),
    avoid: rows.filter(row => row.group === 'Avoid / Too Extended')
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

const ScoreBadge: React.FC<{ score: number }> = ({ score }) => (
  <span className={`inline-flex items-center justify-center min-w-12 px-2 py-1 rounded border text-xs font-black ${
    score >= 85 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
      score >= 75 ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' :
        score >= 65 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
          score >= 50 ? 'bg-orange-500/10 text-orange-300 border-orange-500/30' :
            'bg-rose-500/10 text-rose-300 border-rose-500/30'
  }`}>{score}</span>
);

const translateBottleneckGroup = (group: AiBottleneckGroup) => ({
  'Core Bottleneck': 'คอขวดหลัก',
  'Emerging Bottleneck': 'คอขวดเกิดใหม่',
  'Speculative Bottleneck': 'เก็งกำไรสูง',
  'Avoid / Too Extended': 'ควรเลี่ยง / วิ่งไกลเกินไป'
}[group] ?? group);

const translateSmallMidGroup = (group: SmallMidGroup) => ({
  'Breakout Ready': 'พร้อม Breakout',
  'Wait Pullback': 'รอย่อ / รอฐานใหม่',
  'Early Accumulation': 'สะสมระยะแรก',
  'Speculative Only': 'เก็งกำไรเท่านั้น',
  'Avoid / Too Extended': 'ควรเลี่ยง / วิ่งไกลเกินไป'
}[group] ?? group);

const GroupCard: React.FC<{ title: AiBottleneckGroup; rows: BottleneckRow[]; onSelectSymbol?: (symbol: string) => void }> = ({ title, rows, onSelectSymbol }) => (
  <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/40">
    <div className="text-xs font-black text-white mb-3">{translateBottleneckGroup(title)}</div>
    <div className="space-y-2">
      {rows.slice(0, 4).map(row => (
        <button key={`${title}-${row.ticker}`} onClick={() => onSelectSymbol?.(row.ticker)} className="w-full flex items-center justify-between gap-3 text-left hover:bg-slate-900 rounded p-2">
          <span className="text-xs font-bold text-cyan-300">{row.ticker}</span>
          <ScoreBadge score={row.score} />
        </button>
      ))}
      {rows.length === 0 && <div className="text-xs text-slate-500">ยังไม่มีหุ้นในกลุ่มนี้</div>}
    </div>
  </div>
);

const SmallMidGroupCard: React.FC<{ title: SmallMidGroup; rows: BottleneckRow[]; onSelectSymbol?: (symbol: string) => void }> = ({ title, rows, onSelectSymbol }) => (
  <div className="border border-slate-800 rounded-lg p-3 bg-slate-950/40">
    <div className="text-[11px] font-black text-white mb-2">{translateSmallMidGroup(title)}</div>
    <div className="space-y-2">
      {rows.slice(0, 3).map(row => (
        <button key={`${title}-${row.ticker}`} onClick={() => onSelectSymbol?.(row.ticker)} className="w-full flex items-center justify-between gap-2 text-left hover:bg-slate-900 rounded p-2">
          <span>
            <span className="block text-xs font-bold text-fuchsia-300">{row.ticker}</span>
            <span className="block text-[10px] text-slate-500">{toThaiDisplay(row.technical.pattern)}</span>
          </span>
          <ScoreBadge score={row.score} />
        </button>
      ))}
      {rows.length === 0 && <div className="text-xs text-slate-500">ยังไม่มีหุ้นในกลุ่มนี้</div>}
    </div>
  </div>
);

const PositionSizeCell: React.FC<{ plan: AiBottleneckTradingPlan; portfolioSize: number }> = ({ plan, portfolioSize }) => {
  const size = plan.positionSizes.find(item => item.portfolioValue === portfolioSize);
  if (!size || size.shares === null || size.dollars === null || size.maxLossDollars === null) {
    return <div className="text-amber-300">ต้องการข้อมูลเพิ่ม / ยังไม่เข้า</div>;
  }

  return (
    <div className="space-y-1">
      <div className="font-bold text-white">{size.shares} sh / ${size.dollars.toFixed(2)}</div>
      <div className="text-[10px] text-slate-500">เสี่ยง ${size.maxLossDollars.toFixed(2)} จากงบ ${size.riskBudget.toFixed(2)}</div>
      <div className="text-[10px] text-slate-500">Cap {(size.allocationCapPercent * 100).toFixed(1)}%</div>
    </div>
  );
};

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

const DeepLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border-b border-slate-800 py-2 last:border-0">
    <div className="text-[10px] uppercase tracking-wider text-cyan-300 font-black">{toThaiDisplay(label)}</div>
    <div className="text-xs text-slate-300 mt-1 leading-relaxed">{toThaiDisplay(value)}</div>
  </div>
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
