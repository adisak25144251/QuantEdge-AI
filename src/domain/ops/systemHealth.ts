export type SystemHealthStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export interface SystemHealthInput {
  aiBackendConfigured: boolean;
  marketDataProxyHealthy: boolean;
  liveTradingLocked: boolean;
  securityHeadersEnabled: boolean;
  uptimeSeconds: number;
}

export interface SystemHealthCheck {
  code: string;
  status: SystemHealthStatus;
  detail: string;
}

export interface SystemHealthReport {
  status: SystemHealthStatus;
  uptimeSeconds: number;
  checks: SystemHealthCheck[];
  generatedAt: string;
}

export function evaluateSystemHealth(input: SystemHealthInput): SystemHealthReport {
  const checks: SystemHealthCheck[] = [
    {
      code: 'AI_BACKEND',
      status: input.aiBackendConfigured ? 'PASS' : 'REVIEW',
      detail: input.aiBackendConfigured ? 'AI backend key is configured server-side.' : 'AI backend key is not configured.'
    },
    {
      code: 'MARKET_DATA_PROXY',
      status: input.marketDataProxyHealthy ? 'PASS' : 'REVIEW',
      detail: input.marketDataProxyHealthy ? 'Market data proxy is available.' : 'Market data proxy requires verification.'
    },
    {
      code: 'LIVE_TRADING_LOCK',
      status: input.liveTradingLocked ? 'PASS' : 'BLOCK',
      detail: input.liveTradingLocked ? 'Live API trading is locked.' : 'Live API trading is unlocked without institutional approval.'
    },
    {
      code: 'SECURITY_HEADERS',
      status: input.securityHeadersEnabled ? 'PASS' : 'REVIEW',
      detail: input.securityHeadersEnabled ? 'Baseline HTTP security headers are enabled.' : 'Security headers are not enabled.'
    },
    {
      code: 'PROCESS_UPTIME',
      status: input.uptimeSeconds >= 0 ? 'PASS' : 'REVIEW',
      detail: `Process uptime is ${Math.max(0, Math.floor(input.uptimeSeconds))} seconds.`
    }
  ];

  return {
    status: checks.some(check => check.status === 'BLOCK')
      ? 'BLOCK'
      : checks.some(check => check.status === 'REVIEW')
        ? 'REVIEW'
        : 'PASS',
    uptimeSeconds: Math.max(0, Math.floor(input.uptimeSeconds)),
    checks,
    generatedAt: new Date().toISOString()
  };
}
