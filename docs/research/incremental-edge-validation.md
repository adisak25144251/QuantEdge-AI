# Incremental Edge Validation

## Decision

The current `HYBRID_BOOK_ENSEMBLE_V1` is **BLOCKED**. It must not replace the
US stock screener baseline and must not be promoted to real-money use.

This decision is based on measured historical evidence, not on whether the
hybrid strategy has a higher headline win rate.

## Reproducible Command

```powershell
npm.cmd run experiment:incremental-edge
```

The command:

1. Downloads adjusted daily candles for the current 20-symbol US research
   universe and SPY.
2. Evaluates the frozen baseline and hybrid definitions on the same data.
3. Uses completed-bar signals and next-bar-open entries.
4. Applies fees and liquidity/volatility-aware modeled slippage.
5. Produces five chronological out-of-sample windows.
6. Calculates precision, expectancy, max drawdown, regime metrics, and
   deterministic bootstrap 95% confidence intervals.
7. Writes a run-specific artifact under `artifacts/strategy-experiments/`.
8. Publishes the latest bounded summary to
   `public/evidence/incremental-edge-latest.json`.

## Strategy Definitions

### Baseline

Long-only 20-day breakout with all of the following:

- Price above SMA20 and SMA50.
- RSI14 between 50 and 75.
- Relative volume above 1.5.
- Signal evaluated after the daily candle closes.
- Entry at the next daily open.

### Hybrid

The baseline setup plus at least two independent confirmation votes:

- SMA50 above SMA200.
- 63-day return stronger than SPY.
- ATR14 no more than 1.15 times ATR50.
- Trending or ranging regime classification.

The concepts are research adaptations informed by the referenced systematic
and advanced algorithmic trading material. They are not represented as a
verbatim implementation of every strategy in the books.

References:

- https://github.com/zslucky/algorithmic_trading_book/blob/master/sat-ebook-20150618.pdf
- https://github.com/zslucky/algorithmic_trading_book/blob/master/aat-ebook-20170711.pdf
- https://github.com/zslucky/algorithmic_trading_book/tree/master/aat_source

## Latest Evidence

Run `edge-20260729000238-3f719e16` used 38,037 daily candles across 20 current
research symbols.

| Metric | Baseline | Hybrid |
| --- | ---: | ---: |
| Trades | 392 | 267 |
| Precision | 40.82% | 38.58% |
| Expectancy | 0.1231R | 0.0650R |
| Max drawdown | 14.07% | 18.34% |

Incremental expectancy was `-0.0581R`. Its deterministic bootstrap 95%
confidence interval was `-0.2755R` to `0.1450R`. Only 20% of eligible
walk-forward windows had positive incremental expectancy.

The hybrid therefore failed:

- Minimum incremental expectancy.
- Statistical stability.
- Walk-forward stability.
- Per-regime expectancy stability.

## Data Limitations

The latest run is additionally blocked because:

- The universe contains current research candidates rather than point-in-time
  historical constituents.
- Delisted securities are absent.
- Execution slippage is modeled rather than measured from paper or live fills.

These blockers prevent production promotion even if headline returns improve.

## Next Valid Experiment

Do not tune the hybrid against the same 2015-2026 evidence and call the result
out-of-sample. That would create data-snooping bias.

The next candidate must:

1. Receive a new immutable strategy version.
2. Be designed from an explicit hypothesis and frozen before evaluation.
3. Use a point-in-time universe containing delisted securities.
4. Reserve an untouched temporal holdout or future forward-paper period.
5. Collect at least 200 trades and 20 trades in at least three regimes.
6. Beat baseline expectancy by at least 0.05R with the 95% confidence lower
   bound above zero.
7. Keep max drawdown at or below 20% and no more than five percentage points
   worse than baseline.
8. Pass at least 70% of eligible walk-forward windows.

Until those gates pass, the product must continue showing the result as
`RESEARCH / BLOCK`.
