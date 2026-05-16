# QuantEdge Phase 0-1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current prototype into a safer Phase 0-1 foundation by removing mock/random trading signals, adding deterministic signal-readiness logic, and preventing client-side AI key exposure.

**Architecture:** Add small domain modules first, backed by focused tests, then wire the UI to those modules. Keep this phase scoped to safety and foundation; full strategy research, backtesting upgrades, and paper trading come later.

**Tech Stack:** React, TypeScript, Vite, Node test runner through `tsx`, Firebase, Express.

---

### Task 1: Signal Safety Domain

**Files:**
- Create: `src/domain/strategy/signalSafety.ts`
- Create: `src/domain/strategy/signalSafety.test.ts`
- Modify: `package.json`

- [ ] Add tests that prove actionable labels, execution permission, deterministic setup IDs, and alert conversion do not depend on random values.
- [ ] Implement the minimal signal safety helpers.
- [ ] Add a `test` script using `tsx --test`.
- [ ] Run `npm run test`.

### Task 2: Phase 0 UI Wiring

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/MarketScreener.tsx`
- Modify: `src/components/BacktestSimulator.tsx`
- Modify: `src/components/TradingGuide.tsx`

- [ ] Remove public CORS proxy fallbacks from Binance fetch retry logic.
- [ ] Replace mock setup state IDs/hashes with deterministic setup identity.
- [ ] Replace mock alert background job with setup-derived alert snapshots.
- [ ] Replace random funding/win-rate/correlation placeholders with unavailable/neutral values.
- [ ] Change execution language from one-click/actionable certainty to candidate/review language.
- [ ] Change "World-Class" marketing labels to professional/research labels.

### Task 3: AI Key Safety

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/components/AITradingCopilot.tsx`
- Modify: `server.ts`

- [ ] Stop injecting `GEMINI_API_KEY` into the client bundle.
- [ ] Add a backend `/api/ai/copilot` endpoint that owns the Gemini key server-side.
- [ ] Update the client copilot to call the backend endpoint.
- [ ] Return a controlled error when `GEMINI_API_KEY` is not configured.

### Task 4: Verification

**Files:**
- No code files unless verification reveals a regression.

- [ ] Run `npm run test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Report any warnings or known remaining gaps.
