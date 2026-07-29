import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, ShieldX } from 'lucide-react';

interface EvidenceMetric {
  trades: number;
  precisionPercent: number;
  expectancyR: number;
  maxDrawdownPercent: number;
}

interface IncrementalEdgeEvidence {
  runId: string;
  generatedAt: string;
  status: 'PASS' | 'REVIEW' | 'BLOCK';
  strategyStage: string;
  dataset: {
    symbols: string[];
    candleCount: number;
    fingerprint: string;
  };
  baseline: EvidenceMetric;
  hybrid: EvidenceMetric;
  incrementalEdge: {
    expectancyLiftR: { estimate: number; lower95: number; upper95: number };
  };
  walkForward: {
    eligibleWindows: number;
    positiveWindowRate: number;
  };
  issues: Array<{ code: string; severity: 'WARNING' | 'ERROR'; message: string }>;
}

export const IncrementalEdgeEvidencePanel = () => {
  const [report, setReport] = useState<IncrementalEdgeEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const evidenceUrl = new URL('evidence/incremental-edge-latest.json', document.baseURI);
    fetch(evidenceUrl, { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`Evidence request failed (${response.status})`);
        return response.json();
      })
      .then(data => {
        if (active) setReport(data as IncrementalEdgeEvidence);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="border-y border-slate-800 py-5">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          กำลังโหลดหลักฐาน Incremental Edge
        </div>
      </section>
    );
  }

  if (loadError || !report) {
    return (
      <section className="border-y border-slate-800 py-5">
        <div className="flex items-center gap-2 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          Data required: ยังไม่มี evidence artifact จากการทดลอง baseline เทียบ hybrid
        </div>
      </section>
    );
  }

  const StatusIcon = report.status === 'PASS' ? CheckCircle2 : report.status === 'BLOCK' ? ShieldX : AlertTriangle;
  const statusColor = report.status === 'PASS'
    ? 'text-emerald-300'
    : report.status === 'BLOCK'
      ? 'text-rose-300'
      : 'text-amber-300';

  return (
    <section className="border-y border-slate-800 py-5 space-y-4" aria-labelledby="incremental-edge-title">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 id="incremental-edge-title" className="flex items-center gap-2 text-base font-bold text-white">
            <FlaskConical className="h-5 w-5 text-cyan-300" />
            หลักฐาน Incremental Edge: Baseline เทียบ Hybrid
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Run {report.runId} · {report.dataset.symbols.length} หุ้น · {report.dataset.candleCount.toLocaleString('en-US')} แท่ง
          </p>
        </div>
        <div className={`flex items-center gap-2 text-sm font-bold ${statusColor}`}>
          <StatusIcon className="h-5 w-5" />
          {report.status} · {report.strategyStage}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Baseline" value={`${report.baseline.expectancyR.toFixed(3)}R`} detail={`${report.baseline.trades} เทรด · Precision ${report.baseline.precisionPercent.toFixed(1)}%`} />
        <Metric label="Hybrid" value={`${report.hybrid.expectancyR.toFixed(3)}R`} detail={`${report.hybrid.trades} เทรด · Precision ${report.hybrid.precisionPercent.toFixed(1)}%`} />
        <Metric
          label="Expectancy Lift 95% CI"
          value={`${report.incrementalEdge.expectancyLiftR.estimate.toFixed(3)}R`}
          detail={`${report.incrementalEdge.expectancyLiftR.lower95.toFixed(3)} ถึง ${report.incrementalEdge.expectancyLiftR.upper95.toFixed(3)}R`}
        />
        <Metric
          label="Walk-Forward Stability"
          value={`${report.walkForward.positiveWindowRate.toFixed(0)}%`}
          detail={`${report.walkForward.eligibleWindows}/5 windows มี sample เพียงพอ`}
        />
      </div>

      {report.issues.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold text-slate-300">Promotion blockers</p>
          <div className="flex flex-wrap gap-2">
            {report.issues.slice(0, 8).map(issue => (
              <span
                key={issue.code}
                title={issue.message}
                className={`border px-2 py-1 text-[11px] ${
                  issue.severity === 'ERROR'
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                }`}
              >
                {issue.code}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Fingerprint {report.dataset.fingerprint} · สร้างเมื่อ {new Date(report.generatedAt).toLocaleString('th-TH')} · ผลนี้เป็นงานวิจัยเพื่อการศึกษา ไม่ใช่คำแนะนำลงทุนส่วนบุคคล
      </p>
    </section>
  );
};

const Metric = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <div className="border-l-2 border-cyan-500/40 bg-slate-950/40 px-3 py-2">
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-bold text-white">{value}</p>
    <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
  </div>
);
