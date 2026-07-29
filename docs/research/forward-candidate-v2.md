# Immutable Forward Candidate V2

## Purpose

`US_FORWARD_HYBRID_V2` is a new, frozen research candidate. It is not optimized
or evaluated on 2015-2026 outcomes. Historical candles before the forward start
are used only to warm indicators.

## Immutable Boundary

- Frozen at: `2026-07-29T00:00:00.000Z`
- First eligible signal bar: `2026-07-30T00:00:00.000Z`
- Definition:
  `research/strategy-candidates/us-forward-hybrid-v2.json`
- Definition hash:
  `sha256:3eb1b8a7fd0784c02e9fc2b485e373f2a8f42904ca62885c10baf91b8af75719`
- Ledger:
  `research/forward/us-forward-hybrid-v2-ledger.json`

Changing any strategy, execution, universe, or promotion parameter changes the
hash and requires a new candidate ID and a new forward start. Existing events
must never be rewritten or migrated into the new candidate.

## Evaluation Design

The frozen control and candidate run concurrently against future completed
daily bars. A signal is issued only after a completed bar. Entry uses the next
strictly later regular-session open. Stop, target, and time exits use only bars
at or after entry. When stop and target occur in the same bar, stop is applied
first.

Every event is bound to the candidate hash and an SHA-256 previous-event hash.
The collector verifies the complete chain before appending new events. A
modified definition or event causes the run to fail before evidence is written.

## Promotion Gate

The candidate remains `COLLECTING` until all minimum evidence exists:

- At least 180 calendar days
- At least 200 resolved candidate trades
- At least 200 resolved control trades
- Candidate expectancy at least 0.05R
- Incremental expectancy at least 0.05R
- Incremental expectancy bootstrap 95% lower bound above zero
- Maximum drawdown no more than 15%
- Positive evidence in at least three regimes with 20 trades per regime
- Measured execution costs rather than modeled slippage

After the sample matures, a failed statistical or risk gate produces `BLOCK`.
Passing all gates produces `PAPER_ELIGIBLE`, not authorization for real-money
trading.

## Operations

Run the collector locally:

```bash
npm.cmd run forward:collect
```

The scheduled GitHub workflow runs after the US session on weekdays, verifies
the candidate and quality gates, then commits only the ledger and public
evidence artifact. The current status is visible in Backtest Simulator.

This is educational research evidence, not personal investment advice.
