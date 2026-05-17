import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearGoogleAuthRedirectPending,
  isGoogleAuthRedirectPending,
  markGoogleAuthRedirectPending,
  rememberAppLaunched,
  shouldLaunchAppOnStartup,
  type BrowserKeyValueStorage
} from './authRedirectState';

class MemoryStorage implements BrowserKeyValueStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

test('shouldLaunchAppOnStartup restores dashboard after the app has been launched once', () => {
  const localStorage = new MemoryStorage();

  assert.equal(shouldLaunchAppOnStartup({ localStorage }), false);
  rememberAppLaunched({ localStorage });

  assert.equal(shouldLaunchAppOnStartup({ localStorage }), true);
});

test('google redirect pending marker launches dashboard and is cleared after callback handling', () => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const storages = { localStorage, sessionStorage };

  markGoogleAuthRedirectPending(storages);

  assert.equal(isGoogleAuthRedirectPending(storages), true);
  assert.equal(shouldLaunchAppOnStartup(storages), true);

  clearGoogleAuthRedirectPending(storages);

  assert.equal(isGoogleAuthRedirectPending(storages), false);
});

test('storage failures do not break startup decisions', () => {
  const brokenStorage: BrowserKeyValueStorage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    }
  };

  rememberAppLaunched({ localStorage: brokenStorage });
  markGoogleAuthRedirectPending({ localStorage: brokenStorage, sessionStorage: brokenStorage });
  clearGoogleAuthRedirectPending({ localStorage: brokenStorage, sessionStorage: brokenStorage });

  assert.equal(shouldLaunchAppOnStartup({ localStorage: brokenStorage, sessionStorage: brokenStorage }), false);
});
