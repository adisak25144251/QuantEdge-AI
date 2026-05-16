export type StrategyVersionStatus = 'CANDIDATE' | 'APPROVED' | 'RETIRED';
export type StrategyVersionGateStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface StrategyVersionRecord {
  version: number;
  parameterHash: string;
  status: StrategyVersionStatus;
  evidenceStatus: StrategyVersionGateStatus;
  promotedAt: string | null;
  notes: string;
}

export interface StrategyVersionIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface StrategyVersionRegistryInput {
  strategyId: string;
  versions: StrategyVersionRecord[];
}

export interface StrategyVersionRegistry {
  status: StrategyVersionGateStatus;
  strategyId: string;
  activeVersion: StrategyVersionRecord | null;
  history: StrategyVersionRecord[];
  issues: StrategyVersionIssue[];
}

export function buildStrategyVersionRegistry(input: StrategyVersionRegistryInput): StrategyVersionRegistry {
  const issues: StrategyVersionIssue[] = [];
  const history = [...input.versions].sort((a, b) => a.version - b.version);
  const seenVersions = new Set<number>();
  const approved = history.filter(version => version.status === 'APPROVED' && version.evidenceStatus === 'PASS');

  if (!input.strategyId.trim()) {
    issues.push({ code: 'STRATEGY_ID_MISSING', severity: 'ERROR', message: 'Strategy id is required.' });
  }

  for (const version of history) {
    if (seenVersions.has(version.version)) {
      issues.push({ code: 'DUPLICATE_STRATEGY_VERSION', severity: 'ERROR', message: `Duplicate version ${version.version}.` });
    }
    seenVersions.add(version.version);

    if (!version.parameterHash.trim()) {
      issues.push({ code: 'PARAMETER_HASH_MISSING', severity: 'ERROR', message: `Version ${version.version} is missing a parameter hash.` });
    }
    if (version.status === 'APPROVED' && version.evidenceStatus !== 'PASS') {
      issues.push({ code: 'APPROVED_VERSION_WITH_WEAK_EVIDENCE', severity: 'ERROR', message: `Version ${version.version} is approved without passing evidence.` });
    }
  }

  if (approved.length === 0) {
    issues.push({ code: 'NO_APPROVED_STRATEGY_VERSION', severity: 'ERROR', message: 'No approved strategy version is available.' });
  }

  const activeVersion = approved.sort((a, b) => b.version - a.version)[0] ?? null;

  return {
    status: issues.some(issue => issue.severity === 'ERROR') ? 'BLOCK' : issues.length > 0 ? 'REVIEW' : 'PASS',
    strategyId: input.strategyId,
    activeVersion,
    history,
    issues
  };
}
