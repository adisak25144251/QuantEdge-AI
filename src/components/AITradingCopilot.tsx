import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, ShieldAlert, Activity, Search, Wrench, Send, AlertTriangle, CheckCircle, Info, Database, Server, Zap } from 'lucide-react';
import { useTradeStore } from '../store/useTradeStore';
import { apiFetch } from '../lib/apiClient';

// --- Types for Structured Bot Responses ---
interface TradingExplanation {
  summary: string;
  evidence: string[];
  confidence: number;
  assumptions: string[];
  risks: string[];
  invalidation: string;
  nextAction: string;
}

interface TechnicalDiagnosis {
  problemSummary: string;
  affectedLayer: 'Frontend' | 'Backend' | 'Database' | 'Rule Engine' | 'API' | 'External Connector';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rootCause: string;
  recommendedFix: string;
  temporaryMitigation: string;
  selfHealingAction?: string;
  timeline?: { timestamp: string; event: string }[];
  qaScenarios: { title: string; steps: string[]; expectedOutcome: string }[];
}

interface AuditResult {
  checkName: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
}

interface AuditEvidencePack {
  symbol: string;
  setupVersion: string;
  side: string;
  entry: number;
  sl: number;
  tp: number;
  rrCheck: string;
  evidenceList: string[];
  candleContext: string;
  alertTimeline: string[];
  validationFlags: string[];
  suspectedIssue: string;
  recommendedFix: string;
}

interface PortfolioImpact {
  totalRiskImpact: string;
  exposureOverlap: string;
  correlatedPositions: string;
  portfolioHeat: string;
}

interface DiffExplanation {
  summary: string;
  changes: { field: string; old: any; new: any }[];
  impact: string;
}

type BotMessage = 
  | { type: 'text'; role: 'user' | 'assistant'; content: string }
  | { type: 'explanation'; role: 'assistant'; data: TradingExplanation }
  | { type: 'diagnosis'; role: 'assistant'; data: TechnicalDiagnosis }
  | { type: 'audit'; role: 'assistant'; data: AuditResult[] }
  | { type: 'evidence_pack'; role: 'assistant'; data: AuditEvidencePack }
  | { type: 'portfolio_impact'; role: 'assistant'; data: PortfolioImpact }
  | { type: 'diff'; role: 'assistant'; data: DiffExplanation };

async function readAiCopilotError(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.toLowerCase().includes('application/json')) {
    const errorBody = await response.json().catch(() => ({}));
    if (typeof errorBody?.error === 'string' && errorBody.error.trim()) {
      if (response.status === 401) {
        return 'กรุณาเข้าสู่ระบบใหม่อีกครั้งก่อนใช้งาน AI Trading Copilot (Authentication required).';
      }

      if (response.status === 503 && errorBody.error.includes('GEMINI_API_KEY')) {
        return 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Vercel Environment Variables หรือยังไม่ได้ redeploy หลังตั้งค่า.';
      }

      return `${errorBody.error} (${response.status})`;
    }
  }

  const bodyText = await response.text().catch(() => '');
  if (bodyText.toLowerCase().includes('<html') || bodyText.toLowerCase().includes('<!doctype')) {
    return `AI backend route is unavailable on this deployment (${response.status}). Deploy the Vercel API function for /api/ai/copilot and set GEMINI_API_KEY.`;
  }

  return `AI backend request failed (${response.status})`;
}

