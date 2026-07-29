import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Clock3, Fingerprint, Loader2, ShieldCheck } from 'lucide-react';

interface ForwardMetric {
  signals: number;
  pending: number;
  open: number;
  resolved: number;
  precisionPercent: number;
  expectancyR: number;
  maxDrawdownPercent: number;
}

interface ForwardEvidence {
  candidateId: string;
  candidateHash: string;
  generatedAt: string;
  forwardStart: string;
  elapsedCalendarDays: number;
  status: 'COLLECTING' | 'BLOCK' | 'PAPER_ELIGIBLE';
  control: ForwardMetric;
  candidate: ForwardMetric;
  incrementalExpectancyR: {
    estimate: number;
    lower95: number;
    upper95: number;
  };
  executionEvidence: 'MODELED' | 'MEASURED';
  ledger: {
    events: number;
    headHash: string;
    lastMarketThrough: string | null;
  };
  issues: Array<{ code: string; severity: 'PENDING' | 'ERROR'; message: string }>;
}

export const ForwardCandidateEvidencePanel = () => {
  const [report, setReport] = useState<ForwardEvidence | null>(null);
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');

  useEffect(() => {
    let active = true;
    fetch(new URL('evidence/forward-v2-latest.json', document.baseURI), { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`Forward evidence request failed (${response.status})`);
        return response.json();
      })
      .then(payload => {
        if (!active) return;
        setReport(payload as ForwardEvidence);
        setState('READY');
      })
      .catch(() => {
        if (active) setState('ERROR');
      });
    return () => {
      active = false;
    };
  }, []);

  if (state === 'LOADING') {
    return (
      <section className="border-y border-slate-800 py-5">
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          กำลังโหลดหลักฐาน Forward Paper
        </p>
      </section>
    );
  }

  if (state === 'ERROR' || !report) {
    return (
      <section className="border-y border-slate-800 py-5">
        <p className="flex items-center gap-2 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          Data required: ยังไม่มีหลักฐาน Forward Paper ของ Candidate V2
        </p>
      </section>
    );
  }

  const eligible = report.status === 'PAPER_ELIGIBLE';
  const blocked = report.status === 'BLOCK';
  const statusClass = eligible ? 'text-emerald-300' : blocked ? 'text-rose-300' : 'text-cyan-300';
  const StatusIcon = eligible ? ShieldCheck : blocked ? AlertTriangle : Clock3;

  return (
    <section className="space-y-4 border-y border-slate-800 py-5" aria-labelledby="forward-candidate-title">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 id="forward-candidate-title" className="flex items-center gap-2 text-base font-bold text-white">
            <Activity className="h-5 w-5 text-cyan-300" />
            Forward Paper Candidate V2 แบบ Immutable
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            เริ่มนับผลตั้งแต่ {new Date(report.forwardStart).toLocaleDateString('th-TH')} ·
            ข้อมูลก่อนหน้านี้ใช้ warm-up อินดิเคเตอร์เท่านั้น
          </p>
        </div>
        <div className={`flex items-center gap-2 text-sm font-bold ${statusClass}`}>
          <StatusIcon className="h-5 w-5" />
          {report.status}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Candidate V2"
          value={`${report.candidate.resolved} resolved`}
          detail={`${report.candidate.open} open · ${report.candidate.pending} รอเข้า`}
        />
        <Metric
          label="Control Strategy"
          value={`${report.control.resolved} resolved`}
          detail={`Expectancy ${report.control.expectancyR.toFixed(3)}R`}
        />
        <Metric
          label="Incremental Edge 95% CI"
          value={`${report.incrementalExpectancyR.estimate.toFixed(3)}R`}
          detail={`${report.incrementalExpectancyR.lower95.toFixed(3)} ถึง ${report.incrementalExpectancyR.upper95.toFixed(3)}R`}
        />
        <Metric
          label="ระยะเวลา Forward"
          value={`${report.elapsedCalendarDays} วัน`}
          detail={`Execution: ${report.executionEvidence}`}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-slate-300">เงื่อนไขที่ยังไม่ผ่าน</p>
        <div className="flex flex-wrap gap-2">
          {report.issues.slice(0, 8).map(issue => (
            <span
              key={issue.code}
              title={issue.message}
              className={`border px-2 py-1 text-[11px] ${
                issue.severity === 'ERROR'
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
              }`}
            >
              {issue.code}
            </span>
          ))}
        </div>
      </div>

      <p className="flex min-w-0 items-start gap-2 break-all text-[11px] text-slate-500">
        <Fingerprint className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Candidate {report.candidateId} · {report.candidateHash} · Ledger {report.ledger.headHash} ·
        {report.ledger.events} events · หลักฐานเพื่อการศึกษา ไม่ใช่คำแนะนำลงทุนส่วนบุคคล
      </p>
    </section>
  );
};

const Metric = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <div className="border-l-2 border-cyan-500/40 bg-slate-950/40 px-3 py-2">
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className="mt-1 text-base font-bold text-white">{value}</p>
    <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
  </div>
);
