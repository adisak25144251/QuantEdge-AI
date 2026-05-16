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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

const AUTH_POPUP_TIMEOUT_MS = 12_000;

setPersistence(auth, browserLocalPersistence).catch(error => {
  console.error("Auth persistence setup failed", error);
});

export const loginWithGoogle = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    return await withTimeout(
      signInWithPopup(auth, googleProvider),
      AUTH_POPUP_TIMEOUT_MS,
      'auth/popup-timeout'
    );
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase();
    const shouldUseRedirect = [
      'auth/popup-blocked',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment',
      'auth/internal-error',
      'auth/network-request-failed',
      'auth/popup-timeout'
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const error = new Error(`Authentication popup did not respond within ${timeoutMs}ms.`);
      (error as Error & { code?: string }).code = code;
      reject(error);
    }, timeoutMs);

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
