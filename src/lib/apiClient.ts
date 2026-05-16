import { auth } from './firebase';

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = await auth.currentUser?.getIdToken();
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
