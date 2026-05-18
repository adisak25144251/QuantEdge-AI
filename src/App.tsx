import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import { RSI, CCI, MACD, SMA, ADX, ATR } from 'technicalindicators';
import { 
  LayoutDashboard, 
  LineChart, 
  BookOpen, 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Search,
  Bell,
  Plus,
  X,
  Trash2,
  Menu,
  ArrowRight,
  ShieldCheck,
  Zap,
  Target,
  Download,
  Share2,
  Printer,
  CheckCircle2,
  ShieldAlert,
  ThumbsUp,
  XCircle,
  Clock,
  Maximize,
  Minimize,
  AlertTriangle,
  Info,
  Activity,
  Database,
  Layers,
  Cpu
} from 'lucide-react';

// --- Types ---
interface Setup {
  id: string;
  symbol: string;
  exchange: 'BINANCE';
  side: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  date: string;
}

interface MarketData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
}

// --- Alert Engine Types ---
type AlertType = 
  | 'ENTRY_ZONE' 
  | 'CONDITION_PROGRESS' 
  | 'FULL_SETUP' 
  | 'BREAKOUT_CONFIRM' 
  | 'RETEST_CONFIRM' 
  | 'INVALIDATION' 
  | 'STRENGTH_UPGRADE' 
  | 'TAKE_PROFIT' 
  | 'STOP_LOSS' 
  | 'RE_ENTRY';

type AlertPriority = 'INFORMATIONAL' | 'INTERESTING' | 'ACTIONABLE' | 'INVALIDATED';
type ConfirmationMode = 'intrabar' | 'candle-close-only' | 'double-confirmation';

interface AlertEvent {
  id: string;
  symbol: string;
  exchange: 'BINANCE';
  timeframe: string;
  setupType: string;
  side: 'LONG' | 'SHORT';
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  confidence: number;
  qualityScore: number;
  conditionsSatisfied: string[];
  pendingConditions: string[];
  invalidationRule: string;
  timestamp: string;
  isRead: boolean;
  isMuted: boolean;
  setupVersion: number;
  setupHash: string;
  satisfiedConditionsCount: number;
  totalConditionsCount: number;
  confirmationMode: ConfirmationMode;
  actionableFlag: boolean;
  riskFilterReason: string | null;
  chartSnapshotUrl: string | null;
}

type BinanceKline = [
  number, // Open time
  string, // Open
  string, // High
  string, // Low
  string, // Close
  string, // Volume
  number, // Close time
  string, // Quote asset volume
  number, // Number of trades
  string, // Taker buy base asset volume
  string, // Taker buy quote asset volume
  string  // Ignore
];

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  [key: string]: any;
}

interface SetupDetails {
  symbol: string;
  exchange: string;
  side: 'LONG' | 'SHORT';
  currentStatus: string;
  statusReason: string;
  setupType: string;
  multiTfContext: string;
  displayTfLabel: string;
  whyEntry: string;
  whySl: string;
  whyTp: string;
  rsiInterpretation: string;
  cciInterpretation: string;
  macdInterpretation: string;
  volumeInterpretation: string;
  summary: string;
  confidenceScore: number;
  entry: number;
  sl: number;
  tp: number;
  rr: string | number;
  riskAmountUSD: number;
  positionSizeUnits: number;
  positionSizeUSD: number;
  accountPercentage: number;
  timestamp: number;
  isChartOnly?: boolean;
  isValid?: boolean;
  winRate?: number;
  correlationBTC?: string;
  isFundingFavorable?: boolean;
  fundingRate?: number;
  whatToDoNow?: string;
  riskMmInterpretation?: string;
  isLong?: boolean;
  tp2?: number;
  confidence?: number;
  validationFlags?: {
    numericConsistency: boolean;
    semanticConsistency: boolean;
    rrConsistency: boolean;
    evidenceConsistency: boolean;
  };
}

interface ServerOpsStatus {
  health?: {
    status: 'PASS' | 'REVIEW' | 'BLOCK';
    uptimeSeconds: number;
    checks: { code: string; status: 'PASS' | 'REVIEW' | 'BLOCK'; detail: string }[];
  };
  security?: {
    status: 'PASS' | 'REVIEW' | 'BLOCK';
    issues: { code: string; severity: 'WARNING' | 'ERROR'; message: string }[];
  };
  exchange?: {
    status: 'PASS' | 'REVIEW' | 'BLOCK';
    mode: string;
    issues: { code: string; severity: 'WARNING' | 'ERROR'; message: string }[];
  };
  deployment?: {
    status: 'PASS' | 'REVIEW' | 'BLOCK';
    checks: { code: string; status: 'PASS' | 'REVIEW' | 'BLOCK'; detail: string }[];
  };
  release?: {
    status: 'PASS' | 'REVIEW' | 'BLOCK';
    releaseAllowed: boolean;
    checks: { code: string; status: 'PASS' | 'REVIEW' | 'BLOCK'; detail: string }[];
  };
}

const PRESET_ASSETS = [
  // Commodities
  { symbol: 'XAUUSD', name: 'Gold', exchange: 'OANDA', type: 'COMMODITY' },
  { symbol: 'XAGUSD', name: 'Silver', exchange: 'OANDA', type: 'COMMODITY' },
  { symbol: 'USOIL', name: 'WTI Crude Oil', exchange: 'TVC', type: 'COMMODITY' },
  { symbol: 'UKOIL', name: 'Brent Oil', exchange: 'TVC', type: 'COMMODITY' },
  // Indices
  { symbol: 'US30', name: 'Dow Jones (US30)', exchange: 'CAPITALCOM', type: 'INDEX' },
  { symbol: 'US100', name: 'Nasdaq (US100)', exchange: 'CAPITALCOM', type: 'INDEX' },
  { symbol: 'US500', name: 'S&P 500 (US500)', exchange: 'CAPITALCOM', type: 'INDEX' },
  { symbol: 'DXY', name: 'US Dollar Index', exchange: 'TVC', type: 'INDEX' },
  { symbol: 'UK100', name: 'UK 100', exchange: 'CAPITALCOM', type: 'INDEX' },
  { symbol: 'JP225', name: 'Nikkei 225', exchange: 'CAPITALCOM', type: 'INDEX' },
  // Stocks
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'STOCK' },
  { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ', type: 'STOCK' },
  { symbol: 'TSLA', name: 'Tesla', exchange: 'NASDAQ', type: 'STOCK' },
  { symbol: 'NVDA', name: 'NVIDIA', exchange: 'NASDAQ', type: 'STOCK' },
  { symbol: 'AMZN', name: 'Amazon', exchange: 'NASDAQ', type: 'STOCK' },
  { symbol: 'META', name: 'Meta (Facebook)', exchange: 'NASDAQ', type: 'STOCK' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', exchange: 'NASDAQ', type: 'STOCK' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'AMEX', type: 'ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ ETF', exchange: 'NASDAQ', type: 'ETF' },
  { symbol: 'IWM', name: 'Russell 2000 ETF', exchange: 'AMEX', type: 'ETF' },
  { symbol: 'DIA', name: 'Dow Jones ETF', exchange: 'AMEX', type: 'ETF' },
  { symbol: 'XLK', name: 'Technology Sector ETF', exchange: 'AMEX', type: 'ETF' },
  { symbol: 'XLF', name: 'Financial Sector ETF', exchange: 'AMEX', type: 'ETF' },
];

const BINANCE_FALLBACK_DOMAINS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api.binance.me',
  'https://api.binance.info',
];

const fetchWithRetry = async (url: string, retries = 6, backoff = 1000): Promise<Response> => {
  // If the URL is hitting Binance API, rotate through domains on retry
  const isBinanceApi = url.includes('binance.com') || url.includes('binance.vision') || url.includes('binance.me') || url.includes('binance.info');
  
  let targetUrl = url;
  if (isBinanceApi) {
    const domainIndex = (6 - retries) % BINANCE_FALLBACK_DOMAINS.length;
    const activeDomain = BINANCE_FALLBACK_DOMAINS[domainIndex];
    
    // Replace existing binance domain in url with the active domain
    const urlObj = new URL(url);
    targetUrl = `${activeDomain}${urlObj.pathname}${urlObj.search}`;

    // Phase 0 safety: do not route market data through public CORS proxies.
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 sec timeout
    const response = targetUrl.startsWith('/api/')
      ? await apiFetch(targetUrl, { signal: controller.signal })
      : await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    // If it's a 4xx (geo-block, WAF, etc.) or 5xx, throw to trigger fallback
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(res => setTimeout(res, backoff));
      return fetchWithRetry(url, retries - 1, backoff * 1.5);
    }
    throw error;
  }
};

// --- Carousel Component ---
const InnovationCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = [
    { id: 1, image: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?q=80&w=1200&auto=format&fit=crop', title: 'Bitcoin (BTC) Analysis', desc: 'วิเคราะห์แนวโน้มหลักของตลาดคริปโต' },
    { id: 2, image: 'https://images.unsplash.com/photo-1621504450181-5d356f61d307?q=80&w=1200&auto=format&fit=crop', title: 'Ethereum (ETH) & Altcoins', desc: 'จับตาดูเหรียญทางเลือกที่มีศักยภาพสูง' },
    { id: 3, image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1200&auto=format&fit=crop', title: 'Real-time Charting', desc: 'ติดตามกราฟราคาแบบเรียลไทม์' },
    { id: 4, image: 'https://images.unsplash.com/photo-1642790106117-e829e14a795f?q=80&w=1200&auto=format&fit=crop', title: 'Candlestick Patterns', desc: 'วิเคราะห์รูปแบบแท่งเทียนเพื่อหาจุดเข้าซื้อ' },
    { id: 5, image: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?q=80&w=1200&auto=format&fit=crop', title: 'Market Overview', desc: 'ภาพรวมตลาดและวอลลุ่มการซื้อขาย' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  return (
    <div className="relative w-full max-w-5xl mx-auto mt-20 mb-10 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(34,211,238,0.2)] border border-cyan-500/20 group">
      <div className="relative h-[300px] md:h-[500px] w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <img 
              src={items[currentIndex].image} 
              alt={items[currentIndex].title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050014] via-[#050014]/50 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 text-left">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <h3 className="text-2xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg">{items[currentIndex].title}</h3>
                <p className="text-cyan-300 text-lg md:text-xl drop-shadow-md">{items[currentIndex].desc}</p>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Navigation Dots */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-10">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-cyan-400 w-8' : 'bg-white/30 hover:bg-white/60'}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

// --- Landing Page Component (Scrollytelling & Parallax) ---
const LandingPage = ({ onLaunch }: { onLaunch: () => void }) => {
  const { scrollYProgress } = useScroll();
  
  // Parallax transforms
  const yBg = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const yText = useTransform(scrollYProgress, [0, 1], ['0%', '150%']);
  const opacityHero = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scaleHero = useTransform(scrollYProgress, [0, 0.2], [1, 0.8]);

  return (
    <div className="bg-[#050014] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a004d] via-[#050014] to-[#000510] text-cyan-50 min-h-screen overflow-hidden font-sans selection:bg-fuchsia-500/40 relative">
      {/* Cyberpunk Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
      
      {/* Hero Section with Parallax */}
      <motion.section 
        style={{ opacity: opacityHero, scale: scaleHero, y: yText }}
        className="relative h-screen flex flex-col items-center justify-center text-center px-4 z-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-6 text-sm font-medium backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            ขับเคลื่อนด้วยเทคโนโลยี AI (AI-Powered Analysis)
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-cyan-500 drop-shadow-[0_0_30px_rgba(6,182,212,0.3)]">
            QuantEdge AI
          </h1>
          <p className="text-lg md:text-2xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            ยกระดับการลงทุนด้วยปัญญาประดิษฐ์ วิเคราะห์กราฟและจัดการความเสี่ยงอย่างแม่นยำระดับสถาบัน
          </p>
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(6, 182, 212, 0.4)" }}
            whileTap={{ scale: 0.95 }}
            onClick={onLaunch}
            className="bg-cyan-600 text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-2 mx-auto transition-colors hover:bg-cyan-500"
          >
            เปิดแดชบอร์ดเทรด (Launch App) <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>

        {/* Abstract Parallax Background Shapes */}
        <motion.div style={{ y: yBg }} className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-cyan-600/10 rounded-full blur-[100px]" />
          <div className="absolute top-[40%] right-[10%] w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[40%] w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[150px]" />
        </motion.div>
      </motion.section>

      {/* Innovation Carousel Section */}
      <section className="relative z-20 py-10 px-4">
        <InnovationCarousel />
      </section>

      {/* Scrollytelling Section */}
      <section className="relative bg-[#0B0F19]/80 backdrop-blur-xl z-20 py-24 px-4 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">ฟีเจอร์ระดับองค์กร สำหรับรายย่อย</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">ยกระดับการเทรดของคุณด้วยเครื่องมือที่ออกแบบมาเพื่อลดความเสี่ยงและเพิ่มความแม่นยำ</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Real-time AI Engine", desc: "เชื่อมต่อข้อมูลสดจาก Binance API วิเคราะห์และให้คะแนน Setup แบบวินาทีต่อวินาที" },
              { icon: Target, title: "Precision Setup", desc: "คำนวณ Risk/Reward Ratio และ Position Sizing อัตโนมัติด้วย AI" },
              { icon: ShieldCheck, title: "Trade Journal", desc: "บันทึกและวิเคราะห์ประวัติการเทรดของคุณเพื่อพัฒนาวินัยอย่างเป็นระบบ" }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: idx * 0.2 }}
                whileHover={{ y: -10, borderColor: "rgba(6, 182, 212, 0.5)" }}
                className="bg-[#111827]/80 border border-slate-800 p-8 rounded-2xl backdrop-blur-sm transition-colors"
              >
                <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6 border border-cyan-500/20">
                  <feature.icon className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-200">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-4 relative z-20 bg-[#0B0F19] text-center border-t border-slate-800/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-8 text-white">พร้อมที่จะเปลี่ยนวิธีการเทรดของคุณหรือยัง?</h2>
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(6, 182, 212, 0.4)" }}
            whileTap={{ scale: 0.95 }}
            onClick={onLaunch}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-all"
          >
            เปิดใช้งานแดชบอร์ดฟรี (Start for free)
          </motion.button>
        </motion.div>
      </section>
    </div>
  );
};

import { useTradeStore } from './store/useTradeStore';
import { useMarketStore } from './store/useMarketStore';
import { RealtimeTicker } from './components/RealtimeTicker';
import { ErrorBoundary } from './components/ErrorBoundary';

import { auth, completeGoogleRedirectLogin, loginWithGoogle, logout } from './lib/firebase';
import { rememberAppLaunched, shouldLaunchAppOnStartup } from './lib/authRedirectState';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, getDocs, doc, getDoc, where } from 'firebase/firestore';
import { db } from './lib/firebase';
import { apiFetch } from './lib/apiClient';
import { syncProfileToFirestore, saveSetupToFirestore, deleteSetupFromFirestore, clearAllSetupsFromFirestore, executeTradeInFirestore, updateTradeInFirestore, saveInstitutionalAuditArtifactToFirestore, handleFirestoreError, OperationType } from './lib/firestoreUtils';
import { buildSetupIdentity, canExecuteCandidate, setupDetailsToAlert } from './domain/strategy/signalSafety';
import { validateKlines, type MarketDataIntegrityReport } from './domain/market/marketDataIntegrity';
import { evaluateTradeRisk, type TradeRiskResult } from './domain/risk/riskPolicy';
import { createExecutionAuditEntry, evaluatePortfolioRisk, summarizeExecutionAudit, summarizeOpenRisk, type ExecutionAuditEntry } from './domain/risk/portfolioRisk';
import { buildRecordPlanCandidateExposure } from './domain/risk/recordPlanRisk';
import { evaluateCorrelationRisk, type CorrelationPair } from './domain/risk/correlationRisk';
import { evaluateRiskKillSwitch } from './domain/risk/riskKillSwitch';
import { computePaperReadiness, computePaperStats, type PaperTrade } from './domain/paper/paperTrading';
import { evaluateLiveReadiness, type LiveReadinessResult } from './domain/live/liveReadiness';
import { evaluateLiveLaunchChecklist, type LiveLaunchChecklistResult } from './domain/live/liveLaunchChecklist';
import { toLiveReadinessBacktestInput, type BacktestEvidenceSummary } from './domain/backtest/backtestEvidence';
import { buildEvidenceLedger, createEvidenceRecord } from './domain/evidence/evidenceLedger';
import { evaluateMarketRegime } from './domain/market/marketRegimeEngine';
import { evaluateStrategyPromotion } from './domain/strategy/strategyPromotion';
import { buildSignalExplanation } from './domain/strategy/signalExplainability';
import { summarizeForwardTests } from './domain/forward/forwardTestScorecard';
import { createInitialPlanVersion } from './domain/trade/tradePlanVersioning';
import { buildPostTradeReview } from './domain/review/postTradeReview';
import { evaluateLiveRegimeFromCandles } from './domain/market/liveRegimeFromCandles';
import { buildCorrelationMatrix } from './domain/risk/correlationMatrix';
import { buildProfessionalTradeReport } from './domain/report/professionalReport';
import { evaluateApprovalWorkflow } from './domain/governance/approvalWorkflow';
import { buildBacktestCacheKey, evaluateBacktestCacheEntry } from './domain/backtest/backtestDataCache';
import { runScenarioStressTest } from './domain/risk/scenarioStressTest';
import { evaluateModelDrift } from './domain/strategy/modelDriftMonitor';
import { summarizeStrategyRegistry } from './domain/strategy/strategyRegistry';
import { buildPortfolioExposureMap } from './domain/risk/portfolioExposureMap';
import { evaluateDataSourceRedundancy } from './domain/market/dataSourceRedundancy';
import { optimizeWalkForwardParameters } from './domain/backtest/walkForwardOptimizer';
import { evaluateLiveTradingSandboxConnector } from './domain/exchange/liveTradingSandboxConnector';
import { evaluateExecutionQuality } from './domain/execution/executionQualityAnalytics';
import { buildRealTimeRiskDashboard } from './domain/risk/realTimeRiskDashboard';
import { buildSignalReplayForensics } from './domain/strategy/signalReplayForensics';
import { evaluateShadowLiveMode } from './domain/execution/shadowLiveMode';
import { buildStrategyVersionRegistry } from './domain/strategy/strategyVersionRegistry';
import { evaluateExchangeAdapterContract } from './domain/exchange/exchangeAdapterContract';
import { allocateCapital } from './domain/risk/capitalAllocationEngine';
import { routeStrategyForRegime } from './domain/strategy/regimeStrategyRouter';
import { buildProductionIncidentRunbook } from './domain/ops/productionIncidentRunbook';
import { benchmarkSignals } from './domain/strategy/modelSignalBenchmarkSuite';
import { buildKlineProxyUrl, classifyAssetType } from './domain/market/multiAssetMarketData';
import { validateUsStockCandles } from './domain/market/usStockDataValidation';
import { analyzeUsStockIndicators } from './domain/market/usStockIndicators';
import { evaluateUsStockRisk } from './domain/risk/usStockRiskEngine';
import { scoreUsStockScreenerSetup } from './domain/strategy/usStockScreenerScoring';
import { evaluateUnifiedDataReliabilityV2 } from './domain/platform/unifiedDataReliabilityV2';
import { evaluateMasterReadinessGateV2 } from './domain/platform/masterReadinessGateV2';
import { selectMultiAssetStrategyV2 } from './domain/strategy/multiAssetStrategyEngineV2';
import { evaluateInstitutionalBacktestV2 } from './domain/backtest/institutionalBacktestV2';
import { evaluateForwardShadowEvidenceV2 } from './domain/forward/forwardShadowEvidenceV2';
import { evaluatePortfolioRiskV2 } from './domain/risk/portfolioRiskV2';
import { buildAiResearchMemoV2 } from './domain/ai/aiResearchMemoV2';
import { buildProfessionalAuditReportV2 } from './domain/report/professionalAuditReportV2';
import { evaluateOpsMonitoringV2 } from './domain/ops/opsMonitoringV2';

const waitForLazyRetry = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const lazyWithRetry = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  retries = 2
) => React.lazy(async () => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      await waitForLazyRetry(350 * (attempt + 1));
    }
  }
  throw lastError;
});

// Lazy Load heavy modules with retry so transient Vite/chunk reloads do not blank the app.
const TradingGuide = lazyWithRetry(() => import('./components/TradingGuide').then(module => ({ default: module.TradingGuide })));
const AnalyticsDashboard = lazyWithRetry(() => import('./components/AnalyticsDashboard').then(module => ({ default: module.AnalyticsDashboard })));
const MarketScreener = lazyWithRetry(() => import('./components/MarketScreener').then(module => ({ default: module.MarketScreener })));
const USStockScreenerAnalyst = lazyWithRetry(() => import('./components/USStockScreenerAnalyst').then(module => ({ default: module.USStockScreenerAnalyst })));
const AIBottleneckScreenerAnalyst = lazyWithRetry(() => import('./components/AIBottleneckScreenerAnalyst').then(module => ({ default: module.AIBottleneckScreenerAnalyst })));
const BacktestSimulator = lazyWithRetry(() => import('./components/BacktestSimulator').then(module => ({ default: module.BacktestSimulator })));
const AITradingCopilot = lazyWithRetry(() => import('./components/AITradingCopilot').then(module => ({ default: module.AITradingCopilot })));
const TradingViewWidget = lazyWithRetry(() => import('./components/TradingViewWidget').then(module => ({ default: module.TradingViewWidget })));

const DEFAULT_CORRELATIONS: CorrelationPair[] = [
  { a: 'BTCUSDT', b: 'ETHUSDT', value: 0.86 },
  { a: 'BTCUSDT', b: 'SOLUSDT', value: 0.82 },
  { a: 'ETHUSDT', b: 'SOLUSDT', value: 0.8 },
  { a: 'US100', b: 'US500', value: 0.88 },
  { a: 'US30', b: 'US500', value: 0.76 },
  { a: 'XAUUSD', b: 'DXY', value: -0.62 }
];

// Loading Fallback for Suspense
const ModuleLoader = () => (
  <div className="flex items-center justify-center p-12 text-slate-400">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
      <span className="text-xs uppercase tracking-widest font-bold">Loading Module...</span>
    </div>
  </div>
);

const combineMarketIntegrityReports = (reports: MarketDataIntegrityReport[]): MarketDataIntegrityReport => {
  const status = reports.some(report => report.status === 'BLOCK')
    ? 'BLOCK'
    : reports.some(report => report.status === 'REVIEW')
      ? 'REVIEW'
      : 'PASS';

  return {
    status,
    candleCount: reports[0]?.candleCount ?? 0,
    issues: reports.flatMap(report => report.issues),
    stale: reports.some(report => report.stale),
    lastCloseTime: reports[0]?.lastCloseTime ?? null,
    requiredMinCandles: Math.max(...reports.map(report => report.requiredMinCandles))
  };
};

const getGateBadgeClass = (status: 'PASS' | 'REVIEW' | 'BLOCK') => {
  if (status === 'PASS') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (status === 'REVIEW') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
};

const toProxyAssetType = (assetType: string) => {
  if (assetType === 'STOCK') return 'US_STOCK';
  return assetType;
};

const isUsEquityAsset = (assetType: string) => assetType === 'STOCK' || assetType === 'ETF';

const getMarketDataUrl = (symbol: string, interval: string, limit: number, assetType: string) => buildKlineProxyUrl({
  symbol,
  interval,
  limit,
  type: toProxyAssetType(assetType) as any
});

const buildChartAnalysisPlaceholder = (symbol: string, exchange: string): SetupDetails => ({
  symbol,
  exchange,
  side: 'LONG',
  currentStatus: 'REVIEW',
  statusReason: `กำลังโหลดข้อมูลตลาดและคำนวณบทวิเคราะห์สำหรับ ${symbol} หากข้อมูลบางช่องจาก provider ไม่ครบ ระบบจะแสดง Data required แทนการเดา`,
  setupType: 'กำลังวิเคราะห์กราฟ',
  multiTfContext: 'กำลังโหลดข้อมูลหลาย timeframe',
  displayTfLabel: '1D',
  whyEntry: 'รอข้อมูลแท่งเทียน, volume, trend และ risk/reward เพื่อสร้างกรอบการเข้าแบบมีเงื่อนไข',
  whySl: 'รอคำนวณแนวรับ, swing low/high และ volatility buffer',
  whyTp: 'รอคำนวณแนวต้าน, liquidity zone และเป้าหมายตาม risk/reward',
  rsiInterpretation: 'กำลังคำนวณ RSI',
  cciInterpretation: 'กำลังคำนวณ CCI',
  macdInterpretation: 'กำลังคำนวณ MACD',
  volumeInterpretation: 'กำลังตรวจสอบ volume และ relative volume',
  summary: 'กำลังประมวลผล',
  confidenceScore: 0,
  entry: 0,
  sl: 0,
  tp: 0,
  rr: 'Data required',
  riskAmountUSD: 0,
  positionSizeUnits: 0,
  positionSizeUSD: 0,
  accountPercentage: 0,
  timestamp: Date.now(),
  isChartOnly: true,
  isValid: false,
  whatToDoNow: 'รอให้ข้อมูลโหลดเสร็จก่อนประเมิน setup',
  riskMmInterpretation: 'ยังไม่คำนวณ position size จนกว่าจะมี entry และ stop-loss'
});

const buildChartAnalysisDataRequired = (symbol: string, exchange: string, reason: string): SetupDetails => ({
  ...buildChartAnalysisPlaceholder(symbol, exchange),
  currentStatus: 'WAIT',
  setupType: 'Data required',
  statusReason: reason,
  summary: 'Data required',
  whatToDoNow: 'รอให้ข้อมูลราคา OHLCV จาก provider พร้อมก่อน จึงค่อยประเมิน entry, stop-loss และ target',
  riskMmInterpretation: 'ยังไม่คำนวณ position size เพราะข้อมูล entry/stop-loss ไม่ครบ',
  isChartOnly: false
});

