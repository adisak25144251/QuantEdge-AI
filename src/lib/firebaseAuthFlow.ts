export interface FirebaseAuthFlowEnvironment {
  hostname: string;
  userAgent: string;
  maxTouchPoints: number;
  isNarrowViewport: boolean;
  authDomain: string;
  storageAvailable: boolean;
}

export function shouldStartWithRedirectFlow(environment: FirebaseAuthFlowEnvironment) {
  if (!environment.storageAvailable) return false;
  return isLikelyMobileBrowser(environment) && canUseFirstPartyAuthRedirect(environment);
}

export function canFallbackToRedirectFlow(environment: FirebaseAuthFlowEnvironment) {
  return environment.storageAvailable && canUseFirstPartyAuthRedirect(environment);
}

export function canUseFirstPartyAuthRedirect(environment: Pick<FirebaseAuthFlowEnvironment, 'hostname' | 'authDomain'>) {
  const hostname = normalizeDomain(environment.hostname);
  const authDomain = normalizeDomain(environment.authDomain);
  if (!hostname || !authDomain) return false;
  if (isLocalAuthHost(hostname)) return false;
  return hostname === authDomain;
}

export function isLikelyMobileBrowser(environment: Pick<FirebaseAuthFlowEnvironment, 'userAgent' | 'maxTouchPoints' | 'isNarrowViewport'>) {
  const mobileUserAgent = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(environment.userAgent);
  return mobileUserAgent || (environment.isNarrowViewport && environment.maxTouchPoints > 0);
}

export function isLocalAuthHost(hostname: string) {
  const normalized = normalizeDomain(hostname);
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function isVercelHost(hostname: string) {
  return normalizeDomain(hostname).endsWith('.vercel.app');
}

export function normalizeDomain(domain: string) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
}
