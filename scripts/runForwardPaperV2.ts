import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildForwardEvidence,
  canonicalJson,
  createForwardLedger,
  planForwardCollection,
  type ForwardLedger,
  type ForwardLedgerEvent,
  type ImmutableForwardCandidateDefinition,
  type PlannedForwardEvent
} from '../src/domain/forward/immutableForwardCandidateV2';
import type { ExperimentSeries } from '../src/domain/experiments/incrementalEdgeExperiment';
import { fetchYahooAdjustedDaily, mapWithConcurrency } from './lib/yahooAdjustedDaily';

interface CandidateFile {
  schemaVersion: string;
  hashAlgorithm: 'sha256-canonical-json';
  definitionHash: string;
  definition: ImmutableForwardCandidateDefinition;
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidatePath = path.join(rootDir, 'research', 'strategy-candidates', 'us-forward-hybrid-v2.json');
const ledgerPath = path.join(rootDir, 'research', 'forward', 'us-forward-hybrid-v2-ledger.json');
const evidencePath = path.join(rootDir, 'public', 'evidence', 'forward-v2-latest.json');
const warmupStart = '2025-06-01';

async function main() {
  const candidateFile = JSON.parse(await readFile(candidatePath, 'utf8')) as CandidateFile;
  const computedDefinitionHash = sha256(candidateFile.definition);
  if (computedDefinitionHash !== candidateFile.definitionHash) {
    throw new Error(`Candidate definition hash mismatch: expected ${candidateFile.definitionHash}, computed ${computedDefinitionHash}.`);
  }
  const ledger = await loadOrCreateLedger(candidateFile);
  verifyLedgerHashChain(ledger);
  if (ledger.candidateHash !== candidateFile.definitionHash) {
    throw new Error('Ledger is bound to a different candidate hash.');
  }

  const symbols = [...candidateFile.definition.universe, candidateFile.definition.benchmark];
  const failures: Array<{ symbol: string; reason: string }> = [];
  const downloaded = await mapWithConcurrency(symbols, 4, async symbol => {
    try {
      return await fetchYahooAdjustedDaily(symbol, warmupStart);
    } catch (error) {
      failures.push({ symbol, reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  });
  const series = downloaded.filter((item): item is ExperimentSeries => item !== null);
  const benchmark = series.find(item => item.symbol === candidateFile.definition.benchmark);
  if (!benchmark) throw new Error('Benchmark data is required; collection aborted without mutating the ledger.');
  const universe = series.filter(item => item.symbol !== candidateFile.definition.benchmark);
  const observedAt = new Date().toISOString();
  const planned = planForwardCollection({
    definition: candidateFile.definition,
    ledger,
    universe,
    benchmark,
    observedAt,
    provider: 'Yahoo Finance public adjusted daily chart endpoint',
    executionCostsMeasured: false,
    dataFailures: failures
  });
  if (planned.length === 0) {
    process.stdout.write('No new completed forward market bar; ledger and evidence are unchanged.\n');
    return;
  }
  appendEvents(ledger, planned);
  verifyLedgerHashChain(ledger);
  const evidence = {
    ...buildForwardEvidence(candidateFile.definition, ledger, observedAt, false),
    dataPolicy: {
      historicalBarsBeforeForwardStart: 'INDICATOR_WARMUP_ONLY',
      outcomeEvaluationStart: candidateFile.definition.forwardStart,
      parameterRetuningOn2015To2026: 'FORBIDDEN',
      controlAndCandidateCollectedConcurrently: true
    },
    limitations: [
      'The public Yahoo feed is used for forward research continuity, not exchange-grade execution reconstruction.',
      'Entry and exit slippage remain modeled until broker paper-fill evidence is integrated.',
      'The frozen current-symbol universe remains vulnerable to future selection and survivorship limitations; every snapshot is retained in the ledger.',
      'PAPER_ELIGIBLE is not approval for real-money trading.'
    ]
  };

  await Promise.all([
    mkdir(path.dirname(ledgerPath), { recursive: true }),
    mkdir(path.dirname(evidencePath), { recursive: true })
  ]);
  await Promise.all([
    writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8'),
    writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  ]);

  process.stdout.write([
    `Candidate: ${candidateFile.definition.candidateId}`,
    `Hash: ${candidateFile.definitionHash}`,
    `Forward start: ${candidateFile.definition.forwardStart}`,
    `Status: ${evidence.status}`,
    `New events: ${planned.length}`,
    `Control resolved: ${evidence.control.resolved}`,
    `Candidate resolved: ${evidence.candidate.resolved}`,
    `Incremental expectancy: ${evidence.incrementalExpectancyR.estimate}R`,
    `Ledger head: ${evidence.ledger.headHash}`,
    `Data failures: ${failures.length}`,
    `Evidence: ${evidencePath}`
  ].join('\n') + '\n');
}

async function loadOrCreateLedger(candidate: CandidateFile): Promise<ForwardLedger> {
  try {
    return JSON.parse(await readFile(ledgerPath, 'utf8')) as ForwardLedger;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
    return createForwardLedger(candidate.definition, candidate.definitionHash, candidate.definition.frozenAt);
  }
}

function appendEvents(ledger: ForwardLedger, planned: PlannedForwardEvent[]) {
  let previousHash = ledger.events.at(-1)?.eventHash ?? 'GENESIS';
  for (const item of planned) {
    const unsigned = {
      sequence: ledger.events.length + 1,
      type: item.type,
      occurredAt: item.occurredAt,
      entityId: item.entityId,
      previousHash,
      payload: item.payload
    };
    const event: ForwardLedgerEvent = {
      ...unsigned,
      eventHash: sha256(unsigned)
    };
    ledger.events.push(event);
    previousHash = event.eventHash;
  }
}

function verifyLedgerHashChain(ledger: ForwardLedger) {
  let previousHash = 'GENESIS';
  ledger.events.forEach((event, index) => {
    if (event.sequence !== index + 1) throw new Error(`Ledger sequence mismatch at event ${index + 1}.`);
    if (event.previousHash !== previousHash) throw new Error(`Ledger previous hash mismatch at event ${index + 1}.`);
    const unsigned = {
      sequence: event.sequence,
      type: event.type,
      occurredAt: event.occurredAt,
      entityId: event.entityId,
      previousHash: event.previousHash,
      payload: event.payload
    };
    if (event.eventHash !== sha256(unsigned)) throw new Error(`Ledger event hash mismatch at event ${index + 1}.`);
    previousHash = event.eventHash;
  });
}

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

void main().catch(error => {
  process.stderr.write(`Forward paper collection failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
