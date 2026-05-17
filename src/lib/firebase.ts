import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { clearGoogleAuthRedirectPending, markGoogleAuthRedirectPending } from './authRedirectState';
import { canFallbackToRedirectFlow, isVercelHost, shouldStartWithRedirectFlow, type FirebaseAuthFlowEnvironment } from './firebaseAuthFlow';

const firebaseBrowserConfig = {
  ...firebaseConfig,
  authDomain: resolveFirebaseAuthDomain(firebaseConfig.authDomain)
};
const POPUP_LOGIN_TIMEOUT_MS = 45000;

const app = initializeApp(firebaseBrowserConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseBrowserConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

setPersistence(auth, getPreferredAuthPersistence()).catch(error => {
  console.error("Auth persistence setup failed", error);
});

export const loginWithGoogle = async () => {
  const canUseBrowserStorage = isAuthStorageAvailable();
  if (!canUseBrowserStorage) {
    throw createAuthEnvironmentError('Browser storage APIs are unavailable.');
  }
  const authFlowEnvironment = getAuthFlowEnvironment(canUseBrowserStorage);

  try {
    await setPersistence(auth, browserLocalPersistence);

    if (shouldStartWithRedirectFlow(authFlowEnvironment)) {
      markGoogleAuthRedirectPending();
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    return await withTimeout(
      signInWithPopup(auth, googleProvider),
      POPUP_LOGIN_TIMEOUT_MS,
      createAuthEnvironmentError('Google popup did not complete before timeout.')
    );
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase();
    const shouldUseRedirect = [
      'auth/popup-blocked',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment',
      'auth/internal-error',
      'auth/network-request-failed'
    ].includes(error?.code) || message.includes('network') || message.includes('popup') || message.includes('blocked');

    if (shouldUseRedirect && canFallbackToRedirectFlow(authFlowEnvironment)) {
      markGoogleAuthRedirectPending();
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    if (shouldUseRedirect) {
      if (isVercelHost(authFlowEnvironment.hostname)) {
        throw createRedirectConfigurationError(error, authFlowEnvironment);
      }
      throw createAuthEnvironmentError(error);
    }

    if (error?.code !== 'auth/popup-blocked') {
      console.error("Login failed", error);
    }
    throw error;
  }
};

export const completeGoogleRedirectLogin = async () => {
  if (!isAuthStorageAvailable()) {
    clearGoogleAuthRedirectPending();
    return null;
  }

  try {
    await setPersistence(auth, browserLocalPersistence);
    const result = await getRedirectResult(auth);
    clearGoogleAuthRedirectPending();
    return result;
  } catch (error: any) {
    clearGoogleAuthRedirectPending();
    const recoverableStartupError = [
      'auth/internal-error',
      'auth/network-request-failed',
      'auth/operation-not-supported-in-this-environment'
    ].includes(error?.code);

    if (recoverableStartupError) {
      return null;
    }

    console.error("Google redirect login failed", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed", error);
  }
};

// Test connection strictly for early check
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

function resolveFirebaseAuthDomain(defaultAuthDomain: string) {
  if (typeof window === 'undefined') return defaultAuthDomain;
  const envAuthDomain = (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN;
  if (typeof envAuthDomain === 'string' && envAuthDomain.trim()) {
    return envAuthDomain.trim().toLowerCase();
  }
  return defaultAuthDomain;
}

function getAuthFlowEnvironment(storageAvailable: boolean): FirebaseAuthFlowEnvironment {
  if (typeof window === 'undefined') {
    return {
      hostname: '',
      userAgent: '',
      maxTouchPoints: 0,
      isNarrowViewport: false,
      authDomain: firebaseBrowserConfig.authDomain,
      storageAvailable
    };
  }

  return {
    hostname: window.location.hostname,
    userAgent: window.navigator.userAgent || '',
    maxTouchPoints: window.navigator.maxTouchPoints || 0,
    isNarrowViewport: Boolean(window.matchMedia?.('(max-width: 768px)').matches),
    authDomain: firebaseBrowserConfig.authDomain,
    storageAvailable
  };
}

function getPreferredAuthPersistence() {
  return isAuthStorageAvailable() ? browserLocalPersistence : inMemoryPersistence;
}

function isAuthStorageAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const storageKey = 'quantedge.auth.storageProbe';
    if (!window.localStorage || !window.sessionStorage || !window.indexedDB) return false;
    window.localStorage.setItem(storageKey, '1');
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.setItem(storageKey, '1');
    window.sessionStorage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError: Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(timeoutError), timeoutMs);
    promise
      .then(value => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function createAuthEnvironmentError(cause: unknown) {
  const error = new Error('This browser blocks Firebase Auth storage or popup login. Open the app in Chrome, Edge, or Safari directly and try again.') as Error & { code?: string; cause?: unknown };
  error.code = 'auth/browser-environment-blocked';
  error.cause = cause;
  return error;
}

function createRedirectConfigurationError(cause: unknown, environment: FirebaseAuthFlowEnvironment) {
  const redirectUri = environment.hostname ? `https://${environment.hostname}/__/auth/handler` : 'https://<your-domain>/__/auth/handler';
  const error = new Error(`Google login popup was blocked and redirect login is not enabled for this domain. Add ${redirectUri} to the Google OAuth redirect URIs and set VITE_FIREBASE_AUTH_DOMAIN to ${environment.hostname || '<your-domain>'}.`) as Error & {
    code?: string;
    cause?: unknown;
  };
  error.code = 'auth/redirect-configuration-required';
  error.cause = cause;
  return error;
}
