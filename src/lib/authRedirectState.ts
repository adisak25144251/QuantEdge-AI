export interface BrowserKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BrowserStorageSet {
  localStorage?: BrowserKeyValueStorage | null;
  sessionStorage?: BrowserKeyValueStorage | null;
}

const APP_LAUNCHED_KEY = 'quantedge.app.launched';
const GOOGLE_AUTH_REDIRECT_PENDING_KEY = 'quantedge.auth.googleRedirectPending';

export function rememberAppLaunched(storages: BrowserStorageSet = getBrowserStorages()) {
  setStorageValue(storages.localStorage, APP_LAUNCHED_KEY, '1');
}

export function shouldLaunchAppOnStartup(storages: BrowserStorageSet = getBrowserStorages()) {
  return (
    getStorageValue(storages.localStorage, APP_LAUNCHED_KEY) === '1' ||
    isGoogleAuthRedirectPending(storages)
  );
}

export function markGoogleAuthRedirectPending(storages: BrowserStorageSet = getBrowserStorages()) {
  setStorageValue(storages.sessionStorage, GOOGLE_AUTH_REDIRECT_PENDING_KEY, '1');
  setStorageValue(storages.localStorage, GOOGLE_AUTH_REDIRECT_PENDING_KEY, '1');
}

export function isGoogleAuthRedirectPending(storages: BrowserStorageSet = getBrowserStorages()) {
  return (
    getStorageValue(storages.sessionStorage, GOOGLE_AUTH_REDIRECT_PENDING_KEY) === '1' ||
    getStorageValue(storages.localStorage, GOOGLE_AUTH_REDIRECT_PENDING_KEY) === '1'
  );
}

export function clearGoogleAuthRedirectPending(storages: BrowserStorageSet = getBrowserStorages()) {
  removeStorageValue(storages.sessionStorage, GOOGLE_AUTH_REDIRECT_PENDING_KEY);
  removeStorageValue(storages.localStorage, GOOGLE_AUTH_REDIRECT_PENDING_KEY);
}

function getBrowserStorages(): BrowserStorageSet {
  if (typeof window === 'undefined') return {};

  return {
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage
  };
}

function getStorageValue(storage: BrowserKeyValueStorage | null | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function setStorageValue(storage: BrowserKeyValueStorage | null | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Private browsing and embedded browsers can block storage; auth still continues.
  }
}

function removeStorageValue(storage: BrowserKeyValueStorage | null | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage cleanup is best-effort only.
  }
}