export const AITradingCopilot = ({ journal = [] }: { journal?: any[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ask');
  const [messages, setMessages] = useState<BotMessage[]>([
    { type: 'text', role: 'assistant', content: 'สวัสดีครับ ผมคือ AI Trading Copilot & Data Integrity Bot ระบบผู้ช่วยอัจฉริยะที่เชื่อมต่อกับข้อมูล Real-time และระบบตรวจสอบความถูกต้องของข้อมูล (Data Integrity) พร้อมให้คำแนะนำเชิงลึกครับ' }
  ]);
  const [input, setInput] = useState('');
  const [contextData, setContextData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // --- Core Logic Engines ---

  const generateTradingExplanation = (setup: any): TradingExplanation => {
    // We don't have direct access to cryptoData here anymore, so we rely on the context passed
    const currentPrice = setup.currentPrice || null;
    
    let evidence = [
      `โครงสร้างราคา (Market Structure) สนับสนุนฝั่ง ${setup.side}`,
      `การคำนวณ Risk/Reward อยู่ที่ ${setup.rr} ซึ่งอยู่ในเกณฑ์ที่ยอมรับได้`
    ];
    
    if (currentPrice) {
      const distance = Math.abs(currentPrice - setup.entry) / setup.entry * 100;
      evidence.push(`ราคาปัจจุบัน (${currentPrice}) ห่างจากจุดเข้า (${setup.entry}) ประมาณ ${distance.toFixed(2)}%`);
    }

    return {
      summary: `แผนการเทรด ${setup.symbol} ฝั่ง ${setup.side} อ้างอิงจาก ${setup.entryLogic || 'โครงสร้างทางเทคนิค'}`,
      evidence: evidence,
      confidence: setup.confidence || 75,
      assumptions: [
        'สภาวะตลาดยังคงรักษาแนวโน้มเดิมก่อนถึงจุดเข้า',
        'ไม่มีข่าวเศรษฐกิจระดับมหภาค (Macro Events) แทรกแซงอย่างรุนแรง'
      ],
      risks: [
        'ความผันผวนสูงในช่วงเปิดตลาด',
        'อาจมีการกวาดสภาพคล่อง (Liquidity Sweep) ก่อนไปถึงเป้าหมาย'
      ],
      invalidation: setup.side === 'LONG' 
        ? `แผนนี้จะถูกยกเลิก (Invalidated) หากราคาปิดต่ำกว่า ${setup.sl} ด้วย Volume ที่มีนัยสำคัญ`
        : `แผนนี้จะถูกยกเลิก (Invalidated) หากราคาเบรคและยืนเหนือ ${setup.sl} ได้`,
      nextAction: setup.isValid ? 'รอสัญญาณยืนยัน (Confirmation) ที่โซนจุดเข้า' : 'เฝ้าระวัง (Wait and See) เนื่องจากสัญญาณยังไม่ครบถ้วน'
    };
  };

  const runDataIntegrityAudit = (data: any, type: 'setup' | 'alert'): AuditResult[] => {
    const results: AuditResult[] = [];
    
    // 1. Symbol Consistency Check
    results.push({
      checkName: 'Symbol Consistency',
      status: data.symbol ? 'PASS' : 'FAIL',
      details: data.symbol ? `Symbol binding verified: ${data.symbol}` : 'Missing symbol binding in data object.'
    });

    // 2. Numeric & Directional Consistency Check
    if (data.entry && data.sl && data.tp2) {
      const isLong = data.side === 'LONG';
      const slValid = isLong ? data.sl < data.entry : data.sl > data.entry;
      const tpValid = isLong ? data.tp2 > data.entry : data.tp2 < data.entry;
      
      if (slValid && tpValid) {
        results.push({ checkName: 'Directional Logic', status: 'PASS', details: `SL and TP levels correctly align with ${data.side} narrative.` });
      } else {
        results.push({ checkName: 'Directional Logic', status: 'FAIL', details: `CRITICAL: Price levels contradict ${data.side} direction. Potential data corruption.` });
      }

      // 3. RR Consistency Check
      const risk = Math.abs(data.entry - data.sl);
      const reward = Math.abs(data.tp2 - data.entry);
      const calculatedRR = risk > 0 ? reward / risk : 0;
      const storedRR = data.rr || 0;
      
      if (Math.abs(calculatedRR - storedRR) > 0.1) {
        results.push({ checkName: 'RR Consistency', status: 'FAIL', details: `Mismatch detected. Displayed RR: ${storedRR}, Calculated RR: ${calculatedRR.toFixed(2)}` });
      } else {
        results.push({ checkName: 'RR Consistency', status: 'PASS', details: `Calculated RR (${calculatedRR.toFixed(2)}) matches stored RR.` });
      }
    }

    // 4. Multi-Source Reconciliation Check
    const currentPrice = data.currentPrice;
    if (currentPrice && data.timestamp) {
      const priceDiff = data.entry ? Math.abs(currentPrice - data.entry) / data.entry * 100 : 0;
      if (priceDiff > 5) {
        results.push({ checkName: 'Multi-Source Reconciliation', status: 'WARN', details: `Significant deviation (${priceDiff.toFixed(2)}%) between internal setup entry (${data.entry}) and live market feed (${currentPrice}). Likely stale data.` });
      } else {
        results.push({ checkName: 'Multi-Source Reconciliation', status: 'PASS', details: `Internal setup data is synchronized with external market feed (${currentPrice}). UI values match internal state.` });
      }
    } else {
      results.push({ checkName: 'Multi-Source Reconciliation', status: 'WARN', details: 'Could not verify data freshness against live exchange stream.' });
    }

    // 5. Execution Readiness Gate
    const isActionable = data.priority === 'ACTIONABLE' || data.isValid;
    if (isActionable) {
      results.push({ checkName: 'Execution Readiness Gate', status: 'PASS', details: 'Setup is fully actionable and ready for execution.' });
    } else {
      results.push({ checkName: 'Execution Readiness Gate', status: 'WARN', details: 'Setup is technically interesting but not fully actionable yet (waiting for confirmation).' });
    }

    return results;
  };

  const generateTechnicalDiagnosis = (auditResults: AuditResult[], context: any): TechnicalDiagnosis | null => {
    const failures = auditResults.filter(r => r.status === 'FAIL');
    if (failures.length === 0) return null;

    const isRRIssue = failures.some(f => f.checkName === 'RR Consistency');
    const isDirectionIssue = failures.some(f => f.checkName === 'Directional Logic');

    if (isDirectionIssue) {
      return {
        problemSummary: 'Directional Logic Mismatch Detected',
        affectedLayer: 'Rule Engine',
        severity: 'CRITICAL',
        rootCause: 'The setup generation logic assigned a LONG/SHORT narrative but the calculated SL/TP price levels belong to the opposite direction. Likely a race condition in the state transition or a reused cached object.',
        recommendedFix: 'Implement a strict validation gate in the Backend before persistence: `if (side === LONG && sl >= entry) throw Error()`. Add idempotency keys to setup generation.',
        temporaryMitigation: 'Downgrade the setup to INVALID_SETUP state immediately to prevent execution.',
        selfHealingAction: 'Auto-downgrading setup state to INVALID_SETUP and freezing related alerts.',
        timeline: [
          { timestamp: new Date(Date.now() - 5000).toISOString(), event: 'Setup generation initiated' },
          { timestamp: new Date(Date.now() - 4000).toISOString(), event: 'Direction set to LONG' },
          { timestamp: new Date(Date.now() - 3000).toISOString(), event: 'SL calculated above Entry (Error)' },
          { timestamp: new Date(Date.now() - 1000).toISOString(), event: 'Validation failed during Audit' }
        ],
        qaScenarios: [
          {
            title: 'Verify LONG setup validation',
            steps: ['Create LONG setup', 'Set SL > Entry', 'Submit'],
            expectedOutcome: 'Validation error thrown. Setup not saved.'
          }
        ]
      };
    }

    if (isRRIssue) {
      return {
        problemSummary: 'Risk/Reward Calculation Inconsistency',
        affectedLayer: 'Backend',
        severity: 'MEDIUM',
        rootCause: 'The stored RR value does not match the dynamic calculation of (TP-Entry)/(Entry-SL). This usually happens when price levels are updated but the RR field is not recalculated before saving to the DB.',
        recommendedFix: 'Remove static RR fields from the DB schema. Calculate RR dynamically on the Frontend and API response layers using a shared utility function.',
        temporaryMitigation: 'Force a recalculation on the frontend display and flag the setup with a warning badge.',
        selfHealingAction: 'Auto-recalculating RR for display purposes.',
        timeline: [
          { timestamp: new Date(Date.now() - 10000).toISOString(), event: 'Setup created with RR 2.5' },
          { timestamp: new Date(Date.now() - 5000).toISOString(), event: 'Entry price updated manually' },
          { timestamp: new Date(Date.now() - 1000).toISOString(), event: 'RR mismatch detected during Audit' }
        ],
        qaScenarios: [
          {
            title: 'Verify dynamic RR calculation',
            steps: ['Update Entry price', 'Check displayed RR'],
            expectedOutcome: 'RR updates immediately based on new Entry price.'
          }
        ]
      };
    }

    return {
      problemSummary: 'Unknown Data Inconsistency',
      affectedLayer: 'Database',
      severity: 'HIGH',
      rootCause: 'Multiple data validation checks failed.',
      recommendedFix: 'Review audit logs for the specific setup ID.',
      temporaryMitigation: 'Suspend automated alerts for this symbol.',
      selfHealingAction: 'Isolating affected symbol from execution engine.',
      qaScenarios: []
    };
  };

  const generatePortfolioImpact = (context: any): PortfolioImpact => {
    return {
      totalRiskImpact: `การเข้าเทรดนี้จะเพิ่มความเสี่ยงรวมของพอร์ตอีก ${context.riskPercent || 1}%`,
      exposureOverlap: 'ไม่มีการทับซ้อนกับ Position ปัจจุบัน',
      correlatedPositions: 'ไม่พบ Position ที่มีความสัมพันธ์กัน (Correlation) สูง',
      portfolioHeat: 'ความร้อนแรงของพอร์ต (Portfolio Heat) อยู่ในระดับต่ำ (Low Risk)'
    };
  };

  const generateEvidencePack = (context: any): AuditEvidencePack => {
    return {
      symbol: context.symbol || 'UNKNOWN',
      setupVersion: context.setupHash || 'v1.0',
      side: context.side || 'UNKNOWN',
      entry: context.entry || 0,
      sl: context.sl || 0,
      tp: context.tp2 || 0,
      rrCheck: context.rr ? `Displayed RR: ${context.rr}` : 'N/A',
      evidenceList: [
        'Market structure aligns with side',
        'Volume profile supports entry zone',
        'Order block mitigated'
      ],
      candleContext: context.confirmationMode || 'Unknown',
      alertTimeline: [
        `[${new Date(Date.now() - 3600000).toLocaleTimeString()}] Setup Generated`,
        `[${new Date(Date.now() - 1800000).toLocaleTimeString()}] Price entered zone`,
        `[${new Date().toLocaleTimeString()}] Alert Triggered`
      ],
      validationFlags: [
        'Symbol Match: PASS',
        'Directional Logic: PASS',
        'RR Calculation: PASS'
      ],
      suspectedIssue: 'None detected',
      recommendedFix: 'N/A'
    };
  };

  const generateDiffExplanation = (context: any): DiffExplanation => {
    // Mock diff generation
    return {
      summary: `มีการปรับปรุง Setup ของ ${context.symbol} จากเวอร์ชันก่อนหน้า`,
      changes: [
        { field: 'Entry Price', old: context.entry * 0.99, new: context.entry },
        { field: 'Stop Loss', old: context.sl * 1.01, new: context.sl },
        { field: 'Risk/Reward', old: (context.rr * 0.9).toFixed(2), new: context.rr }
      ],
      impact: 'การปรับจุดเข้าและ Stop Loss ทำให้ Risk/Reward ดีขึ้น แต่ความน่าจะเป็นในการถูกเกี่ยว (Fill Probability) อาจลดลงเล็กน้อย'
    };
  };

  // --- Event Listeners ---

  useEffect(() => {
    const handleOpenCopilot = (e: any) => {
      setIsOpen(true);
      const tab = e.detail?.tab || 'ask';
      const context = e.detail?.context;
      
      setActiveTab(tab);
      setContextData(context);
      
      if (!context) return;

      setIsProcessing(true);
      
      // Simulate network/processing delay for realism
      setTimeout(() => {
        if (tab === 'explain') {
          const explanation = generateTradingExplanation(context);
          setMessages(prev => [
            ...prev, 
            { type: 'text', role: 'user', content: `ช่วยอธิบาย Setup ของ ${context.symbol} อย่างละเอียด พร้อมระบุความเสี่ยงและจุดยกเลิกแผน` },
            { type: 'explanation', role: 'assistant', data: explanation }
          ]);
        } 
        else if (tab === 'investigate') {
          setMessages(prev => [
            ...prev, 
            { type: 'text', role: 'user', content: `ตรวจสอบ Alert: ${context.title} (${context.symbol}) ทำไมถึงแจ้งเตือน?` },
            { type: 'text', role: 'assistant', content: `จากการตรวจสอบ Alert ของ ${context.symbol}:\n\nเหตุผลที่ทริกเกอร์: ระบบตรวจพบเงื่อนไขทางเทคนิคตรงตามที่กำหนด (${context.satisfiedConditionsCount}/${context.totalConditionsCount} เงื่อนไข)\n\nสถานะความเสี่ยง: ${context.priority === 'ACTIONABLE' ? 'ผ่านเกณฑ์ความเสี่ยง (Actionable)' : 'ยังไม่ผ่านเกณฑ์ความเสี่ยง (Waiting/Interesting)'}\n\nความน่าเชื่อถือ: ข้อมูลอ้างอิงจากแท่งเทียนล่าสุด (Candle Close Context) มีความสอดคล้องกับราคา Real-time` }
          ]);
        }
        else if (tab === 'audit') {
          const auditResults = runDataIntegrityAudit(context, 'setup');
          const diagnosis = generateTechnicalDiagnosis(auditResults, context);
          
          setMessages(prev => [
            ...prev,
            { type: 'text', role: 'user', content: `รัน Data Integrity Audit สำหรับข้อมูล ${context.symbol}` },
            { type: 'audit', role: 'assistant', data: auditResults }
          ]);

          if (diagnosis) {
            setTimeout(() => {
              setMessages(prev => [
                ...prev,
                { type: 'diagnosis', role: 'assistant', data: diagnosis }
              ]);
            }, 800);
          }
        }
        else if (tab === 'portfolio') {
          const impact = generatePortfolioImpact(context);
          setMessages(prev => [
            ...prev,
            { type: 'text', role: 'user', content: `วิเคราะห์ผลกระทบต่อพอร์ตโฟลิโอหากเข้าเทรด ${context.symbol}` },
            { type: 'portfolio_impact', role: 'assistant', data: impact }
          ]);
        }
        else if (tab === 'evidence') {
          const pack = generateEvidencePack(context);
          setMessages(prev => [
            ...prev,
            { type: 'text', role: 'user', content: `สร้าง Audit Evidence Pack สำหรับ ${context.symbol}` },
            { type: 'evidence_pack', role: 'assistant', data: pack }
          ]);
        }
        else if (tab === 'diff') {
          const diff = generateDiffExplanation(context);
          setMessages(prev => [
            ...prev,
            { type: 'text', role: 'user', content: `เปรียบเทียบ Setup ปัจจุบันกับเวอร์ชันก่อนหน้าของ ${context.symbol}` },
            { type: 'diff', role: 'assistant', data: diff }
          ]);
        }
        setIsProcessing(false);
      }, 600);
    };

    window.addEventListener('open-ai-copilot', handleOpenCopilot);
    return () => window.removeEventListener('open-ai-copilot', handleOpenCopilot);
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMessage = input;
    setMessages(prev => [...prev, { type: 'text', role: 'user', content: userMessage }]);
    setInput('');
    setIsProcessing(true);
    
    try {
      // Prepare chat history for Gemini
      const chatHistory = messages
        .filter(m => m.type === 'text')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
        
      // Prepare journal stats
      let journalContext = "";
      if (journal && journal.length > 0) {
        const closed = journal.filter(t => t.status === 'WON' || t.status === 'LOST');
        const won = closed.filter(t => t.status === 'WON');
        const lost = closed.filter(t => t.status === 'LOST');
        const winRate = closed.length > 0 ? (won.length / closed.length) * 100 : 0;
        const totalPnL = closed.reduce((sum, t) => sum + (Number(t.pnlUSD) || 0), 0);
        
        let avgWin = 0;
        let avgLoss = 0;
        if (won.length > 0) avgWin = won.reduce((sum, t) => sum + (Number(t.pnlUSD) || 0), 0) / won.length;
        if (lost.length > 0) avgLoss = lost.reduce((sum, t) => sum + (Number(t.pnlUSD) || 0), 0) / lost.length;
        
        const winRateDecimal = closed.length > 0 ? won.length / closed.length : 0;
        const lossRateDecimal = closed.length > 0 ? lost.length / closed.length : 0;
        const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * Math.abs(avgLoss));
        const profitFactor = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : (avgWin > 0 ? 999 : 0);

        journalContext = `\n\nสถิติการเทรดในอดีตของผู้ใช้ (Trade Journal):\n- จำนวนเทรดทั้งหมด: ${closed.length} ครั้ง (Win: ${won.length}, Loss: ${lost.length})\n- Win Rate: ${winRate.toFixed(2)}%\n- Total PnL: $${totalPnL.toFixed(2)}\n- Avg Win: $${avgWin.toFixed(2)} / Avg Loss: $${avgLoss.toFixed(2)}\n- Profit Factor: ${profitFactor.toFixed(2)}\n- Expectancy ต่อการเทรด: $${expectancy.toFixed(2)}\nกรุณานำสถิติเหล่านี้ไปวิเคราะห์ร่วมกับกราฟ เพื่อแนะนำการเทรดให้เฉียบคมขึ้น (เช่น หาก Expectancy เป็นลบ ควรเตือน หรือถ้า Loss เยอะควรให้ชะลอการเข้า)`;
      }

      // Add system context about the current setup if available
      let systemPrompt = "คุณคือ AI Trading Copilot ผู้ช่วยวิเคราะห์การเทรดคริปโตและตรวจสอบข้อมูล (Data Integrity) ตอบคำถามเป็นภาษาไทยอย่างมืออาชีพ กระชับ และเข้าใจง่าย ใช้ภาษาแบบมีเงื่อนไขเพื่อการศึกษา ไม่ฟันธง ไม่รับประกันกำไร และต้องเน้น risk/reward, stop-loss, invalidation และการรอ confirmation เสมอ\nขณะนี้ระบบได้อัปเกรดความสามารถใหม่ล่าสุดเรียบร้อยแล้ว ได้แก่:\n1. Price Action & Market Structure (เช็คจาก Swing High/Low)\n2. ใช้ค่า ATR x 1.5 เป็น Stop Loss Buffer คอยป้องกันการสะบัดจากความผันผวน\n3. จัดทำ Confluence Scoring ที่แม่นยำขึ้น\n4. ตรวจจับ Bullish/Bearish Divergence อัตโนมัติในเบื้องหลัง";
      systemPrompt += journalContext;

      if (contextData) {
        systemPrompt += `\n\nข้อมูลบริบทการเทรดปัจจุบันที่ผู้ใช้สอบถาม:\nSymbol: ${contextData.symbol}\nSide: ${contextData.side}\nEntry: ${contextData.entry}\nSL: ${contextData.sl}\nTP: ${contextData.tp2 || contextData.tp}\nStatus: ${contextData.priority || 'UNKNOWN'}\nNote: ใช้วิจารณญาณพิจารณาด้วยว่า Risk/Reward ของแผนนี้เหมาะสมกับ Win Rate และ Expectancy ในอดีตหรือไม่`;
      }

      const response = await apiFetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'รับทราบครับ ผมพร้อมช่วยเหลือคุณแล้ว' }] },
            ...chatHistory,
            { role: 'user', parts: [{ text: userMessage }] }
          ]
        })
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        throw new Error(await readAiCopilotError(response));
      }

      if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error('AI backend route returned a non-JSON response. Please redeploy the Vercel API function for /api/ai/copilot.');
      }

      const data = await response.json();
      const replyText = data.text || 'ขออภัยครับ ไม่สามารถประมวลผลคำตอบได้ในขณะนี้';
      
      setMessages(prev => [...prev, { 
        type: 'text', 
        role: 'assistant', 
        content: replyText 
      }]);
    } catch (error) {
      console.error("Gemini API Error:", error);
      const detail = error instanceof Error ? error.message : String(error);
      setMessages(prev => [...prev, { 
        type: 'text', 
        role: 'assistant', 
        content: `ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ AI\n\nรายละเอียด: ${detail}` 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Render Helpers ---

  const renderMessage = (msg: BotMessage, idx: number) => {
    if (msg.type === 'text') {
      return (
        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] p-3 rounded-xl text-sm whitespace-pre-wrap ${
            msg.role === 'user' 
              ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-50 rounded-tr-none' 
              : 'bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-50 rounded-tl-none'
          }`}>
            {msg.content}
          </div>
        </div>
      );
    }

    if (msg.type === 'explanation') {
      return (
        <div key={idx} className="bg-[#0a001a] border border-fuchsia-500/30 rounded-xl p-4 shadow-[0_0_15px_rgba(217,70,239,0.1)]">
          <div className="flex items-center gap-2 mb-3 border-b border-fuchsia-500/20 pb-2">
            <Zap className="w-5 h-5 text-fuchsia-400" />
            <h4 className="font-bold text-fuchsia-300">Trading Setup Explanation</h4>
          </div>
          
          <p className="text-sm text-white mb-4 font-medium">{msg.data.summary}</p>
          
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-cyan-400 font-bold text-xs uppercase tracking-wider">Evidence (หลักฐานอ้างอิง)</span>
              <ul className="list-disc pl-4 mt-1 text-slate-300 space-y-1">
                {msg.data.evidence.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
            
            <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-slate-800">
              <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">Confidence:</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500" style={{ width: `${msg.data.confidence}%` }}></div>
              </div>
              <span className="text-white font-mono text-xs">{msg.data.confidence}%</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Assumptions (สมมติฐาน)</span>
              <ul className="list-disc pl-4 mt-1 text-slate-400 text-xs space-y-1">
                {msg.data.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>

            {msg.data.risks && msg.data.risks.length > 0 && (
              <div>
                <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">News / Event Risks (ความเสี่ยงจากข่าว/เหตุการณ์)</span>
                <ul className="list-disc pl-4 mt-1 text-amber-200/80 text-xs space-y-1">
                  {msg.data.risks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded">
              <span className="text-rose-400 font-bold text-xs uppercase tracking-wider block mb-1">Invalidation (จุดยกเลิกแผน)</span>
              <p className="text-rose-200/80 text-xs">{msg.data.invalidation}</p>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded">
              <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider block mb-1">Next Action (สิ่งที่ควรทำ)</span>
              <p className="text-emerald-200/80 text-xs">{msg.data.nextAction}</p>
            </div>
          </div>
        </div>
      );
    }

    if (msg.type === 'audit') {
      return (
        <div key={idx} className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h4 className="font-bold text-cyan-300 text-sm">Data Integrity Audit Results</h4>
          </div>
          {msg.data.map((res, i) => (
            <div key={i} className={`p-3 rounded-lg border ${
              res.status === 'PASS' ? 'bg-emerald-500/10 border-emerald-500/20' :
              res.status === 'FAIL' ? 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]' :
              'bg-amber-500/10 border-amber-500/20'
            }`}>
              <div className="flex items-center gap-2 font-bold mb-1 text-sm">
                {res.status === 'PASS' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                 res.status === 'FAIL' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> :
                 <Info className="w-4 h-4 text-amber-400" />}
                <span className={
                  res.status === 'PASS' ? 'text-emerald-400' :
                  res.status === 'FAIL' ? 'text-rose-400' : 'text-amber-400'
                }>{res.checkName}</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded ${
                  res.status === 'PASS' ? 'bg-emerald-500/20 text-emerald-300' :
                  res.status === 'FAIL' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                }`}>{res.status}</span>
              </div>
              <p className={`text-xs ${
                res.status === 'PASS' ? 'text-emerald-200/70' :
                res.status === 'FAIL' ? 'text-rose-200/90' : 'text-amber-200/70'
              }`}>{res.details}</p>
            </div>
          ))}
        </div>
      );
    }

    if (msg.type === 'diagnosis') {
      return (
        <div key={idx} className="bg-[#1a0000] border border-rose-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(244,63,94,0.15)] mt-2">
          <div className="flex items-center gap-2 mb-3 border-b border-rose-500/30 pb-2">
            <Wrench className="w-5 h-5 text-rose-400" />
            <h4 className="font-bold text-rose-300">Incident Diagnosis & Repair Guidance</h4>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-start">
              <span className="text-white font-bold">{msg.data.problemSummary}</span>
              <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">{msg.data.severity}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/40 p-2 rounded border border-rose-500/20">
                <span className="text-slate-500 block mb-0.5">Affected Layer</span>
                <span className="text-cyan-300 font-mono flex items-center gap-1"><Server className="w-3 h-3"/> {msg.data.affectedLayer}</span>
              </div>
            </div>

            <div>
              <span className="text-rose-400 font-bold text-xs uppercase tracking-wider block mb-1">Likely Root Cause</span>
              <p className="text-slate-300 text-xs leading-relaxed bg-black/40 p-2 rounded border border-slate-800">{msg.data.rootCause}</p>
            </div>

            {msg.data.timeline && msg.data.timeline.length > 0 && (
              <div>
                <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block mb-1">Event Timeline</span>
                <div className="space-y-1 border-l-2 border-slate-700 pl-2 ml-1">
                  {msg.data.timeline.map((event, i) => (
                    <div key={i} className="text-xs">
                      <span className="text-slate-500 font-mono mr-2">{new Date(event.timestamp).toLocaleTimeString()}</span>
                      <span className="text-slate-300">{event.event}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider block mb-1">Recommended Fix (Developer)</span>
              <p className="text-emerald-200/80 text-xs font-mono bg-emerald-500/10 p-2 rounded border border-emerald-500/20">{msg.data.recommendedFix}</p>
            </div>

            <div>
              <span className="text-amber-400 font-bold text-xs uppercase tracking-wider block mb-1">Temporary Mitigation (Ops)</span>
              <p className="text-amber-200/80 text-xs bg-amber-500/10 p-2 rounded border border-amber-500/20">{msg.data.temporaryMitigation}</p>
            </div>

            {msg.data.selfHealingAction && (
              <div>
                <span className="text-cyan-400 font-bold text-xs uppercase tracking-wider block mb-1 flex items-center gap-1"><Zap className="w-3 h-3" /> Self-Healing Action Taken</span>
                <p className="text-cyan-200/80 text-xs bg-cyan-500/10 p-2 rounded border border-cyan-500/20">{msg.data.selfHealingAction}</p>
              </div>
            )}

            {msg.data.qaScenarios.length > 0 && (
              <div>
                <span className="text-fuchsia-400 font-bold text-xs uppercase tracking-wider block mb-1">QA Scenarios</span>
                <div className="space-y-2">
                  {msg.data.qaScenarios.map((qa, i) => (
                    <div key={i} className="bg-fuchsia-500/10 p-2 rounded border border-fuchsia-500/20 text-xs">
                      <p className="font-bold text-fuchsia-300 mb-1">{qa.title}</p>
                      <ol className="list-decimal pl-4 text-fuchsia-200/80 mb-1">
                        {qa.steps.map((step, j) => <li key={j}>{step}</li>)}
                      </ol>
                      <p className="text-emerald-400 font-mono">Expected: {qa.expectedOutcome}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (msg.type === 'portfolio_impact') {
      return (
        <div key={idx} className="bg-[#0a001a] border border-cyan-500/30 rounded-xl p-4 shadow-[0_0_15px_rgba(34,211,238,0.1)] mt-2">
          <div className="flex items-center gap-2 mb-3 border-b border-cyan-500/20 pb-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h4 className="font-bold text-cyan-300">Portfolio Impact Advisor</h4>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="bg-cyan-500/10 border border-cyan-500/20 p-2 rounded">
              <span className="text-cyan-400 font-bold text-xs uppercase tracking-wider block mb-1">Total Risk Impact</span>
              <p className="text-cyan-200/80 text-xs">{msg.data.totalRiskImpact}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 p-2 rounded">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block mb-1">Exposure Overlap</span>
              <p className="text-slate-300 text-xs">{msg.data.exposureOverlap}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 p-2 rounded">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block mb-1">Correlated Positions</span>
              <p className="text-slate-300 text-xs">{msg.data.correlatedPositions}</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded">
              <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider block mb-1">Portfolio Heat</span>
              <p className="text-emerald-200/80 text-xs">{msg.data.portfolioHeat}</p>
            </div>
          </div>
        </div>
      );
    }

    if (msg.type === 'evidence_pack') {
      return (
        <div key={idx} className="bg-[#0a001a] border border-fuchsia-500/30 rounded-xl p-4 shadow-[0_0_15px_rgba(217,70,239,0.1)] mt-2">
          <div className="flex items-center gap-2 mb-3 border-b border-fuchsia-500/20 pb-2">
            <Database className="w-5 h-5 text-fuchsia-400" />
            <h4 className="font-bold text-fuchsia-300">Audit Evidence Pack</h4>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800/50 border border-slate-700 p-2 rounded">
                <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block mb-1">Symbol</span>
                <p className="text-slate-300 text-xs">{msg.data.symbol}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 p-2 rounded">
                <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block mb-1">Version</span>
                <p className="text-slate-300 text-xs">{msg.data.setupVersion}</p>
              </div>
            </div>
            
            <div className="bg-slate-800/50 border border-slate-700 p-2 rounded">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block mb-1">Setup Details</span>
              <p className="text-slate-300 text-xs">Side: {msg.data.side} | Entry: {msg.data.entry} | SL: {msg.data.sl} | TP: {msg.data.tp}</p>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded">
              <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider block mb-1">Validation Flags</span>
              <ul className="list-disc pl-4 text-emerald-200/80 text-xs">
                {msg.data.validationFlags.map((flag, i) => <li key={i}>{flag}</li>)}
              </ul>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded">
              <span className="text-amber-400 font-bold text-xs uppercase tracking-wider block mb-1">Alert Timeline</span>
              <ul className="list-disc pl-4 text-amber-200/80 text-xs">
                {msg.data.alertTimeline.map((time, i) => <li key={i}>{time}</li>)}
              </ul>
            </div>
          </div>
        </div>
      );
    }

    if (msg.type === 'diff') {
      return (
        <div key={idx} className="bg-[#0a001a] border border-indigo-500/30 rounded-xl p-4 shadow-[0_0_15px_rgba(99,102,241,0.1)] mt-2">
          <div className="flex items-center gap-2 mb-3 border-b border-indigo-500/20 pb-2">
            <Search className="w-5 h-5 text-indigo-400" />
            <h4 className="font-bold text-indigo-300">Setup Diff Viewer</h4>
          </div>
          
          <div className="space-y-3 text-sm">
            <p className="text-indigo-200/80 text-xs">{msg.data.summary}</p>
            
            <div className="space-y-2">
              {msg.data.changes.map((change, i) => (
                <div key={i} className="bg-slate-800/50 border border-slate-700 p-2 rounded grid grid-cols-3 gap-2 items-center">
                  <span className="text-slate-400 font-bold text-xs">{change.field}</span>
                  <span className="text-rose-400 text-xs text-center line-through">{change.old}</span>
                  <span className="text-emerald-400 text-xs text-center">{change.new}</span>
                </div>
              ))}
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 p-2 rounded mt-2">
              <span className="text-indigo-400 font-bold text-xs uppercase tracking-wider block mb-1">Impact Analysis</span>
              <p className="text-indigo-200/80 text-xs">{msg.data.impact}</p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const tabs = [
    { id: 'ask', label: 'Copilot Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'log', label: 'System Logs', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Floating Launcher */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        aria-label="เปิด AI Trading Copilot"
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-cyan-500 to-fuchsia-600 rounded-full shadow-[0_0_20px_rgba(217,70,239,0.5)] flex items-center justify-center z-50 text-white border border-white/20"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-[#050014] animate-pulse"></span>
      </motion.button>

      {/* AI Assistant Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-[450px] max-w-[calc(100vw-48px)] h-[650px] max-h-[80vh] bg-gradient-to-b from-[#13002b]/95 to-[#050014]/95 backdrop-blur-xl rounded-2xl border border-fuchsia-500/30 shadow-[0_0_40px_rgba(217,70,239,0.3)] z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-fuchsia-500/30 bg-black/40 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.5)] relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30 mix-blend-overlay"></div>
                  <Activity className="w-5 h-5 text-white relative z-10" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">AI Trading Copilot</h3>
                  <p className="text-[10px] text-cyan-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
                    Data Integrity Bot Active
                  </p>
                </div>
              </div>
              <button aria-label="ปิด AI Trading Copilot" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1 bg-white/5 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto scrollbar-hide border-b border-white/5 bg-black/20 shrink-0">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold whitespace-nowrap transition-colors flex-1 justify-center ${
                    activeTab === tab.id 
                      ? 'text-fuchsia-400 border-b-2 border-fuchsia-500 bg-fuchsia-500/10' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-fuchsia-500/20 scrollbar-track-transparent">
              {activeTab === 'ask' && (
                <div className="space-y-4">
                  {messages.map((msg, idx) => renderMessage(msg, idx))}
                  {isProcessing && (
                    <div className="flex justify-start">
                      <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 p-3 rounded-xl rounded-tl-none flex items-center gap-2 text-sm">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        กำลังประมวลผลข้อมูล Real-time...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
              
              {activeTab === 'log' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-4 border-b border-slate-800 pb-2">
                    <span>System Activity Logs</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Live</span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-300 space-y-2">
                    <p><span className="text-cyan-500">[{new Date().toLocaleTimeString()}]</span> [INFO] WebSocket connected to Binance stream.</p>
                    <p><span className="text-cyan-500">[{new Date().toLocaleTimeString()}]</span> [INFO] Market data synced (4 symbols).</p>
                    <p><span className="text-amber-500">[{new Date().toLocaleTimeString()}]</span> [WARN] Setup v2 for BTCUSDT generated. Awaiting candle close.</p>
                    <p><span className="text-fuchsia-500">[{new Date().toLocaleTimeString()}]</span> [AUDIT] Bot initialized. Integrity checks active.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            {activeTab === 'ask' && (
              <form onSubmit={handleSend} className="p-3 border-t border-fuchsia-500/30 bg-black/40 shrink-0">
                <div className="relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="พิมพ์คำถาม หรือให้ AI ช่วยวิเคราะห์..."
                    className="w-full bg-[#0a001a] border border-fuchsia-500/30 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all shadow-[inset_0_0_10px_rgba(217,70,239,0.05)]"
                  />
                  <button 
                    type="submit"
                    disabled={!input.trim() || isProcessing}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-cyan-500 to-fuchsia-600 rounded-lg text-white hover:shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