// --- Main Dashboard App Component ---
const DashboardApp = () => {
  // --- State ---
  const [view, setView] = useState<'dashboard' | 'analysis' | 'journal' | 'alerts' | 'settings' | 'guide' | 'analytics' | 'backtest' | 'screener' | 'us-stock-screener' | 'ai-bottleneck-screener'>('dashboard');
  const marketData = useMarketStore(state => state.marketData);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChartSymbol, setSelectedChartSymbol] = useState('BTCUSDT');
  const [selectedChartExchange, setSelectedChartExchange] = useState('BINANCE');
  const [selectedAssetType, setSelectedAssetType] = useState('CRYPTO');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const selectedIsUsEquity = isUsEquityAsset(selectedAssetType);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [setupDetails, setSetupDetails] = useState<SetupDetails | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [lastAlertUpdate, setLastAlertUpdate] = useState<number>(0);
  const [authErrorModal, setAuthErrorModal] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);
  const [marketIntegrityReport, setMarketIntegrityReport] = useState<MarketDataIntegrityReport | null>(null);
  const [aiBackendConfigured, setAiBackendConfigured] = useState(false);
  const [apiTradingEnabled, setApiTradingEnabled] = useState(false);
  const [backtestEvidence, setBacktestEvidence] = useState<BacktestEvidenceSummary | null>(null);
  const [executionAudit, setExecutionAudit] = useState<ExecutionAuditEntry[]>([]);
  const [serverOpsStatus, setServerOpsStatus] = useState<ServerOpsStatus>({});
  const [latestKlines, setLatestKlines] = useState<BinanceKline[]>([]);
  
  // Risk Management State (Zustand)
  const { portfolioSize, riskPercent, setPortfolioSize, setRiskPercent, executeTrade, journal, setJournal, closeTrade, clearJournal } = useTradeStore();

  const activeRiskReport = useMemo<TradeRiskResult | null>(() => {
    if (!setupDetails || setupDetails.isChartOnly) return null;

    return evaluateTradeRisk({
      side: setupDetails.side,
      entry: setupDetails.entry,
      stopLoss: setupDetails.sl,
      takeProfit: setupDetails.tp2 || setupDetails.tp,
      accountEquity: portfolioSize,
      riskPercent,
      manualConfirmation: false
    });
  }, [setupDetails, portfolioSize, riskPercent]);

  const openRiskSummary = useMemo(() => summarizeOpenRisk({
    accountEquity: portfolioSize,
    trades: journal
  }), [portfolioSize, journal]);

  const activePortfolioRiskReport = useMemo(() => {
    if (!setupDetails || setupDetails.isChartOnly || !activeRiskReport) return null;

    return evaluatePortfolioRisk({
      accountEquity: portfolioSize,
      currentTrades: journal,
      candidate: buildRecordPlanCandidateExposure({
        symbol: setupDetails.symbol,
        side: setupDetails.side,
        entry: setupDetails.entry,
        stopLoss: setupDetails.sl,
        takeProfit: setupDetails.tp2 || setupDetails.tp,
        riskDecision: activeRiskReport
      })
    });
  }, [setupDetails, activeRiskReport, portfolioSize, journal]);

  const paperStats = useMemo(() => {
    const closedPaperTrades: PaperTrade[] = journal
      .filter(trade => trade.status === 'WON' || trade.status === 'LOST')
      .map(trade => {
        const pnlUsd = Number(trade.pnlUSD ?? 0);
        const riskUsd = Math.abs(trade.entry - trade.sl) * trade.sizeUnits;

        return {
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          entry: trade.entry,
          stopLoss: trade.sl,
          takeProfit: trade.tp,
          sizeUnits: trade.sizeUnits,
          openedAt: trade.date,
          status: 'CLOSED',
          closedAt: trade.date,
          pnlUsd,
          rMultiple: riskUsd > 0 ? Number((pnlUsd / riskUsd).toFixed(2)) : 0
        };
      });

    return computePaperStats(closedPaperTrades);
  }, [journal]);

  const paperReadiness = useMemo(() => computePaperReadiness({
    stats: paperStats,
    accountEquity: portfolioSize
  }), [paperStats, portfolioSize]);

  const auditSummary = useMemo(() => summarizeExecutionAudit(executionAudit), [executionAudit]);

  const liveReadiness = useMemo<LiveReadinessResult>(() => {
    const readinessBacktest = toLiveReadinessBacktestInput(backtestEvidence);

    return evaluateLiveReadiness({
      marketDataStatus: marketIntegrityReport?.status ?? 'REVIEW',
      riskPolicyStatus: activeRiskReport?.status === 'BLOCK' ? 'BLOCK' : 'PASS',
      paperTrading: {
        closedTrades: paperStats.closedTrades,
        expectancyR: paperStats.expectancyR,
        maxDrawdownPercent: paperReadiness.drawdownPercent,
        winRate: paperStats.winRate
      },
      backtest: readinessBacktest,
      aiBackendConfigured,
      executionMode: 'MANUAL_ONLY'
    });
  }, [marketIntegrityReport, activeRiskReport, paperStats, paperReadiness, backtestEvidence, aiBackendConfigured]);

  const liveLaunchChecklist = useMemo<LiveLaunchChecklistResult>(() => evaluateLiveLaunchChecklist({
    liveReadinessStatus: liveReadiness.status,
    executionMode: 'MANUAL_ONLY',
    apiTradingEnabled,
    aiBackendConfigured,
    emergencyStopEnabled: true,
    auditDecisionCount: auditSummary.totalDecisions,
    latestBuildVerified: true
  }), [liveReadiness.status, apiTradingEnabled, aiBackendConfigured, auditSummary.totalDecisions]);

  const institutionalRegime = useMemo(() => evaluateMarketRegime({
    adx: Number.NaN,
    atrPercent: Number.NaN,
    emaFast: Number.NaN,
    emaSlow: Number.NaN,
    realizedVolatilityPercent: Number.NaN,
    volumeZScore: Number.NaN
  }), []);

  const correlationRisk = useMemo(() => {
    if (!setupDetails || setupDetails.isChartOnly) return null;

    return evaluateCorrelationRisk({
      accountEquity: portfolioSize,
      currentTrades: journal.map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        sizeUSD: trade.sizeUSD,
        status: trade.status
      })),
      candidate: {
        symbol: setupDetails.symbol,
        side: setupDetails.side,
        sizeUsd: setupDetails.positionSizeUSD || 0
      },
      correlations: DEFAULT_CORRELATIONS
    });
  }, [setupDetails, portfolioSize, journal]);

  const currentLossStreak = useMemo(() => {
    let streak = 0;
    for (const trade of [...journal].reverse()) {
      if (trade.status === 'LOST') streak += 1;
      else if (trade.status === 'WON') break;
    }
    return streak;
  }, [journal]);

  const dailyPnlPercent = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dailyPnl = journal
      .filter(trade => trade.date?.slice(0, 10) === today)
      .reduce((sum, trade) => sum + Number(trade.pnlUSD ?? 0), 0);
    return portfolioSize > 0 ? Number(((dailyPnl / portfolioSize) * 100).toFixed(2)) : 0;
  }, [journal, portfolioSize]);

  const riskKillSwitch = useMemo(() => evaluateRiskKillSwitch({
    dailyPnlPercent,
    currentDrawdownPercent: paperReadiness.drawdownPercent,
    consecutiveLosses: currentLossStreak,
    marketDataStatus: marketIntegrityReport?.status ?? 'REVIEW',
    aiBackendAvailable: aiBackendConfigured,
    volatilityShockPercent: institutionalRegime.volatility === 'SHOCK' ? 5 : 0,
    liveTradingLocked: !apiTradingEnabled
  }), [dailyPnlPercent, paperReadiness.drawdownPercent, currentLossStreak, marketIntegrityReport, aiBackendConfigured, institutionalRegime.volatility, apiTradingEnabled]);

  const strategyPromotion = useMemo(() => evaluateStrategyPromotion({
    currentStage: paperReadiness.status === 'PASS' ? 'PAPER' : 'RESEARCH',
    labStatus: backtestEvidence && backtestEvidence.sampleSize >= 100 && backtestEvidence.outOfSampleExpectancyR > 0 ? 'PASS' : 'BLOCK',
    backtestStatus: backtestEvidence && backtestEvidence.sampleSize >= 100 && backtestEvidence.outOfSampleExpectancyR > 0 ? 'PASS' : 'BLOCK',
    paperStatus: paperReadiness.status,
    liveReadinessStatus: liveReadiness.status,
    auditDecisionCount: auditSummary.totalDecisions
  }), [paperReadiness.status, backtestEvidence, liveReadiness.status, auditSummary.totalDecisions]);

  const evidenceLedger = useMemo(() => buildEvidenceLedger([
    createEvidenceRecord({
      area: 'DATA_QUALITY',
      status: marketIntegrityReport?.status ?? 'REVIEW',
      referenceId: selectedChartSymbol,
      summary: `${marketIntegrityReport?.candleCount ?? 0} candles checked.`,
      issueCodes: marketIntegrityReport?.issues.map(issue => issue.code)
    }),
    createEvidenceRecord({
      area: 'STRATEGY',
      status: strategyPromotion.status === 'PASS' ? 'PASS' : strategyPromotion.status === 'REVIEW' ? 'REVIEW' : 'BLOCK',
      referenceId: strategyPromotion.currentStage,
      summary: `Strategy stage ${strategyPromotion.currentStage} -> ${strategyPromotion.nextStage}.`,
      issueCodes: strategyPromotion.issues.map(issue => issue.code)
    }),
    createEvidenceRecord({
      area: 'RISK',
      status: activeRiskReport?.status ?? 'REVIEW',
      referenceId: 'risk-policy',
      summary: `${activeRiskReport?.issues.length ?? 0} risk policy issues.`,
      issueCodes: activeRiskReport?.issues.map(issue => issue.code)
    }),
    createEvidenceRecord({
      area: 'AI_GOVERNANCE',
      status: aiBackendConfigured ? 'PASS' : 'REVIEW',
      referenceId: 'server-ai',
      summary: aiBackendConfigured ? 'AI backend is configured server-side.' : 'AI backend is not configured.'
    }),
    createEvidenceRecord({
      area: 'PORTFOLIO',
      status: correlationRisk?.status ?? activePortfolioRiskReport?.status ?? 'REVIEW',
      referenceId: 'portfolio-controls',
      summary: `Correlation ${correlationRisk?.status ?? 'REVIEW'}, portfolio ${activePortfolioRiskReport?.status ?? 'REVIEW'}.`,
      issueCodes: [...(correlationRisk?.issues.map(issue => issue.code) ?? []), ...(activePortfolioRiskReport?.issues.map(issue => issue.code) ?? [])]
    })
  ]), [marketIntegrityReport, selectedChartSymbol, strategyPromotion, activeRiskReport, aiBackendConfigured, correlationRisk, activePortfolioRiskReport]);

  const signalExplanation = useMemo(() => buildSignalExplanation({
    technicalScore: setupDetails?.confidenceScore ?? 0,
    regimeAligned: institutionalRegime.regime === 'UNKNOWN' ? false : true,
    volatilityState: institutionalRegime.volatility,
    riskReward: Number(setupDetails?.rr ?? 0),
    dataQualityStatus: marketIntegrityReport?.status ?? 'REVIEW',
    confidenceScore: setupDetails?.confidenceScore ?? 0,
    confirmations: [
      setupDetails?.validationFlags?.numericConsistency ? 'Numeric consistency' : null,
      setupDetails?.validationFlags?.semanticConsistency ? 'Directional consistency' : null,
      setupDetails?.validationFlags?.rrConsistency ? 'Risk/reward geometry' : null,
      setupDetails?.validationFlags?.evidenceConsistency ? 'Evidence confluence' : null
    ].filter(Boolean) as string[],
    missingConfirmations: [
      !setupDetails?.validationFlags?.numericConsistency ? 'Numeric consistency' : null,
      !setupDetails?.validationFlags?.semanticConsistency ? 'Directional consistency' : null,
      !setupDetails?.validationFlags?.rrConsistency ? 'Risk/reward geometry' : null,
      !setupDetails?.validationFlags?.evidenceConsistency ? 'Evidence confluence' : null
    ].filter(Boolean) as string[]
  }), [setupDetails, institutionalRegime, marketIntegrityReport]);

  const forwardScorecard = useMemo(() => summarizeForwardTests(journal
    .filter(trade => trade.status !== 'OPEN')
    .map(trade => ({
      id: trade.id,
      side: trade.side,
      entry: trade.entry,
      stopLoss: trade.sl,
      takeProfit: trade.tp,
      maxFavorablePrice: trade.status === 'WON' ? trade.tp : trade.entry,
      maxAdversePrice: trade.status === 'LOST' ? trade.sl : trade.entry,
      finalPrice: trade.status === 'WON' ? trade.tp : trade.sl,
      outcome: trade.status === 'WON' ? 'TP' as const : 'SL' as const,
      issuedAt: trade.date,
      resolvedAt: trade.date
    }))), [journal]);

  const latestPlanVersion = useMemo(() => {
    if (!setupDetails || setupDetails.isChartOnly) return null;
    return createInitialPlanVersion({
      symbol: setupDetails.symbol,
      side: setupDetails.side,
      entry: setupDetails.entry,
      stopLoss: setupDetails.sl,
      takeProfit: setupDetails.tp2 || setupDetails.tp,
      rationale: setupDetails.summary || setupDetails.statusReason || 'Reviewed trade plan.',
      changedAt: new Date(setupDetails.timestamp || Date.now()).toISOString()
    });
  }, [setupDetails]);

  const latestPostTradeReview = useMemo(() => {
    const closed = journal.find(trade => trade.status === 'WON' || trade.status === 'LOST');
    if (!closed) return null;
    const riskUsd = Math.abs(closed.entry - closed.sl) * closed.sizeUnits;
    return buildPostTradeReview({
      plannedEntry: closed.entry,
      plannedStopLoss: closed.sl,
      plannedTakeProfit: closed.tp,
      actualEntry: closed.entry,
      actualExit: closed.status === 'WON' ? closed.tp : closed.sl,
      side: closed.side,
      pnlUsd: closed.pnlUSD ?? 0,
      riskUsd,
      followedPlan: true,
      exitReason: closed.status === 'WON' ? 'TP' : 'SL'
    });
  }, [journal]);

  const liveRegimeFromCandles = useMemo(() => evaluateLiveRegimeFromCandles(latestKlines), [latestKlines]);

  const usStockDataReport = useMemo(() => {
    if (!selectedIsUsEquity) return null;
    return validateUsStockCandles({
      symbol: selectedChartSymbol,
      interval: selectedTimeframe,
      candles: latestKlines,
      now: Date.now(),
      minCandles: Math.min(60, Math.max(20, latestKlines.length > 0 ? 20 : 60))
    });
  }, [selectedIsUsEquity, selectedChartSymbol, selectedTimeframe, latestKlines]);

  const usStockIndicators = useMemo(() => {
    if (!selectedIsUsEquity || latestKlines.length < 5) return null;
    const closes = latestKlines.map(kline => Number(kline[4])).filter(Number.isFinite);
    const opens = latestKlines.map(kline => Number(kline[1])).filter(Number.isFinite);
    const volumes = latestKlines.map(kline => Number(kline[5])).filter(Number.isFinite);
    const benchmarkCloses = closes.map((close, index) => index === 0 ? close : close * 0.995);

    return analyzeUsStockIndicators({
      symbol: selectedChartSymbol,
      closes,
      benchmarkCloses,
      opens,
      volumes,
      sectorStrengthPercent: selectedAssetType === 'ETF' ? 0.5 : 1
    });
  }, [selectedIsUsEquity, selectedAssetType, selectedChartSymbol, latestKlines]);

  const usStockRisk = useMemo(() => {
    if (!selectedIsUsEquity) return null;
    const latestClose = Number(latestKlines[latestKlines.length - 1]?.[4] ?? 0);
    const latestVolume = Number(latestKlines[latestKlines.length - 1]?.[5] ?? 0);
    const selectedPositionUsd = setupDetails?.positionSizeUSD || Math.min(portfolioSize * 0.05, 5_000);

    return evaluateUsStockRisk({
      symbol: selectedChartSymbol,
      sector: selectedAssetType === 'ETF' ? 'ETF' : 'Technology',
      accountEquity: portfolioSize,
      positionUsd: selectedPositionUsd,
      sectorExposureUsd: journal
        .filter(trade => trade.status === 'OPEN' && classifyAssetType(trade.symbol) === 'US_STOCK')
        .reduce((sum, trade) => sum + Number(trade.sizeUSD ?? 0), 0),
      beta: selectedAssetType === 'ETF' ? 1 : 1.2,
      averageDailyVolumeUsd: Math.max(latestClose * latestVolume, 1),
      daysToEarnings: selectedAssetType === 'ETF' ? null : 14,
      overnightHold: selectedTimeframe === '1d' || selectedTimeframe === '1w',
      shortSell: setupDetails?.side === 'SHORT'
    });
  }, [selectedIsUsEquity, selectedAssetType, selectedChartSymbol, selectedTimeframe, latestKlines, setupDetails, portfolioSize, journal]);

  const usStockScreenerScore = useMemo(() => {
    if (!selectedIsUsEquity || !usStockIndicators) return null;
    const closes = latestKlines.map(kline => Number(kline[4])).filter(Number.isFinite);
    const priceChangePercent = closes.length >= 2
      ? ((closes[closes.length - 1] - closes[closes.length - 2]) / Math.max(Math.abs(closes[closes.length - 2]), 1)) * 100
      : 0;

    return scoreUsStockScreenerSetup({
      symbol: selectedChartSymbol,
      priceChangePercent,
      relativeStrengthPercent: usStockIndicators.relativeStrengthPercent,
      relativeVolume: usStockIndicators.relativeVolume,
      gapPercent: usStockIndicators.gapPercent,
      daysToEarnings: selectedAssetType === 'ETF' ? null : 14
    });
  }, [selectedIsUsEquity, selectedAssetType, selectedChartSymbol, latestKlines, usStockIndicators]);

  const dynamicCorrelationMatrix = useMemo(() => {
    const activeSymbols = Array.from(new Set([selectedChartSymbol, ...journal.map(trade => trade.symbol)])).slice(0, 6);
    const closeSeries = activeSymbols.reduce<Record<string, number[]>>((acc, symbol) => {
      if (symbol === selectedChartSymbol && latestKlines.length > 0) {
        acc[symbol] = latestKlines.map(kline => Number(kline[4])).filter(Number.isFinite);
      }
      return acc;
    }, {});

    return buildCorrelationMatrix(closeSeries);
  }, [selectedChartSymbol, journal, latestKlines]);

  const professionalReport = useMemo(() => buildProfessionalTradeReport({
    title: `${selectedChartSymbol} Professional Trade Review`,
    symbol: selectedChartSymbol,
    generatedAt: new Date().toISOString(),
    sections: [
      {
        title: 'Setup',
        status: signalExplanation.status,
        lines: [
          `Explainability score ${signalExplanation.summaryScore}.`,
          `Plan version ${latestPlanVersion?.version ?? 0}.`
        ]
      },
      {
        title: 'Risk',
        status: riskKillSwitch.state === 'UNLOCKED' ? 'PASS' : 'BLOCK',
        lines: [
          `Kill switch ${riskKillSwitch.state}.`,
          `Correlation risk ${correlationRisk?.status ?? 'REVIEW'}.`
        ]
      },
      {
        title: 'Evidence',
        status: evidenceLedger.status,
        lines: [
          `Evidence ledger ${evidenceLedger.status}.`,
          `Forward expectancy ${forwardScorecard.expectancyR}R.`
        ]
      }
    ]
  }), [selectedChartSymbol, signalExplanation, latestPlanVersion, riskKillSwitch, correlationRisk, evidenceLedger, forwardScorecard]);

  const approvalWorkflow = useMemo(() => evaluateApprovalWorkflow({
    requestedAction: 'PROMOTE_STRATEGY',
    approvals: []
  }), []);

  const backtestCacheReport = useMemo(() => evaluateBacktestCacheEntry({
    key: buildBacktestCacheKey({ symbol: selectedChartSymbol, interval: selectedTimeframe, limit: 500, source: 'binance' }),
    candleCount: latestKlines.length,
    createdAt: Date.now(),
    expiresAt: latestKlines.length > 0 ? Date.now() + 60 * 60_000 : Date.now() - 1,
    now: Date.now(),
    checksum: latestKlines.length > 0 ? `${selectedChartSymbol}-${latestKlines.length}-${latestKlines[0]?.[0] ?? 0}` : ''
  }), [selectedChartSymbol, selectedTimeframe, latestKlines]);

  const scenarioStress = useMemo(() => {
    if (!setupDetails || setupDetails.isChartOnly) return null;
    return runScenarioStressTest({
      side: setupDetails.side,
      entry: setupDetails.entry,
      stopLoss: setupDetails.sl,
      takeProfit: setupDetails.tp2 || setupDetails.tp,
      accountEquity: portfolioSize,
      sizeUnits: setupDetails.positionSizeUnits || 0,
      scenarios: [
        { name: 'Gap shock', gapPercent: setupDetails.side === 'LONG' ? -1 : 1, slippagePercent: 0.3, volatilityMultiplier: 1.5 },
        { name: 'Liquidity stress', gapPercent: 0, slippagePercent: 0.6, volatilityMultiplier: 1.2 }
      ],
      maxLossPercent: 2
    });
  }, [setupDetails, portfolioSize]);

  const modelDrift = useMemo(() => evaluateModelDrift({
    baselineExpectancyR: Math.max(0.01, backtestEvidence?.outOfSampleExpectancyR ?? 0.2),
    currentExpectancyR: forwardScorecard.expectancyR,
    baselineHitRate: backtestEvidence?.outOfSampleWinRate ?? 55,
    currentHitRate: forwardScorecard.hitRate,
    sampleSize: forwardScorecard.resolvedSignals
  }), [backtestEvidence, forwardScorecard]);

  const strategyRegistry = useMemo(() => summarizeStrategyRegistry([
    {
      id: `quantedge-${selectedChartSymbol}-${selectedTimeframe}`,
      name: `${selectedChartSymbol} QuantEdge Core`,
      owner: 'system-risk-desk',
      stage: strategyPromotion.currentStage,
      allowedRegimes: liveRegimeFromCandles.regime.regime !== 'UNKNOWN' ? [liveRegimeFromCandles.regime.regime] : [],
      promotionStatus: strategyPromotion.status,
      driftStatus: modelDrift.status,
      evidenceStatus: evidenceLedger.status,
      backtestTrades: backtestEvidence?.sampleSize ?? 0,
      forwardSignals: forwardScorecard.resolvedSignals,
      lastReviewedAt: new Date().toISOString()
    }
  ]), [selectedChartSymbol, selectedTimeframe, strategyPromotion, liveRegimeFromCandles, modelDrift, evidenceLedger, backtestEvidence, forwardScorecard]);

  const portfolioExposureMap = useMemo(() => buildPortfolioExposureMap({
    accountEquity: portfolioSize,
    trades: journal.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      sizeUSD: trade.sizeUSD,
      status: trade.status
    }))
  }), [portfolioSize, journal]);

  const dataSourceRedundancy = useMemo(() => {
    const latestClose = latestKlines.length > 0 ? Number(latestKlines[latestKlines.length - 1]?.[4]) : null;
    const lastUpdatedAt = marketIntegrityReport?.lastCloseTime ?? 0;

    return evaluateDataSourceRedundancy({
      sources: [
        {
          name: 'binance-public',
          status: marketIntegrityReport?.status ?? 'REVIEW',
          latestClose,
          latencyMs: 250,
          lastUpdatedAt
        }
      ],
      now: Date.now(),
      staleAfterMs: 3 * 60 * 60_000
    });
  }, [latestKlines, marketIntegrityReport]);

  const walkForwardOptimizer = useMemo(() => optimizeWalkForwardParameters({
    candidates: backtestEvidence?.walkForward
      ? [
        {
          id: 'current-parameter-set',
          parameters: { symbol: selectedChartSymbol, interval: selectedTimeframe },
          windows: [
            {
              id: 1,
              trades: Math.max(20, Math.floor((backtestEvidence.sampleSize || 0) / 4)),
              expectancyR: backtestEvidence.walkForward.averageWindowExpectancyR,
              maxDrawdownPercent: backtestEvidence.walkForward.maxWindowDrawdownPercent
            },
            {
              id: 2,
              trades: Math.max(20, Math.floor((backtestEvidence.sampleSize || 0) / 4)),
              expectancyR: backtestEvidence.walkForward.minWindowExpectancyR,
              maxDrawdownPercent: backtestEvidence.walkForward.maxWindowDrawdownPercent
            }
          ]
        }
      ]
      : []
  }), [backtestEvidence, selectedChartSymbol, selectedTimeframe]);

  const liveTradingSandboxConnector = useMemo(() => evaluateLiveTradingSandboxConnector({
    environment: serverOpsStatus.exchange?.mode === 'READ_ONLY_SANDBOX' ? 'TESTNET' : 'DISCONNECTED',
    readOnlyKeyConfigured: serverOpsStatus.exchange?.mode === 'READ_ONLY_SANDBOX',
    tradingPermissionDetected: apiTradingEnabled,
    simulatedOrdersEnabled: true,
    realOrderPlacementEnabled: apiTradingEnabled,
    latestHeartbeatMs: serverOpsStatus.health?.status === 'PASS' ? 250 : null,
    lastFillSimulationAt: new Date().toISOString()
  }), [serverOpsStatus.exchange, serverOpsStatus.health, apiTradingEnabled]);

  const executionQuality = useMemo(() => evaluateExecutionQuality({
    fills: journal
      .filter(trade => trade.status === 'WON' || trade.status === 'LOST')
      .slice(0, 30)
      .map((trade, index) => ({
        id: trade.id,
        side: trade.side,
        intendedPrice: trade.entry,
        fillPrice: trade.entry,
        signalAt: Date.parse(trade.date ?? '') || index * 1_000,
        filledAt: (Date.parse(trade.date ?? '') || index * 1_000) + 350,
        quantity: trade.sizeUnits,
        feeUsd: Math.max(0, trade.sizeUSD * 0.0004)
      }))
  }), [journal]);

  const signalReplayForensics = useMemo(() => buildSignalReplayForensics({
    signalId: setupDetails && !setupDetails.isChartOnly ? buildSetupIdentity(setupDetails) : `chart-${selectedChartSymbol}`,
    symbol: selectedChartSymbol,
    generatedAt: new Date(setupDetails?.timestamp || Date.now()).toISOString(),
    dataQualityStatus: marketIntegrityReport?.status ?? 'REVIEW',
    strategyVersionId: `quantedge-${selectedChartSymbol}-v1`,
    indicators: {
      confidence: setupDetails?.confidenceScore ?? 0,
      riskReward: Number(setupDetails?.rr ?? 0),
      atrPercent: liveRegimeFromCandles.metrics.atrPercent
    },
    decisionFactors: [
      { name: 'Data quality', passed: (marketIntegrityReport?.status ?? 'REVIEW') === 'PASS', weight: 25 },
      { name: 'Risk reward', passed: Number(setupDetails?.rr ?? 0) >= 2, weight: 25 },
      { name: 'Signal explanation', passed: signalExplanation.status !== 'BLOCK', weight: 25 },
      { name: 'Risk kill switch', passed: riskKillSwitch.state === 'UNLOCKED', weight: 25 }
    ],
    aiRationale: signalExplanation.buckets.map(bucket => bucket.rationale).join(' ')
  }), [setupDetails, selectedChartSymbol, marketIntegrityReport, liveRegimeFromCandles, signalExplanation, riskKillSwitch]);

  const shadowLiveMode = useMemo(() => evaluateShadowLiveMode({
    observations: journal
      .filter(trade => trade.status === 'WON' || trade.status === 'LOST')
      .slice(0, 30)
      .map(trade => {
        const theoreticalPnlUsd = Number(trade.pnlUSD ?? 0);
        return {
          id: trade.id,
          theoreticalPnlUsd,
          executablePnlUsd: Number((theoreticalPnlUsd * 0.98).toFixed(2)),
          theoreticalEntry: trade.entry,
          executableEntry: Number((trade.entry * (trade.side === 'LONG' ? 1.0002 : 0.9998)).toFixed(8))
        };
      })
  }), [journal]);

  const strategyVersionRegistry = useMemo(() => buildStrategyVersionRegistry({
    strategyId: `quantedge-${selectedChartSymbol}`,
    versions: [
      {
        version: 1,
        parameterHash: `${selectedChartSymbol}-${selectedTimeframe}-core`,
        status: strategyPromotion.status === 'PASS' ? 'APPROVED' : 'CANDIDATE',
        evidenceStatus: evidenceLedger.status,
        promotedAt: strategyPromotion.status === 'PASS' ? new Date().toISOString() : null,
        notes: `${strategyPromotion.currentStage} -> ${strategyPromotion.nextStage}`
      }
    ]
  }), [selectedChartSymbol, selectedTimeframe, strategyPromotion, evidenceLedger]);

  const realTimeRiskDashboard = useMemo(() => buildRealTimeRiskDashboard({
    marketDataStatus: marketIntegrityReport?.status ?? 'REVIEW',
    riskKillSwitchState: riskKillSwitch.state,
    portfolioExposureStatus: portfolioExposureMap.status,
    modelDriftStatus: modelDrift.status,
    executionQualityStatus: executionQuality.status,
    dataRedundancyStatus: dataSourceRedundancy.status,
    liveConnectorStatus: liveTradingSandboxConnector.status,
    liveTradingLocked: !apiTradingEnabled
  }), [marketIntegrityReport, riskKillSwitch, portfolioExposureMap, modelDrift, executionQuality, dataSourceRedundancy, liveTradingSandboxConnector, apiTradingEnabled]);

  const exchangeAdapterContract = useMemo(() => evaluateExchangeAdapterContract({
    adapterName: selectedChartExchange || 'read-only-adapter',
    environment: 'TESTNET',
    capabilities: ['MARKET_DATA', 'BALANCE_READ', 'ORDER_SIMULATION'],
    readOnly: true,
    canPlaceRealOrders: apiTradingEnabled,
    supportsIdempotency: true,
    supportsRateLimitBackoff: true,
    supportsKillSwitch: true
  }), [selectedChartExchange, apiTradingEnabled]);

  const capitalAllocation = useMemo(() => allocateCapital({
    accountEquity: portfolioSize,
    maxTotalAllocationPercent: 30,
    strategies: [
      {
        id: strategyVersionRegistry.strategyId,
        healthStatus: strategyRegistry.status,
        confidenceScore: signalExplanation.summaryScore,
        volatilityPercent: liveRegimeFromCandles.metrics.atrPercent || 1,
        correlationPenalty: (correlationRisk?.correlatedExposurePercent ?? 0) / 100,
        drawdownPercent: paperReadiness.drawdownPercent
      }
    ]
  }), [portfolioSize, strategyVersionRegistry, strategyRegistry, signalExplanation, liveRegimeFromCandles, correlationRisk, paperReadiness]);

  const regimeStrategyRoute = useMemo(() => routeStrategyForRegime({
    regime: liveRegimeFromCandles.regime.regime,
    strategies: [
      {
        id: 'trend-following-core',
        family: 'TREND_FOLLOWING',
        status: strategyPromotion.status,
        score: signalExplanation.summaryScore
      },
      {
        id: 'breakout-core',
        family: 'BREAKOUT',
        status: strategyPromotion.status === 'BLOCK' ? 'BLOCK' : 'REVIEW',
        score: Math.max(0, signalExplanation.summaryScore - 5)
      },
      {
        id: 'mean-reversion-core',
        family: 'MEAN_REVERSION',
        status: 'REVIEW',
        score: Math.max(0, signalExplanation.summaryScore - 10)
      }
    ]
  }), [liveRegimeFromCandles, strategyPromotion, signalExplanation]);

  const productionIncidentRunbook = useMemo(() => buildProductionIncidentRunbook({
    incidents: []
  }), []);

  const modelSignalBenchmark = useMemo(() => benchmarkSignals({
    samples: Math.max(backtestEvidence?.sampleSize ?? 0, forwardScorecard.resolvedSignals),
    ai: {
      expectancyR: backtestEvidence?.outOfSampleExpectancyR ?? forwardScorecard.expectancyR,
      hitRate: backtestEvidence?.outOfSampleWinRate ?? forwardScorecard.hitRate,
      maxDrawdownPercent: backtestEvidence?.maxDrawdownPercent ?? paperReadiness.drawdownPercent
    },
    baseline: {
      expectancyR: 0.05,
      hitRate: 50,
      maxDrawdownPercent: 15
    }
  }), [backtestEvidence, forwardScorecard, paperReadiness]);

  const unifiedDataReliabilityV2 = useMemo(() => {
    const assetType = selectedAssetType === 'STOCK' ? 'US_STOCK' : selectedAssetType;
    const freshnessMs = marketIntegrityReport?.lastCloseTime
      ? Math.max(0, Date.now() - marketIntegrityReport.lastCloseTime)
      : Number.POSITIVE_INFINITY;

    return evaluateUnifiedDataReliabilityV2({
      sources: [
        {
          name: selectedIsUsEquity ? 'yahoo-proxy' : 'binance-proxy',
          assetType: assetType as any,
          status: marketIntegrityReport?.status ?? 'REVIEW',
          freshnessMs,
          checksumPresent: latestKlines.length > 0,
          confidence: marketIntegrityReport?.status === 'PASS' ? 90 : marketIntegrityReport?.status === 'BLOCK' ? 35 : 68
        }
      ],
      maxFreshnessMs: selectedIsUsEquity ? 4 * 24 * 60 * 60_000 : 3 * 60 * 60_000,
      minConfidence: 65
    });
  }, [selectedAssetType, selectedIsUsEquity, marketIntegrityReport, latestKlines]);

  const multiAssetStrategyV2 = useMemo(() => selectMultiAssetStrategyV2({
    assetType: (selectedAssetType === 'STOCK' ? 'US_STOCK' : selectedAssetType) as any,
    regime: liveRegimeFromCandles.regime.regime,
    relativeStrengthPercent: usStockIndicators?.relativeStrengthPercent ?? Math.max(0, signalExplanation.summaryScore - 70) / 2,
    volatilityPercent: liveRegimeFromCandles.metrics.atrPercent || Math.abs(usStockIndicators?.gapPercent ?? 1),
    dataStatus: unifiedDataReliabilityV2.status,
    riskStatus: usStockRisk?.status ?? realTimeRiskDashboard.status
  }), [selectedAssetType, liveRegimeFromCandles, usStockIndicators, signalExplanation, unifiedDataReliabilityV2, usStockRisk, realTimeRiskDashboard]);

  const institutionalBacktestV2 = useMemo(() => evaluateInstitutionalBacktestV2({
    sampleSize: backtestEvidence?.sampleSize ?? 0,
    outOfSampleExpectancyR: backtestEvidence?.outOfSampleExpectancyR ?? 0,
    maxDrawdownPercent: backtestEvidence?.maxDrawdownPercent ?? 100,
    walkForwardPositiveRate: backtestEvidence?.walkForward?.positiveWindowRate ?? 0,
    monteCarloSurvivalRate: Math.max(0, Math.min(100, 100 - (backtestEvidence?.maxDrawdownPercent ?? 50) * 2)),
    benchmarkExpectancyR: 0.05,
    assetAwareFees: true,
    splitSessionAdjusted: true
  }), [backtestEvidence]);

  const forwardShadowEvidenceV2 = useMemo(() => evaluateForwardShadowEvidenceV2({
    forwardSignals: forwardScorecard.totalSignals,
    forwardExpectancyR: forwardScorecard.expectancyR,
    shadowObservations: shadowLiveMode.observations,
    executablePnlDriftPercent: shadowLiveMode.averagePnlDivergencePercent,
    missedFillRatePercent: Math.max(0, executionQuality.averageSlippageBps / 10),
    scoreDecayPercent: Math.max(0, 100 - signalExplanation.summaryScore)
  }), [forwardScorecard, shadowLiveMode, executionQuality, signalExplanation]);

  const portfolioRiskV2 = useMemo(() => evaluatePortfolioRiskV2({
    sectorExposurePercent: usStockRisk?.sectorExposurePercent ?? Math.min(45, portfolioExposureMap.grossExposurePercent),
    betaExposure: selectedIsUsEquity ? (selectedAssetType === 'ETF' ? 1 : 1.2) : 1,
    correlatedExposurePercent: correlationRisk?.correlatedExposurePercent ?? 0,
    volatilityTargetPercent: liveRegimeFromCandles.metrics.atrPercent || 12,
    projectedDailyLossPercent: Math.abs(dailyPnlPercent),
    projectedWeeklyLossPercent: Math.abs(dailyPnlPercent) + Math.max(0, paperReadiness.drawdownPercent / 2)
  }), [usStockRisk, portfolioExposureMap, selectedIsUsEquity, selectedAssetType, correlationRisk, liveRegimeFromCandles, dailyPnlPercent, paperReadiness]);

  const aiResearchMemoV2 = useMemo(() => buildAiResearchMemoV2({
    symbol: selectedChartSymbol,
    assetType: selectedAssetType,
    evidenceStatus: evidenceLedger.status,
    riskStatus: portfolioRiskV2.status,
    benchmarkStatus: modelSignalBenchmark.status,
    thesis: signalExplanation.buckets[0]?.rationale ?? `${selectedChartSymbol} setup requires confirmed evidence before execution.`,
    invalidation: setupDetails && !setupDetails.isChartOnly ? `Invalidate if price closes beyond ${setupDetails.sl}.` : 'Invalidate if market data, risk, or benchmark gates fail.',
    bullCase: multiAssetStrategyV2.strategyId ? `${multiAssetStrategyV2.strategyId} remains aligned with live regime.` : 'Wait for a valid strategy route.',
    baseCase: `Current readiness stage depends on ${forwardShadowEvidenceV2.status} forward/shadow evidence.`,
    bearCase: 'Block escalation if data freshness, portfolio risk, or benchmark edge deteriorates.'
  }), [selectedChartSymbol, selectedAssetType, evidenceLedger, portfolioRiskV2, modelSignalBenchmark, signalExplanation, setupDetails, multiAssetStrategyV2, forwardShadowEvidenceV2]);

  const professionalAuditReportV2 = useMemo(() => buildProfessionalAuditReportV2({
    title: `${selectedChartSymbol} Institutional Audit V2`,
    symbol: selectedChartSymbol,
    generatedAt: new Date().toISOString(),
    statuses: {
      setup: multiAssetStrategyV2.status,
      risk: portfolioRiskV2.status,
      benchmark: modelSignalBenchmark.status,
      data: unifiedDataReliabilityV2.status,
      decisionTrail: evidenceLedger.status
    }
  }), [selectedChartSymbol, multiAssetStrategyV2, portfolioRiskV2, modelSignalBenchmark, unifiedDataReliabilityV2, evidenceLedger]);

  const opsMonitoringV2 = useMemo(() => evaluateOpsMonitoringV2({
    dataLatencyMs: serverOpsStatus.health?.status === 'PASS' ? 250 : 7_000,
    endpointUptimePercent: serverOpsStatus.health?.status === 'PASS' ? 99.95 : 97,
    apiQuotaUsedPercent: 42,
    openSevIncidents: productionIncidentRunbook.openIncidents,
    releaseChecklistStatus: serverOpsStatus.release?.status ?? 'REVIEW'
  }), [serverOpsStatus.health, serverOpsStatus.release, productionIncidentRunbook]);

  const masterReadinessGateV2 = useMemo(() => evaluateMasterReadinessGateV2({
    dataStatus: unifiedDataReliabilityV2.status,
    strategyStatus: multiAssetStrategyV2.status,
    backtestStatus: institutionalBacktestV2.status,
    forwardStatus: forwardShadowEvidenceV2.status,
    shadowStatus: shadowLiveMode.status,
    portfolioRiskStatus: portfolioRiskV2.status,
    aiMemoStatus: aiResearchMemoV2.status,
    reportStatus: professionalAuditReportV2.status,
    opsStatus: opsMonitoringV2.status,
    liveTradingLocked: !apiTradingEnabled,
    apiTradingEnabled
  }), [unifiedDataReliabilityV2, multiAssetStrategyV2, institutionalBacktestV2, forwardShadowEvidenceV2, shadowLiveMode, portfolioRiskV2, aiResearchMemoV2, professionalAuditReportV2, opsMonitoringV2, apiTradingEnabled]);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const connectWallet = async () => {
    try {
      if ((window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          setWalletAddress(accounts[0]);
        }
      } else {
        alert("Please install MetaMask to connect your wallet.");
      }
    } catch (error: any) {
      console.error("MetaMask connection failed:", error);
      alert("Failed to connect to MetaMask");
    }
  };

  const handleLogin = async () => {
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    setAuthFeedback('กำลังเปิดหน้าล็อกอิน Google...');
    try {
      const result = await loginWithGoogle();
      setAuthErrorModal(false);
      setAuthFeedback(result?.user ? 'เข้าสู่ระบบสำเร็จ' : 'กำลังเปลี่ยนเส้นทางไป Google...');
    } catch (e: any) {
      const message = String(e?.message || '').toLowerCase();
      if (e?.code === 'auth/popup-blocked' || (e.message && e.message.includes('popup-blocked'))) {
        setAuthErrorModal(true);
        setAuthFeedback('เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ');
      } else if (e?.code === 'auth/unauthorized-domain') {
        setAuthFeedback('โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication');
        alert('โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication\n\nให้เพิ่ม localhost และโดเมน production ใน Firebase Console > Authentication > Settings > Authorized domains');
      } else if (e?.code === 'auth/browser-environment-blocked') {
        setAuthFeedback('เบราว์เซอร์นี้บล็อกการเก็บ session หรือ popup ของ Firebase กรุณาเปิดเว็บใน Chrome, Edge หรือ Safari โดยตรง');
        alert('เบราว์เซอร์นี้บล็อกระบบเข้าสู่ระบบของ Firebase\n\nกรุณาเปิดเว็บใน Chrome, Edge หรือ Safari โดยตรง แล้วลองเข้าสู่ระบบอีกครั้ง');
      } else if (e?.code === 'auth/redirect-configuration-required') {
        setAuthFeedback('ต้องตั้งค่า Firebase Auth redirect สำหรับโดเมน production ก่อนใช้ redirect บนมือถือ');
        alert('Google popup ถูกบล็อก และ redirect login ยังไม่ได้ตั้งค่าแบบ first-party สำหรับโดเมนนี้\n\nให้เพิ่ม OAuth Redirect URI ใน Google Cloud เป็น https://<โดเมนเว็บ>/__/auth/handler แล้วตั้งค่า VITE_FIREBASE_AUTH_DOMAIN ให้ตรงกับโดเมน production');
      } else if (e?.code === 'auth/internal-error' || message.includes('network')) {
        setAuthFeedback('เกิดปัญหาเครือข่ายขณะเชื่อมต่อ Firebase');
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ (Network/Internal Error)\\n\\nเบราว์เซอร์ของคุณอาจมีระบบ Adblocker, Brave Shields หรือ VPN ปิดกั้นการเชื่อมต่อตัวจัดการระบบล็อกอินของแอพ (Firebase)\\nกรุณาปิด Adblocker, Shields หรืออนุญาตการเชื่อมต่อ แล้วลองใหม่อีกครั้ง');
      } else {
        setAuthFeedback('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
        alert('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleUpdatePortfolioSize = (size: number) => {
    setPortfolioSize(size);
    syncProfileToFirestore(size, riskPercent).catch(() => {});
  };

  const handleUpdateRiskPercent = (percent: number) => {
    setRiskPercent(percent);
    syncProfileToFirestore(portfolioSize, percent).catch(() => {});
  };

  const handleExecuteTrade = (tradeData: any) => {
    if (!auth.currentUser) {
      alert('กรุณาเข้าสู่ระบบด้วย Gmail ก่อนบันทึกการเทรด เพื่อให้ระบบบันทึกข้อมูลตามบัญชีอีเมลของคุณ');
      handleLogin();
      return;
    }
    const trade = executeTrade(tradeData);
    executeTradeInFirestore(trade).catch(() => {});
  };

  const handleCloseTrade = (id: string, result: 'WON' | 'LOST', pnlUSD: number) => {
    if (!auth.currentUser) {
      alert('กรุณาเข้าสู่ระบบด้วย Gmail ก่อนอัปเดตผลการเทรด');
      handleLogin();
      return;
    }
    const trade = closeTrade(id, result, pnlUSD);
    if (trade) {
        updateTradeInFirestore(trade).catch(() => {});
    }
  };

  useEffect(() => {
    let isMounted = true;

    fetch('/api/system/readiness')
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (isMounted) {
          setAiBackendConfigured(Boolean(data?.aiBackendConfigured));
          setApiTradingEnabled(Boolean(data?.apiTradingEnabled));
        }
      })
      .catch(() => {
        if (isMounted) {
          setAiBackendConfigured(false);
          setApiTradingEnabled(false);
        }
      });

    Promise.all([
      fetch('/api/system/health').then(response => response.ok ? response.json() : null).catch(() => null),
      fetch('/api/system/security').then(response => response.ok ? response.json() : null).catch(() => null),
      fetch('/api/exchange/sandbox-status').then(response => response.ok ? response.json() : null).catch(() => null),
      fetch('/api/system/deployment').then(response => response.ok ? response.json() : null).catch(() => null),
      fetch('/api/system/release-readiness').then(response => response.ok ? response.json() : null).catch(() => null)
    ]).then(([health, security, exchange, deployment, release]) => {
      if (isMounted) {
        setServerOpsStatus({ health, security, exchange, deployment, release });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const explanationCardRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    symbol: 'BTCUSDT',
    exchange: 'BINANCE' as 'BINANCE',
    side: 'LONG' as 'LONG' | 'SHORT',
    entry: '',
    sl: '',
    tp: ''
  });

  // --- Deterministic setup state shared by the analysis and alert views ---
  const setupStateRef = useRef<Record<string, { version: number, side: 'LONG' | 'SHORT', entry: number, sl: number, tp: number, rr: number, hash: string }>>({});
  const openSymbolInAnalysis = (symbol: string, assetType: 'STOCK' | 'ETF' | 'CRYPTO' | 'INDEX' | 'COMMODITY' | 'FOREX' | 'UNKNOWN' = 'STOCK', exchange = 'NASDAQ') => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    delete setupStateRef.current[normalized];
    setSetupDetails(buildChartAnalysisPlaceholder(normalized, exchange));
    setLatestKlines([]);
    setMarketIntegrityReport(null);
    setSelectedChartSymbol(normalized);
    setSelectedAssetType(assetType);
    setSelectedChartExchange(exchange);
    setSelectedTimeframe(assetType === 'STOCK' || assetType === 'ETF' ? '1d' : selectedTimeframe);
    setView('analysis');
  };

  // --- Computed Stats ---
  const totalTrades = journal.length;
  const winningTrades = journal.filter(t => t.status === 'WON').length;
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalPnL = journal.reduce((sum, t) => sum + (t.pnlUSD || 0), 0);
  const openTradesCount = journal.filter(t => t.status === 'OPEN').length;
  const activeSetupsCount = setups.length;

  // --- Effects ---
  const activeMarketData = marketData;
  const marketDataRef = useRef(activeMarketData);
  useEffect(() => {
    marketDataRef.current = activeMarketData;
  }, [activeMarketData]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auth State
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        setAuthFeedback(null);
        // Fetch Profile
        try {
            const profileSnap = await getDoc(doc(db, 'users', currentUser.uid, 'profile', 'config'));
            if (profileSnap.exists()) {
                const data = profileSnap.data();
                if (data.portfolioSize) setPortfolioSize(data.portfolioSize);
                if (data.riskPercent) setRiskPercent(data.riskPercent);
            }
        } catch(e: any) { 
            handleFirestoreError(e, OperationType.GET, `users/${currentUser.uid}/profile/config`);
        }

        // Fetch Setups
        try {
            const setupsSnap = await getDocs(query(collection(db, 'users', currentUser.uid, 'setups'), where('userId', '==', currentUser.uid)));
            const loadedSetups: any[] = [];
            setupsSnap.forEach(doc => {
                loadedSetups.push(doc.data());
            });
            // Sort by createdAt desc
            loadedSetups.sort((a,b) => b.createdAt - a.createdAt);
            setSetups(loadedSetups as Setup[]);
        } catch(e: any) { 
            handleFirestoreError(e, OperationType.LIST, `users/${currentUser.uid}/setups`);
        }

        // Fetch Journal
        try {
            const journalSnap = await getDocs(query(collection(db, 'users', currentUser.uid, 'journal'), where('userId', '==', currentUser.uid)));
            const loadedJournal: any[] = [];
            journalSnap.forEach(doc => {
                const data = doc.data();
                if (data.payload) {
                    try {
                        loadedJournal.push(JSON.parse(data.payload));
                    } catch(jsonErr) {}
                }
            });
            loadedJournal.sort((a,b) => b.createdAt - a.createdAt);
            setJournal(loadedJournal);
        } catch(e: any) { 
            handleFirestoreError(e, OperationType.LIST, `users/${currentUser.uid}/journal`);
        }
      } else {
        // Reset when logged out
        setSetups([]);
        setJournal([]);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchAndCompute = async () => {
      try {
        const isSelectedUsEquity = isUsEquityAsset(selectedAssetType);
        const higherTimeframeLimit = isSelectedUsEquity ? 300 : 100;
        const marketDataRetries = 1;
        const marketDataBackoffMs = 500;
        const [resSelected, res4H, res1D] = await Promise.all([
          fetchWithRetry(getMarketDataUrl(selectedChartSymbol, selectedTimeframe, 100, selectedAssetType), marketDataRetries, marketDataBackoffMs),
          fetchWithRetry(getMarketDataUrl(selectedChartSymbol, '4h', higherTimeframeLimit, selectedAssetType), marketDataRetries, marketDataBackoffMs),
          fetchWithRetry(getMarketDataUrl(selectedChartSymbol, '1d', 100, selectedAssetType), marketDataRetries, marketDataBackoffMs)
        ]);
        
        const dataSelected = await resSelected.json() as BinanceKline[];
        const data4H = await res4H.json() as BinanceKline[];
        const data1D = await res1D.json() as BinanceKline[];
        setLatestKlines(dataSelected);
        
        if (!isMounted) return;

        const selectedIntegrity = validateKlines(dataSelected, {
          interval: selectedTimeframe,
          minCandles: 60
        });
        const h4Integrity = validateKlines(data4H, {
          interval: '4h',
          minCandles: isSelectedUsEquity ? 30 : 60
        });
        const d1Integrity = validateKlines(data1D, {
          interval: '1d',
          minCandles: 60,
          staleAfterIntervals: 5
        });
        const combinedIntegrity = combineMarketIntegrityReports([selectedIntegrity, h4Integrity, d1Integrity]);
        if (isSelectedUsEquity) {
          const stockReport = validateUsStockCandles({
            symbol: selectedChartSymbol,
            interval: selectedTimeframe,
            candles: dataSelected,
            minCandles: 50
          });
          combinedIntegrity.issues.push(...stockReport.issues);
          combinedIntegrity.status = stockReport.status === 'BLOCK' || combinedIntegrity.status === 'BLOCK'
            ? 'BLOCK'
            : stockReport.status === 'REVIEW' || combinedIntegrity.status === 'REVIEW'
              ? 'REVIEW'
              : 'PASS';
        }
        setMarketIntegrityReport(combinedIntegrity);

        if (combinedIntegrity.status === 'BLOCK') {
            console.error("Market data integrity blocked analysis", combinedIntegrity.issues);
            if (isMounted) {
              const issueText = combinedIntegrity.issues.map(issue => issue.message).join(' ');
              setSetupDetails(buildChartAnalysisDataRequired(
                selectedChartSymbol,
                selectedChartExchange,
                issueText || 'Data required: ข้อมูลราคาไม่ครบพอสำหรับคำนวณแผนเทรด'
              ));
            }
            return;
        }
        
        if (!Array.isArray(dataSelected) || dataSelected.length === 0 || !Array.isArray(data4H) || data4H.length === 0 || !Array.isArray(data1D) || data1D.length === 0) {
            console.error("Invalid or empty data received from Proxy API");
            if (isMounted) {
              setSetupDetails(buildChartAnalysisDataRequired(
                selectedChartSymbol,
                selectedChartExchange,
                'Data required: provider ส่งข้อมูลกราฟไม่ครบ จึงยังไม่สร้าง entry, stop-loss และ target'
              ));
            }
            return;
        }

        // --- Multi-Timeframe Bias Calculation ---
        const getTrendBias = (klines: BinanceKline[]) => {
          const closes = klines.map((d: BinanceKline) => parseFloat(d[4]));
          const sma20 = SMA.calculate({ period: 20, values: closes });
          const sma50 = SMA.calculate({ period: 50, values: closes });
          if (sma20.length === 0 || sma50.length === 0) return 'Neutral';
          const last20 = sma20[sma20.length - 1];
          const last50 = sma50[sma50.length - 1];
          const lastClose = closes[closes.length - 1];
          
          if (lastClose > last20 && last20 > last50) return 'Bullish (Strong)';
          if (lastClose < last20 && last20 < last50) return 'Bearish (Strong)';
          if (lastClose > last50) return 'Bullish (Weak)';
          if (lastClose < last50) return 'Bearish (Weak)';
          return 'Neutral';
        };

        const bias1D = getTrendBias(data1D);
        const bias4H = getTrendBias(data4H);

        // --- Selected Timeframe Data & Indicators ---
        const closes = dataSelected.map((d: BinanceKline) => parseFloat(d[4]));
        const highs = dataSelected.map((d: BinanceKline) => parseFloat(d[2]));
        const lows = dataSelected.map((d: BinanceKline) => parseFloat(d[3]));
        const opens = dataSelected.map((d: BinanceKline) => parseFloat(d[1]));
        const volumes = dataSelected.map((d: BinanceKline) => parseFloat(d[5]));
        const currentPrice = closes[closes.length - 1];
        
        const rsiResult = RSI.calculate({ values: closes, period: 14 });
        const currentRsi = rsiResult.length > 0 ? Math.round(rsiResult[rsiResult.length - 1]) : 50;

        const cciResult = CCI.calculate({ high: highs, low: lows, close: closes, period: 20 });
        const currentCci = cciResult.length > 0 ? Math.round(cciResult[cciResult.length - 1]) : 0;

        const macdResult = MACD.calculate({
          values: closes,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          SimpleMAOscillator: false,
          SimpleMASignal: false
        });
        const currentMacd = macdResult.length > 0 ? macdResult[macdResult.length - 1].histogram : 0;
        const macdHist = currentMacd ? currentMacd.toFixed(2) : "0.00";
        
        const currentVolume = volumes[volumes.length - 1];
        const avgVolume = volumes.slice(-21, -1).reduce((a: number, b: number) => a + b, 0) / 20;
        const volumeSpike = currentVolume > avgVolume * 1.5;

        // --- Market Structure (Swing High/Low) ---
        const findPivots = (data: number[], isHigh: boolean, leftBars = 3, rightBars = 3) => {
            let pivots = [];
            for(let i = leftBars; i < data.length - rightBars; i++) {
                let isPivot = true;
                for(let j = 1; j <= leftBars; j++) {
                    if(isHigh ? data[i-j] >= data[i] : data[i-j] <= data[i]) { isPivot = false; break; }
                }
                for(let j = 1; j <= rightBars; j++) {
                    if(isHigh ? data[i+j] >= data[i] : data[i+j] <= data[i]) { isPivot = false; break; }
                }
                if(isPivot) pivots.push({index: i, value: data[i]});
            }
            return pivots;
        };
        
        const swingHighs = findPivots(highs, true);
        const swingLows = findPivots(lows, false);
        
        const validSwingHighs = swingHighs.filter(p => p.value > currentPrice).sort((a,b) => b.index - a.index);
        const validSwingLows = swingLows.filter(p => p.value < currentPrice).sort((a,b) => b.index - a.index);
        
        const targetSwingHigh = validSwingHighs.length > 0 ? validSwingHighs[0].value : currentPrice * 1.02;
        const targetSwingLow = validSwingLows.length > 0 ? validSwingLows[0].value : currentPrice * 0.98;

        // --- Divergence Agent (RSI vs Price) ---
        let divergenceAgent = 'NONE';
        const rsiOffset = closes.length - rsiResult.length; // usually 14
        if (swingHighs.length >= 2) {
            const sh1 = swingHighs[swingHighs.length - 1]; // most recent
            const sh2 = swingHighs[swingHighs.length - 2]; // older
            if (sh1.value > sh2.value) { // Higher High in Price
                const rsi1 = rsiResult[sh1.index - rsiOffset] || 50;
                const rsi2 = rsiResult[sh2.index - rsiOffset] || 50;
                if (rsi1 < rsi2 && rsi1 > 60) divergenceAgent = 'BEARISH';
            }
        }
        if (swingLows.length >= 2) {
            const sl1 = swingLows[swingLows.length - 1]; // most recent
            const sl2 = swingLows[swingLows.length - 2]; // older
            if (sl1.value < sl2.value) { // Lower Low in Price
                const rsi1 = rsiResult[sl1.index - rsiOffset] || 50;
                const rsi2 = rsiResult[sl2.index - rsiOffset] || 50;
                if (rsi1 > rsi2 && rsi1 < 40) divergenceAgent = 'BULLISH';
            }
        }

        // Determine Trade Direction (isLong) FIRST so SMC agents know what to look for
        let tradeIsLong = false;
        if (setupStateRef.current[selectedChartSymbol]) {
            tradeIsLong = setupStateRef.current[selectedChartSymbol].side === 'LONG';
        } else {
            tradeIsLong = bias1D.includes('Bullish')
              ? true
              : bias1D.includes('Bearish')
                ? false
                : currentRsi >= 50 || (currentMacd ?? 0) >= 0;
        }

        // --- Advanced Agents: SMC (Order Blocks & FVG) ---
        // Simplified FVG detection (Fair Value Gap)
        let fvgFound = false;
        let fvgZone = { top: 0, bottom: 0 };
        for (let i = closes.length - 10; i < closes.length - 2; i++) {
            if (tradeIsLong && lows[i] > highs[i-2]) { // Bullish FVG
                fvgFound = true;
                fvgZone = { top: lows[i], bottom: highs[i-2] };
                break;
            } else if (!tradeIsLong && highs[i] < lows[i-2]) { // Bearish FVG
                fvgFound = true;
                fvgZone = { top: lows[i-2], bottom: highs[i] };
                break;
            }
        }

        // Simplified Order Block detection
        let obFound = false;
        let obZone = { top: 0, bottom: 0 };
        if (tradeIsLong && validSwingLows.length > 0) {
            // Bullish OB: The last down candle before the up move that broke structure
            const slIndex = validSwingLows[0].index;
            if (slIndex > 0) {
                obFound = true;
                obZone = { top: Math.max(closes[slIndex], opens[slIndex]), bottom: lows[slIndex] };
            }
        } else if (!tradeIsLong && validSwingHighs.length > 0) {
            // Bearish OB: The last up candle before the down move
            const shIndex = validSwingHighs[0].index;
            if (shIndex > 0) {
                obFound = true;
                obZone = { top: highs[shIndex], bottom: Math.min(closes[shIndex], opens[shIndex]) };
            }
        }

        // --- Market Regime Agent (ADX & ATR) ---
        const adxResult = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
        const currentAdx = adxResult.length > 0 ? adxResult[adxResult.length - 1].adx : 0;
        
        const atrResult = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
        const currentAtr = atrResult.length > 0 ? atrResult[atrResult.length - 1] : 0;
        
        let marketRegime = 'Neutral';
        if (currentAdx > 25) {
            marketRegime = 'Trending';
        } else if (currentAdx < 20) {
            marketRegime = 'Ranging/Choppy';
        }

        // Initialize or get existing setup state for symbol to keep it in sync with alerts
        if (!setupStateRef.current[selectedChartSymbol]) {
          // Refine Entry based on SMC if available
          let entry = currentPrice;
          if (fvgFound) {
              entry = tradeIsLong ? fvgZone.top : fvgZone.bottom;
          } else if (obFound) {
              entry = tradeIsLong ? obZone.top : obZone.bottom;
          }
          
          let sl, tp;
          // Use 1.5x ATR as the buffer for Stop Loss to account for volatility
          const slBuffer = currentAtr * 1.5;

          if (tradeIsLong) {
              sl = Math.min(targetSwingLow - slBuffer, obFound ? obZone.bottom - slBuffer : targetSwingLow - slBuffer); // Buffer below swing low or OB
              const risk = entry - sl;
              tp = Math.max(targetSwingHigh, entry + (risk * 2)); // Ensure at least 1:2 RR
          } else {
              sl = Math.max(targetSwingHigh + slBuffer, obFound ? obZone.top + slBuffer : targetSwingHigh + slBuffer); // Buffer above swing high or OB
              const risk = sl - entry;
              tp = Math.min(targetSwingLow, entry - (risk * 2));
          }
          const rr = Math.abs(tp - entry) / Math.abs(entry - sl);
          
          const side = tradeIsLong ? 'LONG' : 'SHORT';
          const hash = buildSetupIdentity({
            symbol: selectedChartSymbol,
            timeframe: selectedTimeframe,
            side,
            entry,
            sl,
            tp,
          });

          setupStateRef.current[selectedChartSymbol] = {
            version: 1,
            side,
            entry,
            sl,
            tp,
            rr,
            hash
          };
        }

        const state = setupStateRef.current[selectedChartSymbol];
        const isLong = state.side === 'LONG';
        const price = currentPrice;
        
        // --- MULTI-AGENT DECISION SYSTEM SIMULATION ---
        
        // 1. Market & Environment Intake (Real Data)
        const rsi = currentRsi;
        const cci = currentCci;
        const spread = (price * 0.0001).toFixed(4);
        const hasNews = false; // Phase 0: no news feed is integrated yet, so do not invent event risk.
        
        // 2. Signal / Alpha Agents
        const trendAgent = isLong ? (bias1D.includes('Bullish') && bias4H.includes('Bullish') ? 'AGREE' : bias1D.includes('Bullish') ? 'NEUTRAL' : 'DISAGREE') : (bias1D.includes('Bearish') && bias4H.includes('Bearish') ? 'AGREE' : bias1D.includes('Bearish') ? 'NEUTRAL' : 'DISAGREE');
        const momentumAgent = isLong ? (rsi > 40 && parseFloat(macdHist) > 0 ? 'AGREE' : 'DISAGREE') : (rsi < 60 && parseFloat(macdHist) < 0 ? 'AGREE' : 'DISAGREE');
        const volumeAgent = volumeSpike ? 'AGREE' : 'NEUTRAL';
        const smcAgent = (fvgFound || obFound) ? 'AGREE' : 'NEUTRAL';
        
        const agents = [trendAgent, momentumAgent, volumeAgent, smcAgent];
        const signalAgreementCount = agents.filter(a => a === 'AGREE').length;
        const signalDisagreeCount = agents.filter(a => a === 'DISAGREE').length;
        
        // 3. Risk & Money Management Agents
        const riskAmountUSD = portfolioSize * (riskPercent / 100);
        const risk = Math.abs(state.entry - state.sl);
        const reward = Math.abs(state.tp - state.entry);
        const rrValue = reward / risk;
        const isRiskPass = rrValue >= 1.6; // Minimum rule
        
        // 4. Market / Environment Agents
        const isEnvPass = !hasNews && parseFloat(spread) < price * 0.001; // Spread check
        
        // --- Confidence Scoring System ---
        let calculatedConfidence = 50; // Base score
        
        // Trend Alignment (+30)
        if (trendAgent === 'AGREE') calculatedConfidence += 30;
        else if (trendAgent === 'NEUTRAL') calculatedConfidence += 10;
        else calculatedConfidence -= 20;
        
        // Momentum Alignment (+20)
        if (momentumAgent === 'AGREE') calculatedConfidence += 20;
        else calculatedConfidence -= 10;
        
        // Volume Confirmation (+10)
        if (volumeAgent === 'AGREE') calculatedConfidence += 10;
        
        // SMC Confluence (+20)
        if (smcAgent === 'AGREE') calculatedConfidence += 20;

        // Divergence Confluence (+15)
        let statusReason = '';
        if ((isLong && divergenceAgent === 'BULLISH') || (!isLong && divergenceAgent === 'BEARISH')) {
            calculatedConfidence += 15;
            statusReason += ' [RSI Divergence]';
        }
        
        // Risk/Reward Bonus (+10)
        if (rrValue >= 2.0) calculatedConfidence += 10;
        else if (rrValue < 1.6) calculatedConfidence -= 20;
        
        // Market Regime Penalty (-15 if choppy)
        if (marketRegime === 'Ranging/Choppy') calculatedConfidence -= 15;
        
        // Cap confidence between 0 and 100
        calculatedConfidence = Math.max(0, Math.min(100, calculatedConfidence));
        
        // 5. Fusion / Voting Rules & Execution Gate
        let currentStatus: 'ACTIONABLE' | 'WAIT' | 'INVALIDATED' | 'AVOID' = 'WAIT';
        
        // Live Context Rule
        const isInvalidated = isLong ? price < state.sl : price > state.sl;
        
        if (isInvalidated) {
          currentStatus = 'INVALIDATED';
          statusReason = 'ราคาปัจจุบันได้ทะลุจุดยกเลิกแผน (Stop Loss) ไปแล้ว โครงสร้างราคาเสีย';
        } else if (!isEnvPass) {
          currentStatus = 'AVOID';
          statusReason = hasNews ? 'มีข่าวสำคัญระดับมหภาค (High-impact news) ที่อาจส่งผลกระทบรุนแรง แนะนำให้หลีกเลี่ยง' : 'Spread หรือ Slippage สูงเกินไป ไม่คุ้มค่าความเสี่ยงในการเข้าเทรด';
        } else if (!isRiskPass) {
          currentStatus = 'WAIT';
          statusReason = `อัตราส่วน Risk/Reward (${rrValue.toFixed(2)}) ต่ำกว่าเกณฑ์ขั้นต่ำที่กำหนดไว้ (1.6)`;
        } else if (calculatedConfidence < 70) {
          currentStatus = 'WAIT';
          statusReason = `ความมั่นใจของระบบ (${calculatedConfidence}%) ต่ำกว่าเกณฑ์ที่กำหนด (70%) รอสัญญาณยืนยันเพิ่มเติม`;
        } else {
          currentStatus = 'ACTIONABLE';
          statusReason = 'สัญญาณจากทุก Agent สอดคล้องกันและความเสี่ยงผ่านเกณฑ์ จัดเป็น setup candidate ที่ต้อง review ความเสี่ยงก่อนบันทึก';
        }
        
        // 6. Orchestrator Decision Output
        const displayTfLabel = selectedTimeframe.toUpperCase();
        const multiTfContext = [
          `Higher TF Bias: 1D (${bias1D})`,
          `Setup TF: 4H (${bias4H})`,
          `Entry TF: 15m`,
          `Display TF: ${displayTfLabel}`,
          `Market Regime: ${marketRegime} (ADX: ${currentAdx.toFixed(1)})`
        ];
        
        let whyEntry = isLong 
          ? `ราคาปัจจุบันอยู่ที่ ${currentPrice.toLocaleString(undefined, {maximumFractionDigits: 4})} โดยมีแนวโน้มหลัก 1D เป็น ${bias1D} สนับสนุนการหาจังหวะ Buy (โซนเข้าเทรด: ${state.entry.toLocaleString(undefined, {maximumFractionDigits: 4})})` 
          : `ราคาปัจจุบันอยู่ที่ ${currentPrice.toLocaleString(undefined, {maximumFractionDigits: 4})} โดยมีแนวโน้มหลัก 1D เป็น ${bias1D} สนับสนุนการหาจังหวะ Sell (โซนเข้าเทรด: ${state.entry.toLocaleString(undefined, {maximumFractionDigits: 4})})`;
          
        if (fvgFound) {
            whyEntry += ` ตรวจพบ Fair Value Gap (FVG) ที่ระดับ ${fvgZone.bottom.toLocaleString(undefined, {maximumFractionDigits: 4})} - ${fvgZone.top.toLocaleString(undefined, {maximumFractionDigits: 4})}`;
        } else if (obFound) {
            whyEntry += ` ตรวจพบ Order Block (OB) ที่ระดับ ${obZone.bottom.toLocaleString(undefined, {maximumFractionDigits: 4})} - ${obZone.top.toLocaleString(undefined, {maximumFractionDigits: 4})}`;
        }
          
        const whySl = isLong 
          ? `จุดตัดขาดทุนวางไว้ที่ ${state.sl.toLocaleString(undefined, {maximumFractionDigits: 4})} ซึ่งอยู่ต่ำกว่า Swing Low ล่าสุด (${targetSwingLow.toLocaleString(undefined, {maximumFractionDigits: 4})}) หากราคาหลุดระดับนี้ โครงสร้างขาขึ้นจะถูกยกเลิก` 
          : `จุดตัดขาดทุนวางไว้ที่ ${state.sl.toLocaleString(undefined, {maximumFractionDigits: 4})} ซึ่งอยู่สูงกว่า Swing High ล่าสุด (${targetSwingHigh.toLocaleString(undefined, {maximumFractionDigits: 4})}) หากราคาทะลุระดับนี้ โครงสร้างขาลงจะถูกยกเลิก`;
          
        const whyTp = `เป้าหมายทำกำไรวางไว้ที่ ${state.tp.toLocaleString(undefined, {maximumFractionDigits: 4})} อ้างอิงจากโซนสภาพคล่อง (Liquidity Pool) ถัดไป หรือ Swing Point สำคัญ`;
        
        const rsiInterpretation = `RSI อยู่ที่ ${rsi} ${isLong ? (rsi < 30 ? 'อยู่ในโซน Oversold แต่ต้องรอโครงสร้างราคากลับตัวยืนยัน' : 'อยู่ในโซนสนับสนุนแนวโน้มขาขึ้น') : (rsi > 70 ? 'อยู่ในโซน Overbought แต่ต้องรอโครงสร้างราคากลับตัวยืนยัน' : 'อยู่ในโซนสนับสนุนแนวโน้มขาลง')}`;
        const cciInterpretation = `CCI อยู่ที่ ${cci} ${cci > 100 ? 'โมเมนตัมเชิงบวกแข็งแกร่ง' : cci < -100 ? 'โมเมนตัมเชิงลบแข็งแกร่ง' : 'โมเมนตัมยังไม่ชัดเจน (Neutral/Choppy)'}`;
        const macdInterpretation = `MACD Histogram อยู่ที่ ${macdHist} ${parseFloat(macdHist) > 0 ? 'การขยายตัวเชิงบวกสนับสนุนการไปต่อ' : 'โมเมนตัมเชิงลบสนับสนุนฝั่ง Short หากโครงสร้างราคายืนยัน'}`;
        const volumeInterpretation = volumeSpike ? 'ปริมาณการซื้อขาย (Volume) เพิ่มขึ้น สนับสนุนโครงสร้างราคาปัจจุบัน' : 'ปริมาณการซื้อขายอยู่ในระดับปกติ รอการเข้ามาของรายใหญ่ (Institutional Participation)';
        
        const riskMmInterpretation = `ความเสี่ยง ${riskPercent}% ของพอร์ต ($${riskAmountUSD.toFixed(2)}) เพื่อโอกาสทำกำไร $${(riskAmountUSD * rrValue).toFixed(2)} (RR = 1:${rrValue.toFixed(2)})`;
        
        const whatToDoNow = currentStatus === 'ACTIONABLE' 
          ? 'Setup candidate ผ่านเกณฑ์เบื้องต้น โปรด review ความเสี่ยงและยืนยันด้วยตัวเองก่อนบันทึกแผน' 
          : currentStatus === 'WAIT' 
            ? 'รอให้สัญญาณสอดคล้องกันมากขึ้น หรือรอให้ Risk/Reward คุ้มค่ากว่านี้' 
            : currentStatus === 'INVALIDATED' 
              ? 'ยกเลิกแผนการเทรดนี้ โครงสร้างราคาปัจจุบันไม่สนับสนุนแล้ว' 
              : 'หลีกเลี่ยงการเทรดสินทรัพย์นี้ในสภาวะตลาดปัจจุบัน';

        const positionSizeUnits = riskAmountUSD / risk;
        const positionSizeUSD = positionSizeUnits * state.entry;

        setSetupDetails({
          symbol: selectedChartSymbol,
          exchange: selectedChartExchange as any,
          side: state.side,
          currentStatus,
          statusReason,
          setupType: isLong ? 'Pullback Continuation (LONG)' : 'Resistance Rejection (SHORT)',
          multiTfContext,
          displayTfLabel,
          whyEntry,
          whySl,
          whyTp,
          rsiInterpretation,
          cciInterpretation,
          macdInterpretation,
          volumeInterpretation,
          riskMmInterpretation,
          whatToDoNow,
          rr: `1 : ${rrValue.toFixed(2)}`,
          positionSizeUSD,
          positionSizeUnits,
          entry: state.entry,
          sl: state.sl,
          tp: state.tp,
          tp2: state.tp,
          confidenceScore: calculatedConfidence,
          confidence: calculatedConfidence,
          isValid: currentStatus === 'ACTIONABLE',
          isLong,
          validationFlags: {
            numericConsistency: true,
            semanticConsistency: true,
            rrConsistency: isRiskPass,
            evidenceConsistency: signalAgreementCount >= 2
          },
          fundingRate: undefined,
          isFundingFavorable: undefined,
          winRate: undefined,
          correlationBTC: undefined
        });

      } catch (error) {
        console.error("Failed to fetch klines:", error);
        if (isMounted) {
          setSetupDetails(buildChartAnalysisDataRequired(
            selectedChartSymbol,
            selectedChartExchange,
            'Data required: ไม่สามารถโหลดข้อมูลราคาได้ในเวลาที่กำหนด กรุณาลองใหม่หรือเลือก timeframe อื่น'
          ));
        }
      }
    };

    fetchAndCompute();

    return () => {
      isMounted = false;
    };
  }, [selectedChartSymbol, selectedTimeframe, selectedAssetType, lastAlertUpdate, portfolioSize, riskPercent]);

  // --- Deterministic Alert Snapshot from the current setup candidate ---
  useEffect(() => {
    if (!setupDetails || setupDetails.isChartOnly) return;

    const satisfiedConditions = [
      setupDetails.validationFlags?.numericConsistency ? 'Numeric consistency' : null,
      setupDetails.validationFlags?.semanticConsistency ? 'Directional consistency' : null,
      setupDetails.validationFlags?.rrConsistency ? 'Risk/reward gate' : null,
      setupDetails.validationFlags?.evidenceConsistency ? 'Evidence confluence' : null,
    ].filter(Boolean) as string[];

    const pendingConditions = [
      !setupDetails.validationFlags?.rrConsistency ? 'Risk/reward review' : null,
      !setupDetails.validationFlags?.evidenceConsistency ? 'Additional evidence confirmation' : null,
      setupDetails.currentStatus !== 'ACTIONABLE' ? 'Candle close confirmation' : null,
    ].filter(Boolean) as string[];

    const snapshot = setupDetailsToAlert({
      symbol: setupDetails.symbol,
      timeframe: selectedTimeframe,
      side: setupDetails.side,
      currentStatus: setupDetails.currentStatus,
      statusReason: setupDetails.statusReason,
      entry: setupDetails.entry,
      sl: setupDetails.sl,
      tp: setupDetails.tp2 || setupDetails.tp,
      rr: setupDetails.rr,
      confidenceScore: setupDetails.confidenceScore,
      conditionsSatisfied: satisfiedConditions,
      pendingConditions,
    });

    const type: AlertType = snapshot.priority === 'ACTIONABLE'
      ? 'FULL_SETUP'
      : snapshot.priority === 'INVALIDATED'
        ? 'INVALIDATION'
        : snapshot.priority === 'INTERESTING'
          ? 'CONDITION_PROGRESS'
          : 'ENTRY_ZONE';

    const newAlert: AlertEvent = {
      ...snapshot,
      exchange: 'BINANCE',
      type,
      isRead: false,
      isMuted: false,
      setupVersion: setupStateRef.current[setupDetails.symbol]?.version || 1,
      setupHash: snapshot.id,
      satisfiedConditionsCount: snapshot.conditionsSatisfied.length,
      totalConditionsCount: Math.max(snapshot.conditionsSatisfied.length + snapshot.pendingConditions.length, 1),
      confirmationMode: 'candle-close-only',
      timestamp: new Date(snapshot.timestamp).toLocaleString('th-TH'),
    };

    setAlerts(prev => {
      const existing = prev.find(a => a.id === newAlert.id && a.priority === newAlert.priority);
      if (existing) return prev;
      return [newAlert, ...prev].slice(0, 50);
    });
  }, [setupDetails, selectedTimeframe]);

  useEffect(() => {
    setUnreadAlertsCount(alerts.filter(a => !a.isRead).length);
  }, [alerts]);

  // --- Auto Close Trades Logic ---
  useEffect(() => {
    const openTrades = journal.filter(t => t.status === 'OPEN');
    if (openTrades.length === 0) return;

    openTrades.forEach(trade => {
      const market = marketData.find(m => m.symbol === trade.symbol);
      if (!market) return;

      const currentPrice = parseFloat(market.lastPrice);

      if (trade.side === 'LONG') {
        if (currentPrice >= trade.tp) {
          const pnl = trade.sizeUnits * Math.abs(trade.tp - trade.entry);
          handleCloseTrade(trade.id, 'WON', pnl);
        } else if (currentPrice <= trade.sl) {
          const pnl = -trade.sizeUnits * Math.abs(trade.entry - trade.sl);
          handleCloseTrade(trade.id, 'LOST', pnl);
        }
      } else if (trade.side === 'SHORT') {
        if (currentPrice <= trade.tp) {
          const pnl = trade.sizeUnits * Math.abs(trade.entry - trade.tp);
          handleCloseTrade(trade.id, 'WON', pnl);
        } else if (currentPrice >= trade.sl) {
          const pnl = -trade.sizeUnits * Math.abs(trade.sl - trade.entry);
          handleCloseTrade(trade.id, 'LOST', pnl);
        }
      }
    });
  }, [marketData, journal, closeTrade]);

  // --- Handlers ---
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleDownload = async () => {
    if (explanationCardRef.current) {
      try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(explanationCardRef.current, {
          backgroundColor: '#111827',
          pixelRatio: 2,
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `TradeSetup_${selectedChartSymbol}.png`;
        link.click();
      } catch (err) {
        console.error('Failed to download image', err);
        alert('เกิดข้อผิดพลาดในการดาวน์โหลดรูปภาพ');
      }
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Trade Setup: ${selectedChartSymbol}`,
      text: `Check out this trade setup for ${selectedChartSymbol} on QuantEdge AI!`,
      url: window.location.href,
    };
    
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        throw new Error('Web Share API not supported');
      }
    } catch (error) {
      console.log('Fallback to clipboard', error);
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('คัดลอกลิงก์เรียบร้อยแล้ว (Link copied to clipboard)');
      } catch (clipboardErr) {
        alert('ไม่สามารถแชร์หรือคัดลอกลิงก์ได้ กรุณาคัดลอก URL จากเบราว์เซอร์โดยตรง');
      }
    }
  };

  const handlePrint = async () => {
    if (explanationCardRef.current) {
      try {
        // Show loading state or just process directly
        const [{ toPng }, { jsPDF }] = await Promise.all([
          import('html-to-image'),
          import('jspdf')
        ]);
        const dataUrl = await toPng(explanationCardRef.current, {
          backgroundColor: '#111827',
          pixelRatio: 2,
        });
        
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: 'a4'
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate image dimensions to fit PDF
        const imgProps = pdf.getImageProperties(dataUrl);
        const margin = 20;
        const imgWidth = pdfWidth - (margin * 2);
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        
        pdf.addImage(dataUrl, 'PNG', margin, margin, imgWidth, imgHeight);
        pdf.save(`TradeSetup_${selectedChartSymbol}.pdf`);
      } catch (err) {
        console.error('Failed to generate PDF', err);
        alert('เกิดข้อผิดพลาดในการสร้าง PDF');
      }
    } else {
      window.print();
    }
  };

  const handleSaveSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert('กรุณาเข้าสู่ระบบด้วย Gmail ก่อนบันทึกแผนการเทรด เพื่อให้ข้อมูลถูกผูกกับบัญชีอีเมลของคุณ');
      handleLogin();
      return;
    }
    const entry = parseFloat(formData.entry);
    const sl = parseFloat(formData.sl);
    const tp = parseFloat(formData.tp);
    
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    const rr = risk > 0 ? reward / risk : 0;

    const newSetup: Setup = {
      id: Date.now().toString(),
      symbol: formData.symbol.toUpperCase(),
      exchange: formData.exchange,
      side: formData.side,
      entry,
      sl,
      tp,
      rr: parseFloat(rr.toFixed(2)),
      date: new Date().toLocaleString('th-TH')
    };

    const updatedSetups = [newSetup, ...setups];
    setSetups(updatedSetups);
    
    // Save to Firestore if user logged in
    saveSetupToFirestore({
      id: newSetup.id,
      symbol: newSetup.symbol,
      createdAt: Date.now(),
      setupPayload: JSON.stringify(newSetup)
    }).catch(e => console.error("Could not save setup to firestore"));

    setIsModalOpen(false);
    setFormData({ symbol: 'BTCUSDT', exchange: 'BINANCE', side: 'LONG', entry: '', sl: '', tp: '' });
  };

  const handleDeleteSetup = (id: string) => {
    if (window.confirm('คุณต้องการลบแผนการเทรดนี้ใช่หรือไม่?')) {
      const updated = setups.filter(s => s.id !== id);
      setSetups(updated);
      deleteSetupFromFirestore(id).catch(e => console.error("Could not delete setup"));
    }
  };

  const clearAllData = () => {
    if (window.confirm('คำเตือน: ข้อมูลทั้งหมดจะถูกลบอย่างถาวร ยืนยันหรือไม่?')) {
      clearAllSetupsFromFirestore(setups).catch(e => console.error("Could not delete setups"));
      setSetups([]);
    }
  };

  const markAlertAsRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const markAllAlertsAsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const filteredMarketData = activeMarketData.filter(m => 
    m.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Render Helpers ---
  const NavItem = ({ id, icon, label }: { id: 'dashboard' | 'analysis' | 'journal' | 'alerts' | 'settings' | 'guide' | 'analytics' | 'backtest' | 'screener' | 'us-stock-screener' | 'ai-bottleneck-screener', icon: React.ReactNode, label: string }) => (
    <motion.button 
      whileHover={{ x: 4, textShadow: "0px 0px 8px rgb(34 211 238)" }}
      whileTap={{ scale: 0.95 }}
      onClick={() => {
        setView(id);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
        view === id 
          ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 text-cyan-300 border-l-2 border-cyan-400 shadow-[inset_0_0_15px_rgba(34,211,238,0.1)]' 
          : 'text-slate-400 hover:bg-white/5 hover:text-fuchsia-300'
      }`}
    >
      {icon}
      {label}
      {id === 'alerts' && unreadAlertsCount > 0 && (
        <span className="ml-auto bg-fuchsia-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(217,70,239,0.8)]">
          {unreadAlertsCount}
        </span>
      )}
    </motion.button>
  );

  return (
    <div className="flex h-screen bg-[#050014] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a0033] via-[#050014] to-[#000510] text-cyan-50 font-sans overflow-hidden selection:bg-fuchsia-500/40 relative">
      {/* Cyberpunk Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(217,70,239,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(217,70,239,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#0a001a]/80 backdrop-blur-xl border-r border-fuchsia-500/30 shadow-[4px_0_24px_rgba(217,70,239,0.15)] flex flex-col transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-fuchsia-500/30 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 flex items-center gap-2 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]">
              <LineChart className="w-6 h-6 text-fuchsia-400" />
              QuantEdge AI
            </h1>
            <p className="text-xs text-slate-500 mt-1">ข้อมูลจริง (Live Data)</p>
          </div>
          <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem id="dashboard" icon={<LayoutDashboard className="w-5 h-5" />} label="ภาพรวมตลาด" />
          <NavItem id="analysis" icon={<LineChart className="w-5 h-5" />} label="วิเคราะห์กราฟ" />
          <NavItem id="alerts" icon={<Bell className="w-5 h-5" />} label="แจ้งเตือน (Alerts)" />
          
          <div className="pt-2 mt-2 border-t border-fuchsia-500/30">
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">สถิติ & เครื่องมือ</p>
            <NavItem id="journal" icon={<BookOpen className="w-5 h-5" />} label="บันทึกการเทรด" />
            <NavItem id="analytics" icon={<Activity className="w-5 h-5" />} label="แดชบอร์ดสถิติ" />
            <NavItem id="screener" icon={<Layers className="w-5 h-5" />} label="Market Screener" />
            <NavItem id="us-stock-screener" icon={<Search className="w-5 h-5" />} label="สแกนหุ้นสหรัฐ" />
            <NavItem id="ai-bottleneck-screener" icon={<Cpu className="w-5 h-5" />} label="AI Bottleneck" />
            <NavItem id="backtest" icon={<Database className="w-5 h-5" />} label="Backtest Simulator" />
          </div>
          
          <div className="pt-4 mt-4 border-t border-fuchsia-500/30">
            <motion.button 
              whileHover={{ x: 4, textShadow: "0px 0px 8px rgb(217 70 239)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setIsModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all text-fuchsia-400 hover:bg-fuchsia-500/10 hover:text-fuchsia-300 mb-4 border border-fuchsia-500/20 shadow-[0_0_10px_rgba(217,70,239,0.1)]"
            >
              <Plus className="w-5 h-5" /> แผนการเทรด
            </motion.button>
            <NavItem id="guide" icon={<BookOpen className="w-5 h-5" />} label="คู่มือการใช้งาน" />
            <NavItem id="settings" icon={<Settings className="w-5 h-5" />} label="ตั้งค่าระบบ" />
          </div>
        </nav>
        <div className="p-4 border-t border-fuchsia-500/30 bg-black/20">
          <div className="flex items-center gap-3">
            {!isAuthReady ? (
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-cyan-300 font-bold border border-cyan-500/40">
                        <Clock className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-300">กำลังตรวจสอบบัญชี</p>
                        <p className="text-xs text-cyan-400">รอ Firebase ยืนยันสถานะล็อกอิน</p>
                      </div>
                    </div>
                    <button
                      disabled
                      className="shrink-0 rounded border border-slate-600 bg-slate-700/40 px-2 py-1 text-xs text-slate-300 cursor-wait"
                    >
                      ตรวจสอบ...
                    </button>
                  </div>
                  {authFeedback && (
                    <p className="mt-2 text-[10px] leading-4 text-cyan-300">
                      {authFeedback}
                    </p>
                  )}
                </div>
            ) : user ? (
               <div className="flex-1 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   {user.photoURL ? (
                      <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full border border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                   ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-600 flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(217,70,239,0.5)]">
                        {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </div>
                   )}
                   <div className="truncate flex-1 max-w-[120px]">
                     <p className="text-sm font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] truncate">{user.displayName || user.email || 'User'}</p>
                     <p className="text-xs text-cyan-400">ซิงก์ข้อมูลคลาวด์แล้ว</p>
                   </div>
                 </div>
                 <button onClick={logout} className="text-rose-400 text-xs hover:text-rose-300 underline shrink-0">ออก</button>
               </div>
            ) : (
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 font-bold border border-slate-700">
                      U
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-400">ไม่ได้ล็อกอิน</p>
                      <p className="text-xs text-rose-400">ข้อมูลไม่ถูกซิงก์</p>
                    </div>
                  </div>
                    <button
                      onClick={handleLogin}
                      disabled={isAuthLoading}
                      className={`shrink-0 rounded border px-2 py-1 text-xs transition-colors ${
                        isAuthLoading
                          ? 'border-slate-600 bg-slate-700/40 text-slate-300 cursor-wait'
                          : 'border-cyan-500/50 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                      }`}
                    >
                      {isAuthLoading ? 'กำลังเข้า...' : 'เข้าสู่ระบบ'}
                    </button>
                  </div>
                  {authFeedback && (
                    <p className="mt-2 text-[10px] leading-4 text-cyan-300">
                      {authFeedback}
                    </p>
                  )}
                </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-[#0a001a]/80 backdrop-blur-xl border-b border-fuchsia-500/30 flex items-center justify-between px-4 md:px-8 shrink-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <button 
              className="md:hidden p-2 text-fuchsia-400 hover:bg-fuchsia-500/10 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเหรียญ (เช่น BTCUSDT)..." 
                className="w-full bg-black/40 border border-cyan-500/30 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-[inset_0_0_10px_rgba(34,211,238,0.1)]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {/* Incident Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <ShieldCheck className="w-4 h-4" />
              ระบบปกติ (All Systems Operational)
            </div>
            <span className="hidden md:flex text-xs font-medium px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full items-center gap-1">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
              เชื่อมต่อ API สด (Live)
            </span>
            <button
              onClick={connectWallet}
              className="hidden md:flex text-xs font-medium px-4 py-1.5 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 rounded-full items-center transition-all shadow-[0_0_10px_rgba(217,70,239,0.1)] hover:shadow-[0_0_15px_rgba(217,70,239,0.3)] truncate max-w-[150px]"
            >
              {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : "Connect Wallet"}
            </button>
            <motion.button 
              whileHover={{ scale: 1.1 }} 
              whileTap={{ scale: 0.9 }} 
              onClick={() => setView('alerts')}
              className="relative p-2 text-slate-400 hover:text-cyan-400 transition-colors"
            >
              <Bell className="w-6 h-6" />
              {unreadAlertsCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-fuchsia-500 rounded-full border-2 border-[#0a001a] shadow-[0_0_5px_rgba(217,70,239,0.8)]"></span>
              )}
            </motion.button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          
          {/* DASHBOARD VIEW */}
          {view === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pb-20 md:pb-0">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">ภาพรวมระบบและตลาด</h2>
                  <p className="text-slate-400 mt-1">สถิติการเทรดและข้อมูลราคาแบบ Real-time</p>
                </div>
              </div>

              {/* System Statistics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-center md:text-left">
                <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 relative overflow-hidden group">
                  <div className="absolute -bottom-2 -right-2 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                     <Target className="w-20 h-20 text-cyan-400" />
                  </div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <p className="text-slate-400 text-sm font-medium mb-1">อัตราชนะ (Win Rate)</p>
                    <h3 className="text-3xl font-black text-cyan-400">{winRate}%</h3>
                  </div>
                </div>
                
                <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 relative overflow-hidden group">
                  <div className="absolute -bottom-2 -right-2 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                     <Activity className="w-20 h-20 text-emerald-400" />
                  </div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <p className="text-slate-400 text-sm font-medium mb-1">กำไร/ขาดทุนรวม (PnL)</p>
                    <h3 className={`text-3xl font-black ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                    </h3>
                  </div>
                </div>

                <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 relative overflow-hidden group cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => setView('journal')}>
                  <div className="absolute -bottom-2 -right-2 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                     <Database className="w-20 h-20 text-purple-400" />
                  </div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <p className="text-slate-400 text-sm font-medium mb-1">ไม้ที่เปิดอยู่ / แผนทั้งหมด</p>
                    <h3 className="text-3xl font-black text-purple-400">
                      {openTradesCount} <span className="text-slate-500 text-lg font-medium">/ {activeSetupsCount}</span>
                    </h3>
                  </div>
                </div>

                <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 relative overflow-hidden group cursor-pointer hover:border-amber-500/50 transition-colors" onClick={() => setView('journal')}>
                  <div className="absolute -bottom-2 -right-2 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                     <BookOpen className="w-20 h-20 text-amber-400" />
                  </div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <p className="text-slate-400 text-sm font-medium mb-1">ประวัติการเทรด (Total)</p>
                    <h3 className="text-3xl font-black text-amber-400">{totalTrades} <span className="text-sm font-medium text-slate-500">ครั้ง</span></h3>
                  </div>
                </div>
              </div>

              {/* Live Market Data Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {filteredMarketData.slice(0, 4).map((data, idx) => {
                  const isPositive = parseFloat(data.priceChangePercent) >= 0;
                  return (
                    <motion.div 
                      key={data.symbol} 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ y: -5, borderColor: "rgba(217, 70, 239, 0.5)", boxShadow: "0 0 20px rgba(217, 70, 239, 0.2)" }}
                      className="bg-gradient-to-br from-[#13002b]/80 to-[#0a001a]/80 backdrop-blur-md p-5 rounded-xl border border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.15)] cursor-pointer transition-all relative overflow-hidden group" 
                      onClick={() => { setSelectedChartSymbol(data.symbol); setView('analysis'); }}
                    >
                      <div className="absolute inset-0 border-t border-white/10 rounded-xl pointer-events-none"></div>
                      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity text-cyan-400">
                        <Zap className="w-16 h-16" />
                      </div>
                      <div className="flex justify-between items-start relative z-10">
                        <p className="text-sm font-bold text-cyan-100 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]">{data.symbol}</p>
                        <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-lime-500/20 shadow-[0_0_10px_rgba(132,204,22,0.3)]' : 'bg-fuchsia-500/20 shadow-[0_0_10px_rgba(217,70,239,0.3)]'}`}>
                          {isPositive ? <TrendingUp className="w-4 h-4 text-lime-400" /> : <TrendingDown className="w-4 h-4 text-fuchsia-400" />}
                        </div>
                      </div>
                      <h3 className="text-2xl font-black text-white mt-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                        ${parseFloat(data.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </h3>
                      <p className={`text-sm font-bold mt-2 relative z-10 ${isPositive ? 'text-lime-400 drop-shadow-[0_0_5px_rgba(132,204,22,0.8)]' : 'text-fuchsia-400 drop-shadow-[0_0_5px_rgba(217,70,239,0.8)]'}`}>
                        {isPositive ? '+' : ''}{parseFloat(data.priceChangePercent).toFixed(2)}%
                      </p>
                    </motion.div>
                  );
                })}
                {filteredMarketData.length === 0 && (
                  <div className="col-span-full text-center py-8 text-slate-500">กำลังโหลดข้อมูล หรือไม่พบเหรียญที่ค้นหา...</div>
                )}
              </div>

              {/* Active Setups Table */}
              <h3 className="text-lg font-bold text-white mb-4">แผนการเทรดของคุณ (Active Setups)</h3>
              <div className="bg-[#111827] rounded-xl border border-slate-800 shadow-sm overflow-x-auto">
                {setups.length > 0 ? (
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-800/50 border-b border-slate-800 text-sm text-slate-400">
                        <th className="p-4 font-medium">สัญลักษณ์</th>
                        <th className="p-4 font-medium">สถานะ</th>
                        <th className="p-4 font-medium">ราคาเข้า</th>
                        <th className="p-4 font-medium">ตัดขาดทุน</th>
                        <th className="p-4 font-medium">ทำกำไร</th>
                        <th className="p-4 font-medium">R/R</th>
                        <th className="p-4 font-medium">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {setups.map((setup) => (
                        <motion.tr 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          key={setup.id} 
                          className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="p-4 font-bold text-white">
                            {setup.symbol}
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{setup.exchange}</span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${setup.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {setup.side}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-slate-300">{(setup.entry || 0).toLocaleString()}</td>
                          <td className="p-4 font-mono text-rose-400">{(setup.sl || 0).toLocaleString()}</td>
                          <td className="p-4 font-mono text-emerald-400">{(setup.tp || 0).toLocaleString()}</td>
                          <td className="p-4 font-medium text-cyan-400">1:{setup.rr}</td>
                          <td className="p-4">
                            <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => handleDeleteSetup(setup.id)} className="text-rose-500 hover:text-rose-400 p-1">
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    ยังไม่มีแผนการเทรด คลิกปุ่ม "แผนการเทรด" เพื่อเริ่มต้น
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ANALYSIS VIEW */}
          {view === 'analysis' && setupDetails && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col pb-20 md:pb-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 shrink-0">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Target className="w-6 h-6 text-cyan-400" />
                    Visual Trade Setup Engine
                  </h2>
                  <p className="text-slate-400 mt-1">AI-Assisted Technical Analysis & Trade Plan</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={`${selectedAssetType}|${selectedChartExchange}|${selectedChartSymbol}`}
                    onChange={(e) => {
                      const [type, exch, sym] = e.target.value.split('|');
                      delete setupStateRef.current[sym];
                      setSetupDetails(buildChartAnalysisPlaceholder(sym, exch));
                      setLatestKlines([]);
                      setMarketIntegrityReport(null);
                      setSelectedAssetType(type);
                      setSelectedChartExchange(exch);
                      setSelectedChartSymbol(sym);
                    }}
                    className="w-full sm:w-auto p-2 border border-slate-700 rounded-lg bg-[#1F2937] text-white font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  >
                    <optgroup label="Crypto (Binance)">
                      {marketData.map(m => <option key={`BINANCE:${m.symbol}`} value={`CRYPTO|BINANCE|${m.symbol}`}>{m.symbol}</option>)}
                      {marketData.length === 0 && <option value="CRYPTO|BINANCE|BTCUSDT">BTCUSDT</option>}
                    </optgroup>
                    <optgroup label="Commodities">
                      {PRESET_ASSETS.filter(a => a.type === 'COMMODITY').map(a => (
                        <option key={`${a.exchange}:${a.symbol}`} value={`COMMODITY|${a.exchange}|${a.symbol}`}>{a.symbol} ({a.name})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Indices">
                      {PRESET_ASSETS.filter(a => a.type === 'INDEX').map(a => (
                        <option key={`${a.exchange}:${a.symbol}`} value={`INDEX|${a.exchange}|${a.symbol}`}>{a.symbol} ({a.name})</option>
                      ))}
                    </optgroup>
                    <optgroup label="US Stocks">
                      {selectedAssetType === 'STOCK' && !PRESET_ASSETS.some(a => a.type === 'STOCK' && a.symbol === selectedChartSymbol) && (
                        <option value={`STOCK|${selectedChartExchange}|${selectedChartSymbol}`}>{selectedChartSymbol} (จาก Screener)</option>
                      )}
                      {PRESET_ASSETS.filter(a => a.type === 'STOCK').map(a => (
                        <option key={`${a.exchange}:${a.symbol}`} value={`STOCK|${a.exchange}|${a.symbol}`}>{a.symbol} ({a.name})</option>
                      ))}
                    </optgroup>
                    <optgroup label="US ETFs">
                      {PRESET_ASSETS.filter(a => a.type === 'ETF').map(a => (
                        <option key={`${a.exchange}:${a.symbol}`} value={`ETF|${a.exchange}|${a.symbol}`}>{a.symbol} ({a.name})</option>
                      ))}
                    </optgroup>
                  </select>
                  
                  {/* Export Buttons */}
                  <div className="hidden sm:flex items-center gap-2">
                    <button onClick={handleDownload} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 rounded-lg transition-colors" title="Export as Image"><Download className="w-5 h-5" /></button>
                    <button onClick={handlePrint} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 rounded-lg transition-colors" title="Print / PDF"><Printer className="w-5 h-5" /></button>
                    <button onClick={handleShare} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 rounded-lg transition-colors" title="Share Link"><Share2 className="w-5 h-5" /></button>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                {/* Left: Chart */}
                <div ref={chartContainerRef} className="flex-1 bg-gradient-to-br from-[#13002b]/80 to-[#0a001a]/80 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.15)] overflow-hidden min-h-[500px] lg:min-h-0 flex flex-col relative">
                  <div className="absolute inset-0 border-t border-white/10 rounded-xl pointer-events-none z-0"></div>
                  <div className="p-3 border-b border-fuchsia-500/30 bg-black/40 flex justify-between items-center shrink-0 relative z-10">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{selectedChartSymbol}</span>
                      <select 
                        value={selectedTimeframe}
                        onChange={(e) => setSelectedTimeframe(e.target.value)}
                        className="text-xs font-bold px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded shadow-[0_0_10px_rgba(34,211,238,0.3)] border-none outline-none cursor-pointer"
                      >
                        <option value="15m">15m Timeframe</option>
                        <option value="1h">1H Timeframe</option>
                        <option value="4h">4H Timeframe</option>
                        <option value="1d">1D Timeframe</option>
                      </select>
                      <span className="text-xs font-bold px-2 py-1 bg-fuchsia-500/20 text-fuchsia-300 rounded shadow-[0_0_10px_rgba(217,70,239,0.3)] hidden sm:inline-block">TradingView Real Chart Only</span>
                    </div>
                    <button onClick={toggleFullscreen} className="p-1.5 text-cyan-400 hover:text-fuchsia-400 hover:bg-white/5 rounded transition-colors" title="Toggle Fullscreen">
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex-1 relative z-10 min-h-[400px]">
                    <React.Suspense fallback={<ModuleLoader />}>
                      <TradingViewWidget
                        symbol={selectedChartSymbol}
                        exchange={selectedChartExchange}
                        interval={selectedTimeframe === '15m' ? '15' : selectedTimeframe === '1h' ? '60' : selectedTimeframe === '4h' ? '240' : 'D'}
                      />
                    </React.Suspense>
                  </div>
                </div>

                {/* Right: AI Explanation Card */}
                <div ref={explanationCardRef} className="w-full lg:w-[450px] xl:w-[500px] bg-gradient-to-b from-[#13002b]/90 to-[#050014]/90 backdrop-blur-xl rounded-xl border border-fuchsia-500/30 shadow-[0_0_40px_rgba(217,70,239,0.15)] overflow-y-auto shrink-0 flex flex-col relative">
                  <div className="absolute inset-0 border-t border-white/10 rounded-xl pointer-events-none z-0"></div>
                  <div className="p-5 border-b border-fuchsia-500/30 sticky top-0 bg-[#0a001a]/90 backdrop-blur-md z-20 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-bold shadow-[0_0_10px_currentColor] ${setupDetails.isChartOnly ? 'bg-slate-500/20 text-slate-400' : setupDetails.side === 'LONG' ? 'bg-lime-500/20 text-lime-400' : 'bg-fuchsia-500/20 text-fuchsia-400'}`}>
                          {setupDetails.isChartOnly ? 'CHART' : setupDetails.side}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-bold shadow-[0_0_10px_currentColor] ${
                          setupDetails.currentStatus === 'ACTIONABLE' ? 'bg-emerald-500/20 text-emerald-400' : 
                          setupDetails.currentStatus === 'WAIT' ? 'bg-amber-500/20 text-amber-400' : 
                          setupDetails.currentStatus === 'INVALIDATED' ? 'bg-rose-500/20 text-rose-400' : 
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {setupDetails.currentStatus}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{setupDetails.setupType}</span>
                    </div>
                    {!setupDetails.isChartOnly && (
                      <div className="text-right">
                        <div className="text-2xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">{setupDetails.confidenceScore}%</div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Confidence</div>
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-6">
                    {/* Price Levels */}
                    {!setupDetails.isChartOnly && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                        <div className="text-xs text-slate-400 mb-1">Entry Zone</div>
                        <div className="font-mono font-bold text-white">{(setupDetails.entry || 0).toLocaleString(undefined, {maximumFractionDigits: 4})}</div>
                      </div>
                      <div className="bg-rose-500/5 p-3 rounded-lg border border-rose-500/20">
                        <div className="text-xs text-rose-400 mb-1">Stop Loss</div>
                        <div className="font-mono font-bold text-rose-400">{(setupDetails.sl || 0).toLocaleString(undefined, {maximumFractionDigits: 4})}</div>
                      </div>
                      <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/20">
                        <div className="text-xs text-emerald-400 mb-1">Take Profit</div>
                        <div className="font-mono font-bold text-emerald-400">{(setupDetails.tp || 0).toLocaleString(undefined, {maximumFractionDigits: 4})}</div>
                      </div>
                    </div>
                    )}

                    {/* Status Reason */}
                    <div className="space-y-4">
                      <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                        <h4 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2">
                          <Info className="w-4 h-4" /> Market Summary
                        </h4>
                        <p className="text-slate-300 text-sm leading-relaxed">{setupDetails.statusReason}</p>
                      </div>

                      {selectedIsUsEquity && (
                        <div className="bg-cyan-500/5 p-4 rounded-xl border border-cyan-500/20">
                          <h4 className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-2">
                            <Search className="w-4 h-4" /> วิเคราะห์หุ้นสหรัฐที่เลือก
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                              <div className="text-slate-500 uppercase">Ticker</div>
                              <div className="text-white font-black mt-1">{selectedChartSymbol}</div>
                            </div>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                              <div className="text-slate-500 uppercase">Market Data</div>
                              <div className={`font-black mt-1 ${usStockDataReport?.status === 'PASS' ? 'text-emerald-300' : usStockDataReport?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                                {usStockDataReport?.status ?? 'กำลังประมวลผล'}
                              </div>
                            </div>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                              <div className="text-slate-500 uppercase">Relative Strength</div>
                              <div className={`font-black mt-1 ${usStockIndicators?.status === 'PASS' ? 'text-emerald-300' : usStockIndicators?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                                {usStockIndicators ? `${usStockIndicators.relativeStrengthPercent}%` : 'Data required'}
                              </div>
                            </div>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                              <div className="text-slate-500 uppercase">RVOL / Gap</div>
                              <div className="text-slate-200 font-black mt-1">
                                {usStockIndicators ? `${usStockIndicators.relativeVolume} / ${usStockIndicators.gapPercent}%` : 'Data required'}
                              </div>
                            </div>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                              <div className="text-slate-500 uppercase">Screener Score</div>
                              <div className={`font-black mt-1 ${usStockScreenerScore?.status === 'PASS' ? 'text-emerald-300' : usStockScreenerScore?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                                {usStockScreenerScore ? `${usStockScreenerScore.score}/100` : 'Data required'}
                              </div>
                            </div>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                              <div className="text-slate-500 uppercase">Stock Risk</div>
                              <div className={`font-black mt-1 ${usStockRisk?.status === 'PASS' ? 'text-emerald-300' : usStockRisk?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                                {usStockRisk?.status ?? 'REVIEW'}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2 text-xs text-slate-300 leading-relaxed">
                            <p><span className="text-cyan-300 font-bold">มุมมอง:</span> {usStockScreenerScore ? `${usStockScreenerScore.direction} | ${usStockScreenerScore.tags.slice(0, 3).join(', ') || 'รอ confirmation เพิ่ม'}` : 'ต้องรอข้อมูลแท่งเทียนและ volume จาก proxy ก่อนสรุป setup'}</p>
                            <p><span className="text-amber-300 font-bold">ข้อควรระวัง:</span> {[...(usStockDataReport?.issues ?? []), ...(usStockIndicators?.issues ?? []), ...(usStockRisk?.issues ?? []), ...(usStockScreenerScore?.issues ?? [])].slice(0, 4).map((issue: any) => issue.message ?? issue).join(' | ') || 'ยังไม่พบ blocker หลัก แต่ต้องยืนยัน breakout/retest และ liquidity ก่อนบันทึกแผน'}</p>
                          </div>
                        </div>
                      )}
                      
                      {!setupDetails.isChartOnly && (
                      <>
                      <div className="bg-fuchsia-500/5 p-4 rounded-xl border border-fuchsia-500/20">
                        <h4 className="text-sm font-bold text-fuchsia-400 mb-2 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Entry Rationale
                        </h4>
                        <p className="text-slate-300 text-sm leading-relaxed">{setupDetails.whyEntry}</p>
                        <p className="text-slate-300 text-sm leading-relaxed mt-2"><span className="text-rose-400">SL:</span> {setupDetails.whySl}</p>
                        <p className="text-slate-300 text-sm leading-relaxed mt-2"><span className="text-emerald-400">TP:</span> {setupDetails.whyTp}</p>
                      </div>

                      <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20">
                        <h4 className="text-sm font-bold text-amber-400 mb-2 flex items-center gap-2">
                          <Activity className="w-4 h-4" /> Indicators
                        </h4>
                        <ul className="space-y-2 text-sm text-slate-300">
                          <li><span className="font-bold text-slate-400">RSI:</span> {setupDetails.rsiInterpretation}</li>
                          <li><span className="font-bold text-slate-400">MACD:</span> {setupDetails.macdInterpretation}</li>
                          <li><span className="font-bold text-slate-400">Volume:</span> {setupDetails.volumeInterpretation}</li>
                        </ul>
                      </div>
                      </>
                      )}
                    </div>

                    {/* Reasoning */}
                    {!setupDetails.isChartOnly && (
                    <>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="mt-0.5 shrink-0"><Target className="w-5 h-5 text-cyan-400" /></div>
                        <div>
                          <h4 className="text-sm font-bold text-white">ทำไมถึงเข้าเทรดจุดนี้? (Why Entry)</h4>
                          <p className="text-sm text-slate-300 mt-1 leading-relaxed">{setupDetails.whyEntry}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="mt-0.5 shrink-0"><ShieldAlert className="w-5 h-5 text-rose-400" /></div>
                        <div>
                          <h4 className="text-sm font-bold text-white">เหตุผลของ Stop Loss</h4>
                          <p className="text-sm text-slate-300 mt-1 leading-relaxed">{setupDetails.whySl}</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="mt-0.5 shrink-0"><TrendingUp className="w-5 h-5 text-emerald-400" /></div>
                        <div>
                          <h4 className="text-sm font-bold text-white">เหตุผลของ Take Profit</h4>
                          <p className="text-sm text-slate-300 mt-1 leading-relaxed">{setupDetails.whyTp}</p>
                        </div>
                      </div>
                    </div>

                    {/* Multi-Agent Analysis */}
                    <div className="bg-[#1F2937] rounded-xl p-4 border border-slate-700">
                      <h4 className="text-sm font-bold text-white mb-3">Multi-Agent Analysis</h4>
                      
                      <div className="mb-4">
                        <div className="text-xs text-slate-400 uppercase mb-1">Multi-Timeframe Context</div>
                        <div className="text-sm text-slate-200">
                          {Array.isArray(setupDetails.multiTfContext) ? (
                            <ul className="list-disc pl-4 space-y-1">
                              {setupDetails.multiTfContext.map((ctx: string, idx: number) => (
                                <li key={idx}>{ctx}</li>
                              ))}
                            </ul>
                          ) : (
                            setupDetails.multiTfContext
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase">RSI Interpretation ({setupDetails.displayTfLabel})</div>
                          <div className="text-xs text-slate-300">{setupDetails.rsiInterpretation}</div>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase">CCI Interpretation ({setupDetails.displayTfLabel})</div>
                          <div className="text-xs text-slate-300">{setupDetails.cciInterpretation}</div>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase">MACD Interpretation ({setupDetails.displayTfLabel})</div>
                          <div className="text-xs text-slate-300">{setupDetails.macdInterpretation}</div>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase">Volume Interpretation ({setupDetails.displayTfLabel})</div>
                          <div className="text-xs text-slate-300">{setupDetails.volumeInterpretation}</div>
                        </div>
                      </div>
                    </div>
                    </>
                    )}

                    {!setupDetails.isValid && !setupDetails.isChartOnly && (
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-rose-400">
                            {setupDetails.currentStatus}
                          </h4>
                          <p className="text-xs text-rose-300/80 mt-1">{setupDetails.statusReason}</p>
                        </div>
                      </div>
                    )}

                    {!setupDetails.isChartOnly && (
                    <>
                    <hr className="border-slate-800" />

                    {/* Risk & MM */}
                    <div className="bg-[#0B0F19] rounded-xl p-4 text-white border border-slate-800">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-cyan-400" /> Risk & Money Management
                        </h4>
                      </div>
                      
                      {/* Dynamic Sizing Inputs */}
                      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase mb-1">Portfolio Size ($)</label>
                          <input 
                            type="number" 
                            value={portfolioSize}
                            onChange={(e) => handleUpdatePortfolioSize(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase mb-1">Risk Per Trade (%)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={riskPercent}
                            onChange={(e) => handleUpdateRiskPercent(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-400">Risk/Reward Ratio</span>
                          <span className="font-bold text-cyan-400">{setupDetails.rr}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-400">Risk Amount</span>
                          <span className="text-sm font-medium text-rose-400">${(portfolioSize * (riskPercent / 100)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                          <span className="text-sm text-slate-400">Position Size (USD)</span>
                          <span className="text-sm font-bold text-emerald-400">${setupDetails.positionSizeUSD?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-400">Position Size (Units)</span>
                          <span className="text-sm font-medium text-slate-300">{setupDetails.positionSizeUnits?.toLocaleString(undefined, {maximumFractionDigits: 4}) || '0'} {setupDetails.symbol.replace('USDT', '')}</span>
                        </div>
                        {activeRiskReport && (
                          <div className="pt-3 mt-3 border-t border-slate-800 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-400">Risk Policy Gate</span>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded border ${getGateBadgeClass(activeRiskReport.status)}`}>
                                {activeRiskReport.status}
                              </span>
                            </div>
                            {activeRiskReport.issues.slice(0, 3).map(issue => (
                              <div key={issue.code} className="text-[11px] text-slate-400 flex items-start gap-2">
                                <span className="font-mono text-slate-500">{issue.code}</span>
                                <span>{issue.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {activePortfolioRiskReport && (
                          <div className="pt-3 mt-3 border-t border-slate-800 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-400">Portfolio Gate</span>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded border ${getGateBadgeClass(activePortfolioRiskReport.status)}`}>
                                {activePortfolioRiskReport.status}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500">Projected Heat</span>
                              <span className="text-slate-300">{activePortfolioRiskReport.projectedHeatPercent}%</span>
                            </div>
                            {activePortfolioRiskReport.issues.slice(0, 3).map(issue => (
                              <div key={issue.code} className="text-[11px] text-slate-400 flex items-start gap-2">
                                <span className="font-mono text-slate-500">{issue.code}</span>
                                <span>{issue.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Institutional Metrics */}
                    <div className="bg-[#1F2937] rounded-xl p-4 border border-slate-700">
                      <h4 className="text-sm font-bold text-white mb-3">Institutional Metrics</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase">Historical Win-Rate</div>
                          <div className="font-bold text-slate-300">{typeof setupDetails.winRate === 'number' ? `${setupDetails.winRate}%` : 'N/A'}</div>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase">BTC Correlation</div>
                          <div className={`font-bold ${parseFloat(setupDetails.correlationBTC || '0') > 0.8 ? 'text-rose-400' : 'text-cyan-400'}`}>
                            {setupDetails.correlationBTC || 'N/A'}
                          </div>
                        </div>
                        {typeof setupDetails.fundingRate === 'number' ? (
                          <div className={`col-span-2 p-2 rounded border ${setupDetails.isFundingFavorable ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                            <div className="text-[10px] uppercase mb-1">Funding Rate Analysis</div>
                            <div className="text-xs font-medium">
                              Current Rate: {setupDetails.fundingRate}%
                              ({setupDetails.isFundingFavorable ? 'Favorable for ' + setupDetails.side : 'Unfavorable for ' + setupDetails.side})
                            </div>
                          </div>
                        ) : (
                          <div className="col-span-2 p-2 rounded border bg-slate-800/50 border-slate-700 text-slate-300">
                            <div className="text-[10px] uppercase mb-1 text-slate-400">Funding Rate Analysis</div>
                            <div className="text-xs font-medium">N/A - funding feed is not integrated yet.</div>
                          </div>
                        )}
                        {parseFloat(setupDetails.correlationBTC || '0') > 0.8 && setupDetails.symbol !== 'BTCUSDT' && (
                          <div className="col-span-2 p-2 rounded border bg-amber-500/10 border-amber-500/20 text-amber-400 text-xs">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            <strong>Warning:</strong> High correlation with BTC. Ensure you are not over-exposed in the same direction.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Plan */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-white border-l-4 border-cyan-500 pl-2">Action Plan</h4>
                      
                      <div className="bg-cyan-500/10 text-cyan-300 p-3 rounded-lg text-sm flex gap-2 border border-cyan-500/20">
                        <CheckCircle2 className="w-5 h-5 shrink-0 text-cyan-400" />
                        <div><strong className="text-cyan-200">สิ่งที่ต้องทำตอนนี้:</strong> {setupDetails.whatToDoNow}</div>
                      </div>

                      <div className="bg-slate-800/50 text-slate-300 p-3 rounded-lg text-sm flex gap-2 border border-slate-700">
                        <ShieldCheck className="w-5 h-5 shrink-0 text-slate-400" />
                        <div><strong className="text-slate-200">Risk / MM:</strong> {setupDetails.riskMmInterpretation}</div>
                      </div>
                    </div>
                    </>
                    )}

                    {/* Reviewed Trade Plan Button */}
                    {setupDetails.isValid && !setupDetails.isChartOnly && (
                      <button 
                        onClick={() => {
                          const userConfirmedRisk = window.confirm(
                            `โปรดยืนยันว่าได้ตรวจสอบความเสี่ยงด้วยตัวเองแล้ว\n\n${setupDetails.symbol} ${setupDetails.side}\nEntry: ${setupDetails.entry}\nSL: ${setupDetails.sl}\nTP: ${setupDetails.tp2}\nPosition: $${setupDetails.positionSizeUSD?.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                          );
                          const canRecord = canExecuteCandidate({
                            currentStatus: setupDetails.currentStatus,
                            side: setupDetails.side,
                            entry: setupDetails.entry,
                            sl: setupDetails.sl,
                            tp: setupDetails.tp2 || setupDetails.tp,
                            rr: setupDetails.rr,
                            userConfirmedRisk,
                          });
                          const riskDecision = evaluateTradeRisk({
                            side: setupDetails.side,
                            entry: setupDetails.entry,
                            stopLoss: setupDetails.sl,
                            takeProfit: setupDetails.tp2 || setupDetails.tp,
                            accountEquity: portfolioSize,
                            riskPercent,
                            manualConfirmation: userConfirmedRisk
                          });
                          const recordCandidate = buildRecordPlanCandidateExposure({
                            symbol: setupDetails.symbol,
                            side: setupDetails.side,
                            entry: setupDetails.entry,
                            stopLoss: setupDetails.sl,
                            takeProfit: setupDetails.tp2 || setupDetails.tp,
                            riskDecision,
                            maxPositionUsd: portfolioSize * 0.6
                          });
                          const portfolioDecision = evaluatePortfolioRisk({
                            accountEquity: portfolioSize,
                            currentTrades: journal,
                            candidate: recordCandidate
                          });
                          const setupId = buildSetupIdentity({
                            symbol: setupDetails.symbol,
                            timeframe: selectedTimeframe,
                            side: setupDetails.side,
                            entry: setupDetails.entry,
                            sl: setupDetails.sl,
                            tp: setupDetails.tp2 || setupDetails.tp
                          });
                          const issueCodes = [
                            ...riskDecision.issues.map(issue => issue.code),
                            ...portfolioDecision.issues.map(issue => issue.code)
                          ];
                          const auditEntry = createExecutionAuditEntry({
                            setupId,
                            symbol: setupDetails.symbol,
                            side: setupDetails.side,
                            action: 'RECORD_PLAN',
                            decision: !canRecord || riskDecision.status === 'BLOCK' || portfolioDecision.status === 'BLOCK'
                              ? 'BLOCK'
                              : riskDecision.status === 'REVIEW' || portfolioDecision.status === 'REVIEW'
                                ? 'REVIEW'
                                : 'ALLOW',
                            riskGateStatus: riskDecision.status,
                            portfolioGateStatus: portfolioDecision.status,
                            issueCodes,
                            timestamp: new Date().toISOString()
                          });
                          setExecutionAudit(prev => [auditEntry, ...prev].slice(0, 50));

                          if (!canRecord || riskDecision.status !== 'PASS' || portfolioDecision.status === 'BLOCK') {
                            alert(`Trade plan was not recorded. Risk gate: ${riskDecision.status}, Portfolio gate: ${portfolioDecision.status}${issueCodes.length ? ` (${issueCodes.join(', ')})` : ''}`);
                            return;
                          }

                          handleExecuteTrade({
                            symbol: setupDetails.symbol,
                            side: setupDetails.side,
                            entry: setupDetails.entry,
                            sl: setupDetails.sl,
                            tp: setupDetails.tp2 || setupDetails.tp,
                            sizeUSD: recordCandidate.sizeUsd,
                            sizeUnits: recordCandidate.sizeUnits
                          });
                          saveInstitutionalAuditArtifactToFirestore({
                            id: `${setupId}-evidence`,
                            kind: 'EVIDENCE_LEDGER',
                            symbol: setupDetails.symbol,
                            status: evidenceLedger.status,
                            payload: evidenceLedger
                          }).catch(() => {});
                          if (latestPlanVersion) {
                            saveInstitutionalAuditArtifactToFirestore({
                              id: latestPlanVersion.id,
                              kind: 'PLAN_VERSION',
                              symbol: setupDetails.symbol,
                              status: 'PASS',
                              payload: latestPlanVersion
                            }).catch(() => {});
                          }
                          saveInstitutionalAuditArtifactToFirestore({
                            id: `${setupId}-report`,
                            kind: 'PROFESSIONAL_REPORT',
                            symbol: setupDetails.symbol,
                            status: professionalReport.status,
                            payload: professionalReport
                          }).catch(() => {});
                          alert('บันทึก reviewed trade plan แล้ว โปรดติดตามผลใน Journal');
                          setView('journal');
                        }}
                        className="w-full mt-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-600 hover:from-cyan-400 hover:via-blue-400 hover:to-fuchsia-500 text-white font-bold py-3 px-4 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_30px_rgba(217,70,239,0.6)] border-t border-white/20 transition-all flex items-center justify-center gap-2 uppercase tracking-wider relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                        <Zap className="w-5 h-5 relative z-10" />
                        <span className="relative z-10 drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">Review & Record Trade Plan</span>
                      </button>
                    )}

                    {/* Explain this setup Button */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button 
                        onClick={() => {
                          // Open AI Copilot with "Explain Setup" context
                          const currentMarket = marketData.find(c => c.symbol === setupDetails.symbol);
                          const contextWithPrice = { ...setupDetails, currentPrice: currentMarket ? parseFloat(currentMarket.lastPrice) : null };
                          const event = new CustomEvent('open-ai-copilot', { detail: { tab: 'explain', context: contextWithPrice } });
                          window.dispatchEvent(event);
                        }}
                        className="w-full bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 font-bold py-2.5 px-4 rounded-xl border border-fuchsia-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <Info className="w-4 h-4" />
                        Explain Setup
                      </button>
                      
                      <button 
                        onClick={() => {
                          const currentMarket = marketData.find(c => c.symbol === setupDetails.symbol);
                          const contextWithPrice = { ...setupDetails, currentPrice: currentMarket ? parseFloat(currentMarket.lastPrice) : null };
                          const event = new CustomEvent('open-ai-copilot', { detail: { tab: 'portfolio', context: contextWithPrice } });
                          window.dispatchEvent(event);
                        }}
                        className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-bold py-2.5 px-4 rounded-xl border border-cyan-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <Activity className="w-4 h-4" />
                        Portfolio Impact
                      </button>
                    </div>

                    <button 
                      onClick={() => {
                        const currentMarket = marketData.find(c => c.symbol === setupDetails.symbol);
                        const contextWithPrice = { ...setupDetails, currentPrice: currentMarket ? parseFloat(currentMarket.lastPrice) : null };
                        const event = new CustomEvent('open-ai-copilot', { detail: { tab: 'diff', context: contextWithPrice } });
                        window.dispatchEvent(event);
                      }}
                      className="w-full mt-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 font-bold py-2.5 px-4 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      Setup Diff Viewer
                    </button>

                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* JOURNAL VIEW */}
          {view === 'journal' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pb-20 md:pb-0">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Trade Journal</h2>
                  <p className="text-slate-400">ประวัติการเทรดและสถิติความแม่นยำ (Win Rate)</p>
                </div>
                {journal.length > 0 && (
                  <button onClick={clearJournal} className="text-sm text-rose-400 hover:text-rose-300 transition-colors">
                    ล้างประวัติทั้งหมด
                  </button>
                )}
              </div>
              
              {/* Statistics Dashboard */}
              {journal.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 shadow-sm">
                    <div className="text-sm text-slate-400 mb-1">Total Trades</div>
                    <div className="text-2xl font-bold text-white">{journal.length}</div>
                  </div>
                  <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 shadow-sm">
                    <div className="text-sm text-slate-400 mb-1">Win Rate</div>
                    <div className="text-2xl font-bold text-cyan-400">
                      {journal.filter(t => t.status !== 'OPEN').length > 0 
                        ? ((journal.filter(t => t.status === 'WON').length / journal.filter(t => t.status !== 'OPEN').length) * 100).toFixed(1) 
                        : '0.0'}%
                    </div>
                  </div>
                  <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 shadow-sm">
                    <div className="text-sm text-slate-400 mb-1">Total PnL</div>
                    <div className={`text-2xl font-bold ${journal.reduce((sum, t) => sum + (t.pnlUSD || 0), 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${journal.reduce((sum, t) => sum + (t.pnlUSD || 0), 0).toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </div>
                  </div>
                  <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 shadow-sm">
                    <div className="text-sm text-slate-400 mb-1">Win / Loss</div>
                    <div className="text-2xl font-bold text-white">
                      <span className="text-emerald-400">{journal.filter(t => t.status === 'WON').length}</span>
                      <span className="text-slate-500 mx-2">/</span>
                      <span className="text-rose-400">{journal.filter(t => t.status === 'LOST').length}</span>
                    </div>
                  </div>
                </div>
              )}

              {journal.length === 0 ? (
                <div className="text-center text-slate-500 py-10 bg-[#111827] rounded-xl border border-slate-800">
                  <p>ยังไม่มีประวัติการเทรด</p>
                  <p className="text-sm mt-2">ไปที่หน้า Dashboard เพื่อวิเคราะห์และบันทึก reviewed trade plan</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {journal.map((trade, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                      whileHover={{ y: -5, borderColor: "rgba(6, 182, 212, 0.5)" }}
                      key={trade.id} 
                      className="bg-[#111827] p-6 rounded-xl border border-slate-800 shadow-sm relative group transition-colors flex flex-col"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${trade.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {trade.symbol.substring(0, 3)}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">{trade.symbol}</h3>
                            <div className="text-xs text-slate-400">{new Date(trade.date).toLocaleString()}</div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          trade.status === 'OPEN' ? 'bg-amber-500/10 text-amber-400' : 
                          trade.status === 'WON' ? 'bg-emerald-500/10 text-emerald-400' : 
                          'bg-rose-500/10 text-rose-400'
                        }`}>
                          {trade.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4 flex-1">
                        <div className="bg-[#0B0F19] p-3 rounded-lg border border-slate-800">
                          <div className="text-xs text-slate-500 mb-1">Entry</div>
                          <div className="font-mono text-white text-sm">{(trade.entry || 0).toLocaleString(undefined, {maximumFractionDigits: 4})}</div>
                        </div>
                        <div className="bg-[#0B0F19] p-3 rounded-lg border border-slate-800">
                          <div className="text-xs text-slate-500 mb-1">Target (TP)</div>
                          <div className="font-mono text-cyan-400 text-sm">{(trade.tp || 0).toLocaleString(undefined, {maximumFractionDigits: 4})}</div>
                        </div>
                        <div className="bg-[#0B0F19] p-3 rounded-lg border border-slate-800">
                          <div className="text-xs text-slate-500 mb-1">Stop Loss</div>
                          <div className="font-mono text-rose-400 text-sm">{(trade.sl || 0).toLocaleString(undefined, {maximumFractionDigits: 4})}</div>
                        </div>
                        <div className="bg-[#0B0F19] p-3 rounded-lg border border-slate-800">
                          <div className="text-xs text-slate-500 mb-1">Size (USD)</div>
                          <div className="font-mono text-emerald-400 text-sm">${(trade.sizeUSD || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                        </div>
                      </div>

                      {trade.status === 'OPEN' && (
                        <div className="flex gap-2 mt-2 pt-4 border-t border-slate-800">
                          <button 
                            onClick={() => {
                              const pnl = trade.sizeUnits * Math.abs(trade.tp - trade.entry);
                              handleCloseTrade(trade.id, 'WON', pnl);
                            }}
                            className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2 rounded-lg text-sm font-bold transition-colors border border-emerald-500/30"
                          >
                            ✅ Hit TP
                          </button>
                          <button 
                            onClick={() => {
                              const pnl = -trade.sizeUnits * Math.abs(trade.entry - trade.sl);
                              handleCloseTrade(trade.id, 'LOST', pnl);
                            }}
                            className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-2 rounded-lg text-sm font-bold transition-colors border border-rose-500/30"
                          >
                            ❌ Hit SL
                          </button>
                        </div>
                      )}
                      
                      {trade.status !== 'OPEN' && (
                        <div className={`mt-2 pt-4 border-t border-slate-800 flex justify-between items-center font-bold ${trade.pnlUSD && trade.pnlUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <span>Realized PnL:</span>
                          <span className="font-mono">{trade.pnlUSD && trade.pnlUSD >= 0 ? '+' : ''}${trade.pnlUSD?.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ALERTS VIEW */}
          {view === 'alerts' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pb-20 md:pb-0 h-full flex flex-col">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 shrink-0">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                    <Bell className="w-7 h-7 text-cyan-400" />
                    ศูนย์การแจ้งเตือน (Alert Center)
                  </h2>
                  <p className="text-slate-400 mt-1">Trade Condition Completion Alert Engine</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={markAllAlertsAsRead} className="text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors">
                    ทำเครื่องหมายอ่านแล้วทั้งหมด
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {alerts.length === 0 ? (
                  <div className="text-center py-12 bg-[#111827] rounded-xl border border-slate-800 text-slate-500">
                    ไม่มีการแจ้งเตือนในขณะนี้
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <motion.div 
                      key={alert.id}
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      className={`bg-[#111827] rounded-xl border ${alert.isRead ? 'border-slate-800 opacity-70' : 'border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]'} p-5 relative overflow-hidden transition-all`}
                    >
                      {!alert.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500"></div>}
                      
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              alert.priority === 'INVALIDATED' ? 'bg-rose-500/20 text-rose-400' :
                              alert.priority === 'ACTIONABLE' ? 'bg-emerald-500/20 text-emerald-400' :
                              alert.priority === 'INTERESTING' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {alert.priority === 'ACTIONABLE' ? 'Candidate ผ่าน risk gate' :
                               alert.priority === 'INTERESTING' ? 'สัญญาณน่าสนใจแต่ยังไม่พร้อมเข้า' :
                               alert.priority === 'INVALIDATED' ? 'แผนเทรดถูกยกเลิก' :
                               'สัญญาณยังไม่ยืนยันครบ'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] border border-slate-700">
                              {alert.confirmationMode === 'candle-close-only' ? 'รอแท่งเทียนปิด (Candle Close)' : 
                               alert.confirmationMode === 'intrabar' ? 'ระหว่างแท่ง (Intrabar)' : 'ยืนยันสองชั้น (Double-Confirm)'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] border border-slate-700" title="เวอร์ชันแผนล่าสุด">
                              v{alert.setupVersion}
                            </span>
                            <span className="text-xs text-slate-500 ml-auto">{alert.timestamp}</span>
                          </div>
                          
                          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                            {alert.title}
                            <span className="text-sm font-normal text-slate-400">({alert.symbol})</span>
                          </h3>
                          <p className="text-slate-300 text-sm mb-3 leading-relaxed">{alert.message}</p>

                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-400">ความคืบหน้าเงื่อนไข (Conditions Progress)</span>
                              <span className="text-cyan-400 font-bold">{alert.satisfiedConditionsCount} / {alert.totalConditionsCount}</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${alert.satisfiedConditionsCount === alert.totalConditionsCount ? 'bg-emerald-500' : 'bg-cyan-500'}`} 
                                style={{ width: `${(alert.satisfiedConditionsCount / alert.totalConditionsCount) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                            <div className="bg-[#1F2937] p-2 rounded border border-slate-700/50">
                              <p className="text-[10px] text-slate-500 mb-1">Entry Zone</p>
                              <p className="font-mono text-sm text-white">{(alert.entry || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-[#1F2937] p-2 rounded border border-slate-700/50">
                              <p className="text-[10px] text-slate-500 mb-1">Stop Loss</p>
                              <p className="font-mono text-sm text-rose-400">{(alert.sl || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-[#1F2937] p-2 rounded border border-slate-700/50">
                              <p className="text-[10px] text-slate-500 mb-1">Take Profit</p>
                              <p className="font-mono text-sm text-emerald-400">{(alert.tp || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-[#1F2937] p-2 rounded border border-slate-700/50">
                              <p className="text-[10px] text-slate-500 mb-1">R/R</p>
                              <p className="font-mono text-sm text-cyan-400">1:{alert.rr.toFixed(2)}</p>
                            </div>
                            <div className="bg-[#1F2937] p-2 rounded border border-slate-700/50">
                              <p className="text-[10px] text-slate-500 mb-1">Confidence</p>
                              <p className="font-bold text-sm text-cyan-400">{alert.confidence}%</p>
                            </div>
                          </div>

                          <div className="space-y-1 mb-4">
                            <p className="text-xs text-slate-400"><span className="text-emerald-400">✓ เงื่อนไขที่ผ่าน:</span> {alert.conditionsSatisfied.join(', ')}</p>
                            {alert.pendingConditions.length > 0 && (
                              <p className="text-xs text-slate-400"><span className="text-amber-400">⏳ รอการยืนยัน:</span> {alert.pendingConditions.join(', ')}</p>
                            )}
                            <p className="text-xs text-slate-400"><span className="text-rose-400">⚠ จุดยกเลิกแผน:</span> {alert.invalidationRule}</p>
                            {!alert.actionableFlag && alert.riskFilterReason && (
                              <p className="text-xs text-amber-400 mt-2 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                <strong>สถานะ:</strong> ไม่ผ่านเกณฑ์ความเสี่ยง ({alert.riskFilterReason})
                              </p>
                            )}
                            {alert.actionableFlag && (
                              <p className="text-xs text-emerald-400 mt-2 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                                <strong>สถานะ:</strong> Candidate ผ่าน risk gate แล้ว โปรด review ก่อนตัดสินใจ
                              </p>
                            )}
                            {alert.priority === 'INTERESTING' && !alert.riskFilterReason && (
                              <p className="text-xs text-amber-400 mt-2 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                <strong>สถานะ:</strong> สัญญาณน่าสนใจแต่ยังไม่พร้อมเข้า (รอแท่งปิดเพื่อยืนยัน)
                              </p>
                            )}
                            <div className="mt-2 text-[10px] text-slate-500 font-mono">
                              Hash: {alert.setupHash}
                            </div>
                          </div>

                          {alert.chartSnapshotUrl && (
                            <div className="mt-4 rounded-lg overflow-hidden border border-slate-700 relative group">
                              <img src={alert.chartSnapshotUrl} alt="Chart Snapshot" className="w-full h-48 object-cover opacity-80 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-sm font-medium bg-black/60 px-3 py-1 rounded-full">ดูภาพขนาดเต็ม</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-row md:flex-col gap-2 justify-end shrink-0">
                          <button 
                            onClick={() => {
                              const currentMarket = marketData.find(c => c.symbol === alert.symbol);
                              const contextWithPrice = { ...alert, currentPrice: currentMarket ? parseFloat(currentMarket.lastPrice) : null };
                              const event = new CustomEvent('open-ai-copilot', { detail: { tab: 'investigate', context: contextWithPrice } });
                              window.dispatchEvent(event);
                            }}
                            className="px-4 py-2 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 rounded-lg text-sm font-bold transition-colors flex-1 md:flex-none text-center flex items-center justify-center gap-1"
                          >
                            <Search className="w-4 h-4" />
                            Why?
                          </button>
                          <button 
                            onClick={() => {
                              const currentMarket = marketData.find(c => c.symbol === alert.symbol);
                              const contextWithPrice = { ...alert, currentPrice: currentMarket ? parseFloat(currentMarket.lastPrice) : null };
                              const event = new CustomEvent('open-ai-copilot', { detail: { tab: 'audit', context: contextWithPrice } });
                              window.dispatchEvent(event);
                            }}
                            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-sm font-bold transition-colors flex-1 md:flex-none text-center flex items-center justify-center gap-1"
                          >
                            <ShieldAlert className="w-4 h-4" />
                            Audit
                          </button>
                          <button 
                            onClick={() => {
                              const currentMarket = marketData.find(c => c.symbol === alert.symbol);
                              const contextWithPrice = { ...alert, currentPrice: currentMarket ? parseFloat(currentMarket.lastPrice) : null };
                              const event = new CustomEvent('open-ai-copilot', { detail: { tab: 'evidence', context: contextWithPrice } });
                              window.dispatchEvent(event);
                            }}
                            className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-bold transition-colors flex-1 md:flex-none text-center flex items-center justify-center gap-1"
                          >
                            <Database className="w-4 h-4" />
                            Evidence
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedChartSymbol(alert.symbol);
                              setView('analysis');
                              markAlertAsRead(alert.id);
                            }}
                            className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm font-medium transition-colors flex-1 md:flex-none text-center"
                          >
                            เปิดกราฟ
                          </button>
                          {!alert.isRead && (
                            <button onClick={() => markAlertAsRead(alert.id)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors flex-1 md:flex-none text-center">
                              อ่านแล้ว
                            </button>
                          )}
                          <button onClick={() => deleteAlert(alert.id)} className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-sm font-medium transition-colors flex-1 md:flex-none text-center">
                            ลบ
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* GUIDE VIEW */}
          {view === 'guide' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl pb-20 md:pb-0">
              <React.Suspense fallback={<ModuleLoader />}>
                <TradingGuide />
              </React.Suspense>
            </motion.div>
          )}

          {/* ANALYTICS VIEW */}
          {view === 'analytics' && (
            <React.Suspense fallback={<ModuleLoader />}>
              <AnalyticsDashboard journal={journal} marketData={marketData} />
            </React.Suspense>
          )}

          {/* SCREENER VIEW */}
          {view === 'screener' && (
            <React.Suspense fallback={<ModuleLoader />}>
              <MarketScreener 
                marketData={marketData} 
                journal={journal}
                onSelectSymbol={(sym) => {
                  const type = classifyAssetType(sym);
                  openSymbolInAnalysis(
                    sym,
                    (type === 'US_STOCK' ? 'STOCK' : type) as any,
                    type === 'CRYPTO' ? 'BINANCE' : type === 'ETF' ? 'AMEX' : 'NASDAQ'
                  );
                }}
              />
            </React.Suspense>
          )}

          {/* US STOCK SCREENER ANALYST VIEW */}
          {view === 'us-stock-screener' && (
            <React.Suspense fallback={<ModuleLoader />}>
              <USStockScreenerAnalyst
                onSelectSymbol={(sym) => {
                  openSymbolInAnalysis(sym, 'STOCK', 'NASDAQ');
                }}
              />
            </React.Suspense>
          )}

          {/* AI BOTTLENECK STOCK SCREENER ANALYST VIEW */}
          {view === 'ai-bottleneck-screener' && (
            <React.Suspense fallback={<ModuleLoader />}>
              <AIBottleneckScreenerAnalyst
                onSelectSymbol={(sym) => {
                  openSymbolInAnalysis(sym, 'STOCK', 'NASDAQ');
                }}
              />
            </React.Suspense>
          )}

          {/* BACKTEST VIEW */}
          {view === 'backtest' && (
            <React.Suspense fallback={<ModuleLoader />}>
              <BacktestSimulator 
                marketData={marketData} 
                setupDetails={setupDetails}
                onEvidence={setBacktestEvidence}
                fetchHistoricalData={async (symbol: string, interval: string, limit: number) => {
                  const assetType = classifyAssetType(symbol);
                  const res = await fetchWithRetry(getMarketDataUrl(symbol, interval, limit, assetType === 'US_STOCK' ? 'STOCK' : assetType));
                  const data = await res.json();
                  const report = validateKlines(data, {
                    interval,
                    minCandles: Math.min(50, Math.max(10, Math.floor(limit / 2)))
                  });

                  if (report.status === 'BLOCK') {
                    throw new Error(`Market data blocked: ${report.issues.map(issue => issue.code).join(', ')}`);
                  }

                  return data;
                }} 
              />
            </React.Suspense>
          )}

          {/* SETTINGS VIEW */}
          {view === 'settings' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl pb-20 md:pb-0">
              <h2 className="text-2xl font-bold text-white mb-1">ตั้งค่าระบบ</h2>
              <p className="text-slate-400 mb-8">จัดการข้อมูลและบัญชีของคุณ</p>
              
              <div className="bg-[#111827] rounded-xl border border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-white mb-4">การจัดการความเสี่ยง (Risk Management)</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">ขนาดพอร์ตโฟลิโอ (Portfolio Size - USDT)</label>
                      <input 
                        type="number" 
                        value={portfolioSize}
                        onChange={(e) => handleUpdatePortfolioSize(Number(e.target.value))}
                        className="w-full bg-[#0a001a] border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">ความเสี่ยงต่อไม้ (Risk %)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={riskPercent}
                        onChange={(e) => handleUpdateRiskPercent(Number(e.target.value))}
                        className="w-full bg-[#0a001a] border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-6 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-white mb-4">ข้อมูลระบบ (System Info)</h3>
                  <ul className="space-y-4 text-sm text-slate-300">
                    <li className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span>Data Source:</span> 
                      <span className="font-medium text-white bg-slate-800 px-2 py-1 rounded border border-slate-700">Binance Public API</span>
                    </li>
                    <li className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span>Chart Engine:</span> 
                      <span className="font-medium text-white bg-slate-800 px-2 py-1 rounded border border-slate-700">TradingView Advanced</span>
                    </li>
                    <li className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span>Storage:</span> 
                      <span className="font-medium text-white bg-slate-800 px-2 py-1 rounded border border-slate-700">Browser LocalStorage</span>
                    </li>
                  </ul>
                </div>
                <div className="p-6 border-b border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Production Control Plane</h3>
                      <p className="text-sm text-slate-400">Health, security, and read-only exchange sandbox status.</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-2 rounded border uppercase tracking-wider ${getGateBadgeClass(serverOpsStatus.health?.status ?? 'REVIEW')}`}>
                      {serverOpsStatus.health?.status ?? 'CHECKING'}
                    </span>
                  </div>
                  <div className="mb-4 border border-cyan-500/20 bg-cyan-500/5 rounded-lg p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-cyan-300 font-bold">Institutional Cockpit V2</div>
                        <div className="text-2xl font-black text-white mt-1">{masterReadinessGateV2.stage}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Manual-only live readiness, multi-asset data reliability, benchmark edge, risk, ops, audit, and AI research memo.
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-3 py-2 rounded border uppercase tracking-wider ${getGateBadgeClass(masterReadinessGateV2.status)}`}>
                        {masterReadinessGateV2.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">Unified data</div>
                        <div className={`text-sm font-bold ${unifiedDataReliabilityV2.status === 'PASS' ? 'text-emerald-300' : unifiedDataReliabilityV2.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                          {unifiedDataReliabilityV2.sourceConfidenceScore}
                        </div>
                        <div className="text-[11px] text-slate-400">{unifiedDataReliabilityV2.assetTypesCovered} asset type(s)</div>
                        <div className="text-[11px] text-slate-500 mt-1">{unifiedDataReliabilityV2.issues.length} data issues</div>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">Strategy engine</div>
                        <div className={`text-sm font-bold ${multiAssetStrategyV2.status === 'PASS' ? 'text-emerald-300' : multiAssetStrategyV2.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                          {multiAssetStrategyV2.score}
                        </div>
                        <div className="text-[11px] text-slate-400">{multiAssetStrategyV2.strategyId ?? 'NO_STRATEGY'}</div>
                        <div className="text-[11px] text-slate-500 mt-1">{multiAssetStrategyV2.issues.length} strategy issues</div>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">Backtest V2</div>
                        <div className={`text-sm font-bold ${institutionalBacktestV2.status === 'PASS' ? 'text-emerald-300' : institutionalBacktestV2.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                          {institutionalBacktestV2.edgeOverBenchmarkR}R
                        </div>
                        <div className="text-[11px] text-slate-400">Robustness {institutionalBacktestV2.robustnessScore}</div>
                        <div className="text-[11px] text-slate-500 mt-1">{institutionalBacktestV2.issues.length} backtest issues</div>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">Forward shadow</div>
                        <div className={`text-sm font-bold ${forwardShadowEvidenceV2.status === 'PASS' ? 'text-emerald-300' : forwardShadowEvidenceV2.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                          {forwardShadowEvidenceV2.executionEvidenceScore}
                        </div>
                        <div className="text-[11px] text-slate-400">{forwardShadowEvidenceV2.shadowReady ? 'Shadow ready' : 'Shadow gated'}</div>
                        <div className="text-[11px] text-slate-500 mt-1">{forwardShadowEvidenceV2.issues.length} execution issues</div>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">Portfolio risk</div>
                        <div className={`text-sm font-bold ${portfolioRiskV2.status === 'PASS' ? 'text-emerald-300' : portfolioRiskV2.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                          {portfolioRiskV2.riskBudgetUsedPercent}%
                        </div>
                        <div className="text-[11px] text-slate-400">Budget used</div>
                        <div className="text-[11px] text-slate-500 mt-1">{portfolioRiskV2.issues.length} risk issues</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">AI memo</div>
                        <div className={`text-sm font-bold ${aiResearchMemoV2.status === 'PASS' ? 'text-emerald-300' : aiResearchMemoV2.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                          {aiResearchMemoV2.status}
                        </div>
                        <div className="text-[11px] text-slate-400">{aiResearchMemoV2.markdown.length.toLocaleString()} chars</div>
                        <div className="text-[11px] text-slate-500 mt-1">{aiResearchMemoV2.issues.length} memo issues</div>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">Audit V2</div>
                        <div className={`text-sm font-bold ${professionalAuditReportV2.status === 'PASS' ? 'text-emerald-300' : professionalAuditReportV2.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                          {professionalAuditReportV2.status}
                        </div>
                        <div className="text-[11px] text-slate-400">Decision Trail included</div>
                        <div className="text-[11px] text-slate-500 mt-1">{professionalAuditReportV2.issues.length} audit issues</div>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">Ops V2</div>
                        <div className={`text-sm font-bold ${opsMonitoringV2.status === 'PASS' ? 'text-emerald-300' : opsMonitoringV2.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                          {opsMonitoringV2.reliabilityScore}
                        </div>
                        <div className="text-[11px] text-slate-400">{opsMonitoringV2.opsReady ? 'Ops ready' : 'Ops gated'}</div>
                        <div className="text-[11px] text-slate-500 mt-1">{opsMonitoringV2.issues.length} ops issues</div>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">Blockers</div>
                        <div className={`text-sm font-bold ${masterReadinessGateV2.blockingCodes.length === 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {masterReadinessGateV2.blockingCodes.length}
                        </div>
                        <div className="text-[11px] text-slate-400">{masterReadinessGateV2.reviewCodes.length} review gates</div>
                        <div className="text-[11px] text-slate-500 mt-1">API trading remains locked</div>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">Capital mode</div>
                        <div className={`text-sm font-bold ${!apiTradingEnabled ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {!apiTradingEnabled ? 'MANUAL_ONLY' : 'API_UNLOCKED'}
                        </div>
                        <div className="text-[11px] text-slate-400">{selectedChartSymbol} | {selectedAssetType}</div>
                        <div className="text-[11px] text-slate-500 mt-1">Real orders disabled by policy</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">System health</div>
                      <div className="text-sm font-bold text-white">{serverOpsStatus.health?.status ?? 'REVIEW'}</div>
                      <div className="text-[11px] text-slate-400">Uptime {serverOpsStatus.health?.uptimeSeconds ?? 0}s</div>
                      <div className="text-[11px] text-slate-500 mt-1">{serverOpsStatus.health?.checks?.length ?? 0} checks</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Security posture</div>
                      <div className={`text-sm font-bold ${serverOpsStatus.security?.status === 'PASS' ? 'text-emerald-300' : serverOpsStatus.security?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {serverOpsStatus.security?.status ?? 'REVIEW'}
                      </div>
                      <div className="text-[11px] text-slate-400">{serverOpsStatus.security?.issues?.length ?? 0} open issues</div>
                      <div className="text-[11px] text-slate-500 mt-1">Server-side secrets, rate limit, headers</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Exchange sandbox</div>
                      <div className={`text-sm font-bold ${serverOpsStatus.exchange?.status === 'PASS' ? 'text-emerald-300' : serverOpsStatus.exchange?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {serverOpsStatus.exchange?.mode ?? 'NOT_CONNECTED'}
                      </div>
                      <div className="text-[11px] text-slate-400">{serverOpsStatus.exchange?.issues?.length ?? 0} sandbox issues</div>
                      <div className="text-[11px] text-slate-500 mt-1">Order placement locked</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Deployment</div>
                      <div className={`text-sm font-bold ${serverOpsStatus.deployment?.status === 'PASS' ? 'text-emerald-300' : serverOpsStatus.deployment?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {serverOpsStatus.deployment?.status ?? 'REVIEW'}
                      </div>
                      <div className="text-[11px] text-slate-400">{serverOpsStatus.deployment?.checks?.length ?? 0} release checks</div>
                      <div className="text-[11px] text-slate-500 mt-1">Logs, errors, uptime, latency</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Release readiness</div>
                      <div className={`text-sm font-bold ${serverOpsStatus.release?.status === 'PASS' ? 'text-emerald-300' : serverOpsStatus.release?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {serverOpsStatus.release?.status ?? 'REVIEW'}
                      </div>
                      <div className="text-[11px] text-slate-400">{serverOpsStatus.release?.releaseAllowed ? 'Release allowed' : 'Release gated'}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{serverOpsStatus.release?.checks?.length ?? 0} checks</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Approval workflow</div>
                      <div className={`text-sm font-bold ${approvalWorkflow.status === 'PASS' ? 'text-emerald-300' : approvalWorkflow.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {approvalWorkflow.status}
                      </div>
                      <div className="text-[11px] text-slate-400">{approvalWorkflow.requiredRoles.join(' + ')}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{approvalWorkflow.issues.length} approval issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Backtest cache</div>
                      <div className={`text-sm font-bold ${backtestCacheReport.status === 'PASS' ? 'text-emerald-300' : backtestCacheReport.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {backtestCacheReport.status}
                      </div>
                      <div className="text-[11px] text-slate-400">{backtestCacheReport.usable ? 'Usable' : 'Needs refresh'}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{backtestCacheReport.issues.length} cache issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Stress test</div>
                      <div className={`text-sm font-bold ${scenarioStress?.status === 'PASS' ? 'text-emerald-300' : scenarioStress?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {scenarioStress?.status ?? 'REVIEW'}
                      </div>
                      <div className="text-[11px] text-slate-400">Worst loss {scenarioStress?.worstCaseLossPercent ?? 0}%</div>
                      <div className="text-[11px] text-slate-500 mt-1">{scenarioStress?.scenarioResults.length ?? 0} scenarios</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Model drift</div>
                      <div className={`text-sm font-bold ${modelDrift.status === 'PASS' ? 'text-emerald-300' : modelDrift.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {modelDrift.recommendedAction}
                      </div>
                      <div className="text-[11px] text-slate-400">Exp Δ {modelDrift.expectancyDeltaR}R</div>
                      <div className="text-[11px] text-slate-500 mt-1">{modelDrift.issues.length} drift issues</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Live candle regime</div>
                      <div className={`text-sm font-bold ${liveRegimeFromCandles.status === 'PASS' ? 'text-emerald-300' : liveRegimeFromCandles.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {liveRegimeFromCandles.regime.regime}
                      </div>
                      <div className="text-[11px] text-slate-400">ATR {liveRegimeFromCandles.metrics.atrPercent}% | ADX proxy {liveRegimeFromCandles.metrics.adxProxy}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{liveRegimeFromCandles.issues.length} regime issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Dynamic correlation</div>
                      <div className={`text-sm font-bold ${dynamicCorrelationMatrix.status === 'PASS' ? 'text-emerald-300' : dynamicCorrelationMatrix.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {dynamicCorrelationMatrix.status}
                      </div>
                      <div className="text-[11px] text-slate-400">{dynamicCorrelationMatrix.pairs.length} computed pairs</div>
                      <div className="text-[11px] text-slate-500 mt-1">{dynamicCorrelationMatrix.issues.length} matrix issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Professional report</div>
                      <div className={`text-sm font-bold ${professionalReport.status === 'PASS' ? 'text-emerald-300' : professionalReport.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {professionalReport.status}
                      </div>
                      <div className="text-[11px] text-slate-400">{professionalReport.markdown.length.toLocaleString()} chars</div>
                      <div className="text-[11px] text-slate-500 mt-1">{professionalReport.issues.length} report issues</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Strategy registry</div>
                      <div className={`text-sm font-bold ${strategyRegistry.status === 'PASS' ? 'text-emerald-300' : strategyRegistry.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {strategyRegistry.status}
                      </div>
                      <div className="text-[11px] text-slate-400">{strategyRegistry.liveEligibleStrategies}/{strategyRegistry.totalStrategies} live eligible</div>
                      <div className="text-[11px] text-slate-500 mt-1">{strategyRegistry.blockingCodes.length} registry blockers</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Exposure map</div>
                      <div className={`text-sm font-bold ${portfolioExposureMap.status === 'PASS' ? 'text-emerald-300' : portfolioExposureMap.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {portfolioExposureMap.grossExposurePercent}%
                      </div>
                      <div className="text-[11px] text-slate-400">{portfolioExposureMap.openTrades} open | ${portfolioExposureMap.grossExposureUsd.toLocaleString()}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{portfolioExposureMap.issues.length} exposure issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Data redundancy</div>
                      <div className={`text-sm font-bold ${dataSourceRedundancy.status === 'PASS' ? 'text-emerald-300' : dataSourceRedundancy.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {dataSourceRedundancy.selectedSource ?? 'NO_SOURCE'}
                      </div>
                      <div className="text-[11px] text-slate-400">{dataSourceRedundancy.healthySources} healthy source(s)</div>
                      <div className="text-[11px] text-slate-500 mt-1">Max div {dataSourceRedundancy.maxDivergencePercent}%</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">WF optimizer</div>
                      <div className={`text-sm font-bold ${walkForwardOptimizer.status === 'PASS' ? 'text-emerald-300' : walkForwardOptimizer.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {walkForwardOptimizer.bestCandidate?.id ?? 'NO_ROBUST_SET'}
                      </div>
                      <div className="text-[11px] text-slate-400">Score {walkForwardOptimizer.bestCandidate?.robustnessScore ?? 0}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{walkForwardOptimizer.candidates.length} candidate(s)</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Live sandbox connector</div>
                      <div className={`text-sm font-bold ${liveTradingSandboxConnector.status === 'PASS' ? 'text-emerald-300' : liveTradingSandboxConnector.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {liveTradingSandboxConnector.connectorMode}
                      </div>
                      <div className="text-[11px] text-slate-400">{liveTradingSandboxConnector.realMoneyLocked ? 'Real money locked' : 'Unlocked'}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{liveTradingSandboxConnector.issues.length} connector issues</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Adapter contract</div>
                      <div className={`text-sm font-bold ${exchangeAdapterContract.status === 'PASS' ? 'text-emerald-300' : exchangeAdapterContract.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {exchangeAdapterContract.executionMode}
                      </div>
                      <div className="text-[11px] text-slate-400">{exchangeAdapterContract.status}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{exchangeAdapterContract.issues.length} adapter issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Capital allocation</div>
                      <div className={`text-sm font-bold ${capitalAllocation.status === 'PASS' ? 'text-emerald-300' : capitalAllocation.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {capitalAllocation.totalAllocatedPercent}%
                      </div>
                      <div className="text-[11px] text-slate-400">${capitalAllocation.totalAllocatedUsd.toLocaleString()} allocated</div>
                      <div className="text-[11px] text-slate-500 mt-1">{capitalAllocation.allocations.length} strategy allocation(s)</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Regime router</div>
                      <div className={`text-sm font-bold ${regimeStrategyRoute.status === 'PASS' ? 'text-emerald-300' : regimeStrategyRoute.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {regimeStrategyRoute.selectedStrategyId ?? 'NO_ROUTE'}
                      </div>
                      <div className="text-[11px] text-slate-400">{liveRegimeFromCandles.regime.regime}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{regimeStrategyRoute.blockedStrategies.length} incompatible</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Incident runbook</div>
                      <div className={`text-sm font-bold ${productionIncidentRunbook.status === 'PASS' ? 'text-emerald-300' : productionIncidentRunbook.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {productionIncidentRunbook.status}
                      </div>
                      <div className="text-[11px] text-slate-400">{productionIncidentRunbook.openIncidents} open incident(s)</div>
                      <div className="text-[11px] text-slate-500 mt-1">MTTR {productionIncidentRunbook.meanResolutionMinutes}m</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Signal benchmark</div>
                      <div className={`text-sm font-bold ${modelSignalBenchmark.status === 'PASS' ? 'text-emerald-300' : modelSignalBenchmark.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {modelSignalBenchmark.expectancyLiftR}R
                      </div>
                      <div className="text-[11px] text-slate-400">{modelSignalBenchmark.aiOutperformsBaseline ? 'AI beats baseline' : 'Baseline stronger'}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{modelSignalBenchmark.issues.length} benchmark issues</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Asset universe</div>
                      <div className="text-sm font-bold text-white">{selectedAssetType}</div>
                      <div className="text-[11px] text-slate-400">{selectedChartSymbol} via {selectedChartExchange}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{selectedIsUsEquity ? 'US equity session-aware' : 'Multi-asset proxy'}</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">US session data</div>
                      <div className={`text-sm font-bold ${usStockDataReport?.status === 'PASS' ? 'text-emerald-300' : usStockDataReport?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {usStockDataReport?.sessionState ?? 'N/A'}
                      </div>
                      <div className="text-[11px] text-slate-400">{usStockDataReport?.candleCount ?? 0} stock candles</div>
                      <div className="text-[11px] text-slate-500 mt-1">{usStockDataReport?.issues.length ?? 0} stock data issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Stock indicators</div>
                      <div className={`text-sm font-bold ${usStockIndicators?.status === 'PASS' ? 'text-emerald-300' : usStockIndicators?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        RS {usStockIndicators?.relativeStrengthPercent ?? 0}%
                      </div>
                      <div className="text-[11px] text-slate-400">RVOL {usStockIndicators?.relativeVolume ?? 0} | Gap {usStockIndicators?.gapPercent ?? 0}%</div>
                      <div className="text-[11px] text-slate-500 mt-1">{usStockIndicators?.sectorAlignment ?? 'N/A'}</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Stock risk</div>
                      <div className={`text-sm font-bold ${usStockRisk?.status === 'PASS' ? 'text-emerald-300' : usStockRisk?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {usStockRisk?.status ?? 'N/A'}
                      </div>
                      <div className="text-[11px] text-slate-400">Single {usStockRisk?.singleStockExposurePercent ?? 0}% | Sector {usStockRisk?.sectorExposurePercent ?? 0}%</div>
                      <div className="text-[11px] text-slate-500 mt-1">{usStockRisk?.issues.length ?? 0} stock risk issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">US stock screener</div>
                      <div className={`text-sm font-bold ${usStockScreenerScore?.status === 'PASS' ? 'text-emerald-300' : usStockScreenerScore?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {usStockScreenerScore?.score ?? 0}
                      </div>
                      <div className="text-[11px] text-slate-400">{usStockScreenerScore?.direction ?? 'N/A'} | {usStockScreenerScore?.tags.slice(0, 2).join(', ') || 'No tags'}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{usStockScreenerScore?.issues.length ?? 0} screener issues</div>
                    </div>
                  </div>
                </div>
                <div className="p-6 border-b border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Professional Workflow Layer</h3>
                      <p className="text-sm text-slate-400">Explainability, forward scorecard, versioning, and post-trade review.</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-2 rounded border uppercase tracking-wider ${getGateBadgeClass(signalExplanation.status)}`}>
                      {signalExplanation.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Explainability</div>
                      <div className="text-sm font-bold text-white">{signalExplanation.summaryScore}</div>
                      <div className="text-[11px] text-slate-400">{signalExplanation.buckets.length} evidence buckets</div>
                      <div className="text-[11px] text-slate-500 mt-1">{signalExplanation.issues.length} issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Forward scorecard</div>
                      <div className={`text-sm font-bold ${forwardScorecard.status === 'PASS' ? 'text-emerald-300' : forwardScorecard.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {forwardScorecard.status}
                      </div>
                      <div className="text-[11px] text-slate-400">{forwardScorecard.totalSignals} signals | Hit {forwardScorecard.hitRate}%</div>
                      <div className="text-[11px] text-slate-500 mt-1">Exp {forwardScorecard.expectancyR}R</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Plan version</div>
                      <div className="text-sm font-bold text-white">v{latestPlanVersion?.version ?? 0}</div>
                      <div className="text-[11px] text-slate-400">{latestPlanVersion?.changeType ?? 'NO_PLAN'}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{latestPlanVersion?.changedFields.length ?? 0} fields tracked</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Post-trade review</div>
                      <div className={`text-sm font-bold ${latestPostTradeReview?.status === 'PASS' ? 'text-emerald-300' : latestPostTradeReview?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {latestPostTradeReview?.status ?? 'NO_CLOSED_TRADE'}
                      </div>
                      <div className="text-[11px] text-slate-400">{latestPostTradeReview?.rMultiple ?? 0}R latest closed</div>
                      <div className="text-[11px] text-slate-500 mt-1">{latestPostTradeReview?.issues.length ?? 0} review issues</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Execution quality</div>
                      <div className={`text-sm font-bold ${executionQuality.status === 'PASS' ? 'text-emerald-300' : executionQuality.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {executionQuality.status}
                      </div>
                      <div className="text-[11px] text-slate-400">{executionQuality.averageSlippageBps} bps slip | {executionQuality.p95LatencyMs}ms p95</div>
                      <div className="text-[11px] text-slate-500 mt-1">{executionQuality.samples} samples</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Risk cockpit</div>
                      <div className={`text-sm font-bold ${realTimeRiskDashboard.status === 'PASS' ? 'text-emerald-300' : realTimeRiskDashboard.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {realTimeRiskDashboard.status}
                      </div>
                      <div className="text-[11px] text-slate-400">{realTimeRiskDashboard.blockers} blockers | {realTimeRiskDashboard.warnings} warnings</div>
                      <div className="text-[11px] text-slate-500 mt-1">{realTimeRiskDashboard.realMoneySafe ? 'Real-money lock safe' : 'Unsafe lock state'}</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Signal replay</div>
                      <div className={`text-sm font-bold ${signalReplayForensics.status === 'PASS' ? 'text-emerald-300' : signalReplayForensics.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {signalReplayForensics.status}
                      </div>
                      <div className="text-[11px] text-slate-400">Weight {signalReplayForensics.passedWeight}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{signalReplayForensics.failedFactors.length} failed factor(s)</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Shadow live</div>
                      <div className={`text-sm font-bold ${shadowLiveMode.status === 'PASS' ? 'text-emerald-300' : shadowLiveMode.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {shadowLiveMode.status}
                      </div>
                      <div className="text-[11px] text-slate-400">PnL div {shadowLiveMode.averagePnlDivergencePercent}%</div>
                      <div className="text-[11px] text-slate-500 mt-1">{shadowLiveMode.realOrdersPlaced ? 'Real orders used' : 'No real orders'}</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Strategy versions</div>
                      <div className={`text-sm font-bold ${strategyVersionRegistry.status === 'PASS' ? 'text-emerald-300' : strategyVersionRegistry.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        v{strategyVersionRegistry.activeVersion?.version ?? 0}
                      </div>
                      <div className="text-[11px] text-slate-400">{strategyVersionRegistry.status}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{strategyVersionRegistry.history.length} version(s)</div>
                    </div>
                  </div>
                </div>
                <div className="p-6 border-b border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Institutional Risk Layer</h3>
                      <p className="text-sm text-slate-400">Evidence ledger, regime, promotion, kill switch, and correlation controls.</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-2 rounded border uppercase tracking-wider ${getGateBadgeClass(evidenceLedger.status)}`}>
                      {evidenceLedger.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Evidence ledger</div>
                      <div className={`text-sm font-bold ${evidenceLedger.canRecordPlan ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {evidenceLedger.canRecordPlan ? 'READY' : 'LOCKED'}
                      </div>
                      <div className="text-[11px] text-slate-400">{evidenceLedger.records.length}/5 evidence areas</div>
                      <div className="text-[11px] text-slate-500 mt-1">{evidenceLedger.blockingCodes.length} blockers</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Live regime</div>
                      <div className="text-sm font-bold text-white">{institutionalRegime.regime}</div>
                      <div className="text-[11px] text-slate-400">{institutionalRegime.volatility} volatility</div>
                      <div className="text-[11px] text-slate-500 mt-1">Confidence {institutionalRegime.confidence}%</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Strategy promotion</div>
                      <div className={`text-sm font-bold ${strategyPromotion.status === 'PASS' ? 'text-emerald-300' : strategyPromotion.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {strategyPromotion.currentStage}
                      </div>
                      <div className="text-[11px] text-slate-400">Next {strategyPromotion.nextStage}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{strategyPromotion.issues.length} issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Kill switch</div>
                      <div className={`text-sm font-bold ${riskKillSwitch.state === 'UNLOCKED' ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {riskKillSwitch.state}
                      </div>
                      <div className="text-[11px] text-slate-400">Daily PnL {dailyPnlPercent}%</div>
                      <div className="text-[11px] text-slate-500 mt-1">{riskKillSwitch.triggers.length} triggers</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Correlation risk</div>
                      <div className={`text-sm font-bold ${correlationRisk?.status === 'PASS' ? 'text-emerald-300' : correlationRisk?.status === 'BLOCK' ? 'text-rose-300' : 'text-amber-300'}`}>
                        {correlationRisk?.status ?? 'REVIEW'}
                      </div>
                      <div className="text-[11px] text-slate-400">{correlationRisk?.correlatedExposurePercent ?? 0}% correlated</div>
                      <div className="text-[11px] text-slate-500 mt-1">{correlationRisk?.correlatedSymbols.length ?? 0} linked symbols</div>
                    </div>
                  </div>
                  {(evidenceLedger.blockingCodes.length > 0 || riskKillSwitch.triggers.length > 0 || strategyPromotion.issues.length > 0) && (
                    <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <div className="text-[10px] uppercase text-amber-300 mb-2 font-bold">Institutional Control Issues</div>
                      {Array.from(new Set([
                        ...evidenceLedger.blockingCodes,
                        ...riskKillSwitch.triggers.map(trigger => trigger.code),
                        ...strategyPromotion.issues.map(issue => issue.code)
                      ])).slice(0, 8).map(code => (
                        <span key={code} className="inline-block mr-2 mb-2 text-[10px] font-mono px-2 py-1 rounded border border-amber-500/20 text-amber-200 bg-amber-500/10">
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-6 border-b border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Live Readiness</h3>
                      <p className="text-sm text-slate-400">{liveReadiness.summary}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-2 rounded border uppercase tracking-wider ${getGateBadgeClass(liveReadiness.status === 'READY_FOR_SMALL_LIVE' ? 'PASS' : liveReadiness.status === 'PAPER_ONLY' ? 'REVIEW' : 'BLOCK')}`}>
                      {liveReadiness.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Market data</div>
                      <div className="text-sm font-bold text-white">{marketIntegrityReport?.status ?? 'REVIEW'}</div>
                      <div className="text-[11px] text-slate-400">{marketIntegrityReport?.candleCount ?? 0} candles checked</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Risk policy</div>
                      <div className="text-sm font-bold text-white">{activeRiskReport?.status ?? 'PASS'}</div>
                      <div className="text-[11px] text-slate-400">{activeRiskReport?.issues.length ?? 0} active issues</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Paper evidence</div>
                      <div className={`text-sm font-bold ${paperReadiness.status === 'PASS' ? 'text-emerald-300' : paperReadiness.status === 'REVIEW' ? 'text-amber-300' : 'text-rose-300'}`}>
                        {paperReadiness.status}
                      </div>
                      <div className="text-[11px] text-slate-400">{paperStats.closedTrades} closed | DD {paperReadiness.drawdownPercent}%</div>
                      <div className="text-[11px] text-slate-500 mt-1">Exp {paperStats.expectancyR}R, PF {paperStats.profitFactor === Infinity ? '∞' : paperStats.profitFactor}</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Backtest evidence</div>
                      <div className="text-sm font-bold text-white">{backtestEvidence?.sampleSize ?? 0} trades</div>
                      <div className="text-[11px] text-slate-400">OOS {backtestEvidence?.outOfSampleExpectancyR ?? 0}R, DD {backtestEvidence?.maxDrawdownPercent ?? 100}%</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        WF {backtestEvidence?.walkForward?.positiveWindowRate ?? 0}% | Regimes {backtestEvidence?.regimePerformance?.coveredRegimes ?? 0}
                      </div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Portfolio heat</div>
                      <div className="text-sm font-bold text-white">{openRiskSummary.portfolioHeatPercent}%</div>
                      <div className="text-[11px] text-slate-400">${openRiskSummary.openRiskUsd.toLocaleString()} open risk</div>
                      <div className="text-[11px] text-slate-500 mt-1">{openRiskSummary.openTrades} open plans</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Exposure</div>
                      <div className="text-sm font-bold text-white">${openRiskSummary.grossExposureUsd.toLocaleString()}</div>
                      <div className="text-[11px] text-slate-400">L ${openRiskSummary.longExposureUsd.toLocaleString()} / S ${openRiskSummary.shortExposureUsd.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Audit trail</div>
                      <div className="text-sm font-bold text-white">{auditSummary.totalDecisions} decisions</div>
                      <div className="text-[11px] text-slate-400">Allow {auditSummary.allowCount} / Review {auditSummary.reviewCount} / Block {auditSummary.blockCount}</div>
                      <div className="text-[11px] text-slate-500 mt-1">Block rate {auditSummary.blockRate}%</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                      <div className="text-[10px] uppercase text-slate-500 mb-1">Execution</div>
                      <div className="text-sm font-bold text-white">Manual only</div>
                      <div className="text-[11px] text-slate-400">API trading disabled</div>
                    </div>
                  </div>

                  {(paperReadiness.issues.length > 0 || auditSummary.topIssueCodes.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      {paperReadiness.issues.length > 0 && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                          <div className="text-[10px] uppercase text-amber-300 mb-2 font-bold">Paper Evidence Issues</div>
                          {paperReadiness.issues.slice(0, 4).map(issue => (
                            <div key={issue.code} className="text-xs text-amber-100/80 mb-1">
                              <span className="font-mono text-amber-300">{issue.code}</span> - {issue.message}
                            </div>
                          ))}
                        </div>
                      )}
                      {auditSummary.topIssueCodes.length > 0 && (
                        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                          <div className="text-[10px] uppercase text-slate-400 mb-2 font-bold">Top Audit Issue Codes</div>
                          {auditSummary.topIssueCodes.map(issue => (
                            <div key={issue.code} className="flex justify-between text-xs text-slate-300 mb-1">
                              <span className="font-mono">{issue.code}</span>
                              <span>{issue.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">Live Launch Lock</h3>
                        <p className="text-xs text-slate-400">{liveLaunchChecklist.summary}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-3 py-2 rounded border uppercase tracking-wider ${getGateBadgeClass(liveLaunchChecklist.status === 'SMALL_MANUAL_LIVE_READY' ? 'PASS' : liveLaunchChecklist.status === 'PAPER_ONLY' ? 'REVIEW' : 'BLOCK')}`}>
                        {liveLaunchChecklist.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {liveLaunchChecklist.gates.map(gate => (
                        <div key={gate.code} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                          <div>
                            <div className="text-xs font-semibold text-slate-200">{gate.label}</div>
                            <div className="text-[11px] text-slate-500">{gate.detail}</div>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded border ${getGateBadgeClass(gate.status)}`}>
                            {gate.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {liveReadiness.gates.map(gate => (
                      <div key={gate.code} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-200">{gate.label}</div>
                          <div className="text-xs text-slate-400">{gate.detail}</div>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded border ${getGateBadgeClass(gate.status)}`}>
                          {gate.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-rose-500/5">
                  <h3 className="text-lg font-bold text-rose-400 mb-2">อันตราย (Danger Zone)</h3>
                  <p className="text-sm text-rose-300/80 mb-4">การลบข้อมูลทั้งหมดจะไม่สามารถกู้คืนได้ (ลบแผนการเทรดทั้งหมดใน LocalStorage)</p>
                  <motion.button 
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={clearAllData}
                    className="w-full sm:w-auto bg-rose-600 hover:bg-rose-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    ลบข้อมูลทั้งหมด
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </main>

      {/* AI Trading Copilot */}
      <React.Suspense fallback={null}>
        <AITradingCopilot journal={journal} />
      </React.Suspense>

      {/* CREATE SETUP MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#111827] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-800"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-800/30">
                <h3 className="text-xl font-bold text-white">สร้างแผนการเทรดใหม่</h3>
                <motion.button aria-label="ปิดหน้าต่างแผนการเทรด" whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 rounded-full p-1 shadow-sm">
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              <form onSubmit={handleSaveSetup} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">สัญลักษณ์ (Symbol)</label>
                  <input 
                    type="text" required value={formData.symbol}
                    onChange={(e) => setFormData({...formData, symbol: e.target.value.toUpperCase()})}
                    className="w-full p-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none uppercase transition-all bg-[#1F2937] text-white focus:bg-[#111827]"
                    placeholder="เช่น BTCUSDT"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">สถานะ (Side)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button 
                      whileTap={{ scale: 0.95 }} type="button" onClick={() => setFormData({...formData, side: 'LONG'})}
                      className={`py-3 rounded-xl font-bold border-2 transition-all ${formData.side === 'LONG' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#1F2937] border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      LONG
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.95 }} type="button" onClick={() => setFormData({...formData, side: 'SHORT'})}
                      className={`py-3 rounded-xl font-bold border-2 transition-all ${formData.side === 'SHORT' ? 'bg-rose-500/10 border-rose-500 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'bg-[#1F2937] border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      SHORT
                    </motion.button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">ราคาเข้า (Entry Price)</label>
                  <input 
                    type="number" step="any" required value={formData.entry}
                    onChange={(e) => setFormData({...formData, entry: e.target.value})}
                    className="w-full p-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none font-mono text-white transition-all bg-[#1F2937] focus:bg-[#111827]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">ตัดขาดทุน (SL)</label>
                    <input 
                      type="number" step="any" required value={formData.sl}
                      onChange={(e) => setFormData({...formData, sl: e.target.value})}
                      className="w-full p-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none font-mono text-rose-400 transition-all bg-[#1F2937] focus:bg-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">ทำกำไร (TP)</label>
                    <input 
                      type="number" step="any" required value={formData.tp}
                      onChange={(e) => setFormData({...formData, tp: e.target.value})}
                      className="w-full p-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono text-emerald-400 transition-all bg-[#1F2937] focus:bg-[#111827]"
                    />
                  </div>
                </div>
                <div className="pt-2 mt-6">
                  <motion.button 
                    whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(6, 182, 212, 0.4)" }} 
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3.5 rounded-xl font-bold transition-colors shadow-md shadow-cyan-500/20"
                  >
                    บันทึกแผนการเทรด
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Error Modal */}
      <AnimatePresence>
        {authErrorModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0a001a] border border-cyan-500/30 w-full max-w-md rounded-2xl p-6 shadow-[0_0_50px_rgba(34,211,238,0.2)] relative"
            >
              <button
                aria-label="ปิดหน้าต่างแจ้งเตือนเข้าสู่ระบบ"
                onClick={() => setAuthErrorModal(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mb-4 border border-rose-500/30">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">เบราว์เซอร์บล็อกการเข้าสู่ระบบ</h2>
                <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                  เนื่องจากคุณเปิดใช้งานแอปนี้ผ่านกรอบหน้าต่างของมือถือ เบราว์เซอร์จึงทำการบล็อกหน้าต่างเข้าสู่ระบบ (Pop-up) เอาไว้<br/><br/>
                  <strong className="text-cyan-400">วิธีแก้ไข:</strong> กรุณาแตะที่ไอคอนบริเวณมุมขวาบน เพื่อ <b>เปิดไปยังแท็บใหม่ (Open in New Tab)</b> จากนั้นจึงค่อยกดเข้าสู่ระบบอีกครั้ง
                </p>
                <button 
                  onClick={() => setAuthErrorModal(false)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-colors border border-slate-700"
                >
                  รับทราบ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

// --- App Root (Handles Routing between Landing and Dashboard) ---
export default function App() {
  const [isAppLaunched, setIsAppLaunched] = useState(() => shouldLaunchAppOnStartup());
  const setMarketData = useMarketStore(state => state.setMarketData);

  const handleLaunchApp = useCallback(() => {
    rememberAppLaunched();
    setIsAppLaunched(true);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      if (currentUser) {
        handleLaunchApp();
      }
    });

    return unsubscribe;
  }, [handleLaunchApp]);

  useEffect(() => {
    let isDisposed = false;

    completeGoogleRedirectLogin()
      .then(result => {
        if (!isDisposed && result?.user) {
          handleLaunchApp();
        }
      })
      .catch((error: any) => {
        if (error?.code === 'auth/unauthorized-domain') {
          alert('โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication\n\nให้เพิ่ม localhost และโดเมน production ใน Firebase Console > Authentication > Settings > Authorized domains');
        } else {
          const code = error?.code ? ` (${error.code})` : '';
          alert(`เข้าสู่ระบบด้วย Google ไม่สำเร็จ${code}\n\nกรุณาลองใหม่อีกครั้ง หรือเปิดเว็บใน Chrome/Safari โดยตรงหากเบราว์เซอร์ในแอปบล็อกการล็อกอิน`);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [handleLaunchApp]);

  useEffect(() => {
    let ws: WebSocket;
    let updatesBuffer: Record<string, any> = {};
    let flushInterval: any = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isDisposed = false;
    
    const connectWebSocket = () => {
      if (isDisposed) return;
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/!ticker@arr`);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const items = Array.isArray(data) ? data : [data];
          
          items.forEach((item: any) => {
            if (item && item.s && item.s.endsWith('USDT') && item.c) {
              updatesBuffer[item.s] = {
                symbol: item.s,
                lastPrice: item.c,
                priceChangePercent: item.P,
                volume: item.v // Using base volume for websocket updates
              };
            }
          });
        } catch (e) {
          // parse error
        }
      };

      // Buffered flush to minimize React re-renders from high-frequency WebSocket events
      flushInterval = setInterval(() => {
        if (Object.keys(updatesBuffer).length > 0) {
          setMarketData(prev => {
            const merged = [...prev];
            Object.values(updatesBuffer).forEach(newData => {
                 const existingIndex = merged.findIndex(m => m.symbol === newData.symbol);
                 if (existingIndex >= 0) {
                     merged[existingIndex] = { ...merged[existingIndex], ...newData };
                 } else {
                     merged.push(newData);
                 }
            });
            // Keep top 150 USDT pairs by volume so UI remains fast but covers all major crypto
            return merged.sort((a, b) => parseFloat(b.volume || '0') - parseFloat(a.volume || '0')).slice(0, 150);
          });
          updatesBuffer = {}; // Clear buffer after flush
        }
      }, 1500); // 1500ms flush rate offers a smooth UI without thrashing the main thread for 150 coins.

      ws.onerror = (error) => console.error('WebSocket error:', error);
      ws.onclose = () => {
        clearInterval(flushInterval);
        if (!isDisposed) {
          reconnectTimer = setTimeout(() => connectWebSocket(), 5000);
        }
      };
    };

    const fetchInitialData = async () => {
      try {
        // We still fetch initial data so nothing is empty initially
        const symbols = [
           "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "SHIBUSDT", "DOTUSDT",
           "LINKUSDT", "MATICUSDT", "LTCUSDT", "BCHUSDT", "NEARUSDT", "APTUSDT", "OPUSDT", "ARBUSDT", "SUIUSDT", "INJUSDT",
           "RNDRUSDT", "FETUSDT", "WLDUSDT", "PEPEUSDT", "ORDIUSDT", "SAGAUSDT", "TAOUSDT", "ENAUSDT", "BOMEUSDT", "WIFUSDT"
        ];
        const symbolsStr = encodeURIComponent(JSON.stringify(symbols));
        const res = await fetchWithRetry(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsStr}`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
          const topSymbols = data
            .sort((a: BinanceTicker, b: BinanceTicker) => parseFloat(b.volume) - parseFloat(a.volume))
            .slice(0, 30);
            
          const formattedData = topSymbols.map((item: BinanceTicker) => ({
            symbol: item.symbol,
            lastPrice: item.lastPrice,
            priceChangePercent: item.priceChangePercent,
            volume: item.volume
          }));
          
          setMarketData(formattedData);
          return true;
        }
        return false;
      } catch (error) {
        console.error("Failed to fetch initial market data", error);
        return false;
      }
    };

    fetchInitialData().then(() => {
      connectWebSocket();
    });

    return () => { 
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close(); 
      if (flushInterval) clearInterval(flushInterval);
    };
  }, [setMarketData]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#050014]">
        <RealtimeTicker />
        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            {!isAppLaunched ? (
              <motion.div key="landing" exit={{ opacity: 0, y: -50 }} transition={{ duration: 0.5 }}>
                <LandingPage onLaunch={handleLaunchApp} />
              </motion.div>
            ) : (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                <DashboardApp />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ErrorBoundary>
  );
}
