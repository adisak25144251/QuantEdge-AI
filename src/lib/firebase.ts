import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const firebaseBrowserConfig = {
  ...firebaseConfig,
  authDomain: resolveFirebaseAuthDomain(firebaseConfig.authDomain)
};

const app = initializeApp(firebaseBrowserConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseBrowserConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

setPersistence(auth, browserLocalPersistence).catch(error => {
  console.error("Auth persistence setup failed", error);
});

export const loginWithGoogle = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);

    if (shouldUseRedirectFlow()) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase();
    const shouldUseRedirect = [
      'auth/popup-blocked',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment',
      'auth/internal-error',
      'auth/network-request-failed'
    ].includes(error?.code) || message.includes('network') || message.includes('popup') || message.includes('blocked');

    if (shouldUseRedirect) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    if (error?.code !== 'auth/popup-blocked') {
      console.error("Login failed", error);
    }
    throw error;
  }
};

export const completeGoogleRedirectLogin = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    return await getRedirectResult(auth);
  } catch (error: any) {
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
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.endsWith('.vercel.app')) return hostname;
  return defaultAuthDomain;
}

function shouldUseRedirectFlow() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  const userAgent = window.navigator.userAgent || '';
  const isProductionHost =
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.github.io') ||
    hostname === 'quant-edge-ai-ten.vercel.app' ||
    hostname === 'adisak25144251.github.io';
  const isMobileBrowser = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(userAgent);
  const isNarrowTouchViewport = window.matchMedia?.('(max-width: 768px)').matches && window.navigator.maxTouchPoints > 0;
  return isProductionHost || isMobileBrowser || isNarrowTouchViewport;
}
