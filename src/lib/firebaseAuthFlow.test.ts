import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canFallbackToRedirectFlow,
  canUseFirstPartyAuthRedirect,
  isVercelHost,
  shouldStartWithRedirectFlow
} from './firebaseAuthFlow';

test('desktop localhost starts with popup instead of redirect', () => {
  assert.equal(shouldStartWithRedirectFlow({
    hostname: 'localhost',
    authDomain: 'tutor-intelligence.firebaseapp.com',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125',
    maxTouchPoints: 0,
    isNarrowViewport: false,
    storageAvailable: true
  }), false);
});

test('mobile redirect is allowed only when authDomain matches app domain', () => {
  assert.equal(shouldStartWithRedirectFlow({
    hostname: 'quant-edge-ai-ten.vercel.app',
    authDomain: 'quant-edge-ai-ten.vercel.app',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1',
    maxTouchPoints: 5,
    isNarrowViewport: true,
    storageAvailable: true
  }), true);
});

test('mobile redirect is blocked when authDomain is cross-origin firebaseapp helper', () => {
  assert.equal(shouldStartWithRedirectFlow({
    hostname: 'quant-edge-ai-ten.vercel.app',
    authDomain: 'tutor-intelligence.firebaseapp.com',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1',
    maxTouchPoints: 5,
    isNarrowViewport: true,
    storageAvailable: true
  }), false);
});

test('redirect fallback requires storage and same first-party auth domain', () => {
  assert.equal(canFallbackToRedirectFlow({
    hostname: 'quant-edge-ai-ten.vercel.app',
    authDomain: 'quant-edge-ai-ten.vercel.app',
    userAgent: 'Mozilla/5.0',
    maxTouchPoints: 0,
    isNarrowViewport: false,
    storageAvailable: true
  }), true);

  assert.equal(canFallbackToRedirectFlow({
    hostname: 'quant-edge-ai-ten.vercel.app',
    authDomain: 'quant-edge-ai-ten.vercel.app',
    userAgent: 'Mozilla/5.0',
    maxTouchPoints: 0,
    isNarrowViewport: false,
    storageAvailable: false
  }), false);
});

test('first-party auth redirect never assumes localhost has a production auth proxy', () => {
  assert.equal(canUseFirstPartyAuthRedirect({
    hostname: 'localhost',
    authDomain: 'localhost'
  }), false);
});

test('vercel host detection is limited to vercel preview and production domains', () => {
  assert.equal(isVercelHost('quant-edge-ai-ten.vercel.app'), true);
  assert.equal(isVercelHost('localhost'), false);
  assert.equal(isVercelHost('adisak25144251.github.io'), false);
});
