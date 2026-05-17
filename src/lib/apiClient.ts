import { auth } from './firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

const AUTH_TOKEN_WAIT_MS = 1_500;

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = await getApiAuthToken();
  const controller = init.signal ? null : new AbortController();
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), 12_000) : null;

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    return await fetch(input, {
      ...init,
      headers,
      signal: init.signal ?? controller?.signal
    });
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

async function getApiAuthToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (currentUser) return currentUser.getIdToken();

  const settledUser = await waitForAuthUser(AUTH_TOKEN_WAIT_MS);
  return settledUser ? settledUser.getIdToken() : null;
}

function waitForAuthUser(timeoutMs: number): Promise<User | null> {
  return new Promise(resolve => {
    let settled = false;
    let unsubscribe = () => {};
    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      unsubscribe();
      resolve(user);
    };

    const timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    unsubscribe = onAuthStateChanged(
      auth,
      user => finish(user),
      () => finish(null)
    );
  });
}
