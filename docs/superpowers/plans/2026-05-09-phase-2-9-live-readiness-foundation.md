# QuantEdge Phase 2-9 Live Readiness Foundation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Upgrade QuantEdge from a safer Phase 0-1 prototype into a measurable live-readiness foundation. This phase must not add automated exchange order execution. It should add institutional gates, deterministic validation, paper-trading evidence, and a live-readiness dashboard that shows what is ready, what is only paper-ready, and what is blocked.

**Architecture:** Add focused domain modules with tests first, then wire the existing app lightly. Keep core decision rules in `src/domain/*` so later phases can reuse them in backtests, alerts, and server-side checks.

**Tech Stack:** React, TypeScript, Vite, Node test runner through `tsx`, Express.

---

### Phase 2: Market Data Integrity

**Files:**
- Create: `src/domain/market/marketDataIntegrity.ts`
- Create: `src/domain/market/marketDataIntegrity.test.ts`
- Modify: `src/App.tsx`

- [ ] Validate kline arrays before indicators are calculated.
- [ ] Detect empty, malformed, non-monotonic, insufficient, and stale candles.
- [ ] Normalize kline request parameters for future server/client reuse.
- [ ] Surface market data status in the app so a chart candidate cannot look institutional when data is blocked.

### Phase 3: Strategy Research Contract

**Files:**
- Modify: `docs/superpowers/plans/2026-05-09-phase-2-9-live-readiness-foundation.md`

- [ ] Define the minimum out-of-sample contract: sample size, expectancy, drawdown, and regime coverage.
- [ ] Do not claim strategy edge until the backtest engine produces out-of-sample metrics.

### Phase 4: Backtest Evidence Gate

**Files:**
- Create domain hook points only in this slice.

- [ ] Reserve live-readiness inputs for backtest sample size, out-of-sample expectancy, and drawdown.
- [ ] Mark live readiness as not ready until real out-of-sample evidence exists.

### Phase 5: Risk Policy Engine

**Files:**
- Create: `src/domain/risk/riskPolicy.ts`
- Create: `src/domain/risk/riskPolicy.test.ts`
- Modify: `src/App.tsx`

- [ ] Validate entry, stop, target geometry for long and short plans.
- [ ] Block trades that exceed max risk per trade, portfolio heat, or daily loss limits.
- [ ] Calculate risk amount, position units, position USD, and reward/risk from one trusted function.
- [ ] Require manual confirmation before a reviewed plan can be recorded.

### Phase 6: Execution Safety

**Files:**
- Modify: `src/App.tsx`

- [ ] Keep execution mode manual-only.
- [ ] Make the UI language clear: record/review/paper evidence, not guaranteed execution or profit.
- [ ] Block reviewed-plan recording if the risk policy status is not `PASS`.

### Phase 7: Observability And Audit Trail

**Files:**
- Create domain hook points only in this slice.

- [ ] Expose gate reasons as structured issue codes instead of only prose.
- [ ] Prepare live-readiness gates so audit logs can later store the exact reason a plan was blocked.

### Phase 8: Paper Trading Evidence

**Files:**
- Create: `src/domain/paper/paperTrading.ts`
- Create: `src/domain/paper/paperTrading.test.ts`
- Modify: `src/App.tsx`

- [ ] Add deterministic paper-trade accounting helpers.
- [ ] Compute closed trades, win rate, expectancy in R, profit factor, and max drawdown.
- [ ] Feed journal evidence into live-readiness gates.

### Phase 9: Live Readiness

**Files:**
- Create: `src/domain/live/liveReadiness.ts`
- Create: `src/domain/live/liveReadiness.test.ts`
- Modify: `src/App.tsx`
- Modify: `server.ts`

- [ ] Add a server status endpoint for AI backend configuration and disabled exchange execution.
- [ ] Evaluate market data, risk policy, paper trading, backtest evidence, AI backend, and execution mode.
- [ ] Return one of `NOT_READY`, `PAPER_ONLY`, or `READY_FOR_SMALL_LIVE`.
- [ ] Show a settings-panel readiness checklist with exact gate failures.

### Verification

- [ ] Run `npm run test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Smoke check the local server and readiness endpoint.
- [ ] Report remaining live-readiness gaps honestly.
