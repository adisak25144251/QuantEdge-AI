# QuantEdge AI Agent Guide

This file is the operating guide for coding agents working on QuantEdge AI.
Follow it for every change, especially before publishing to GitHub or Vercel.

## Product Scope

QuantEdge AI is a Thai-first web application for educational market analysis,
watchlists, technical chart review, paper trading, risk management, and trade
journaling. It must not present outputs as guaranteed profits or personalized
investment advice.

Core areas:

- Crypto and US stock chart analysis
- US Stock Screener Analyst
- AI Bottleneck Screener
- TradingView real-chart integration
- Paper trade journal and analytics
- Firebase Google login and per-user saved data
- Production readiness, risk controls, and auditability

## Safety Rules

- Never add real order execution without a separate audited approval workflow.
- Keep all trading language conditional: watchlist, educational, no chase,
  wait confirmation, risk/reward, stop-loss, invalidation.
- Do not guarantee profit, win rate, or future price movement.
- If market data is missing, stale, or inconsistent, show `Data required`
  instead of inventing values.
- Do not use a local chart as a silent replacement for TradingView when the
  product setting requires real TradingView charts.
- Keep API keys and secrets out of client code and out of Git.

## Architecture

- Frontend: React 19, Vite, TypeScript, Tailwind CSS
- Backend/dev server: Express in `server.ts`
- Auth/data: Firebase Auth and Firestore helpers in `src/lib`
- Domain logic: pure TypeScript modules in `src/domain`
- UI components: `src/components`
- Production static deploy target: Vercel `dist`

Important files:

- `src/App.tsx`: main app shell, routing state, chart analysis workflow
- `src/components/TradingViewWidget.tsx`: official TradingView iframe widget
- `src/components/USStockScreenerAnalyst.tsx`: US stock screener UI
- `src/components/AIBottleneckScreenerAnalyst.tsx`: AI Bottleneck screener UI
- `server.ts`: API proxy, CSP/security headers, metrics, rate limiting
- `firestore.rules`: Firestore access policy
- `vercel.json`: Vercel build, SPA rewrite, production security headers

## Required Commands

Run these before saying a change is ready:

```bash
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Use the Windows `npm.cmd` form in this workspace.

## Development Server

```bash
npm.cmd run dev
```

Default URL:

```text
http://localhost:3000/
```

If the landing page appears, launch the app with the Thai launch button before
testing the dashboard.

## Browser QA Checklist

Before mobile or production release, click-test:

- Launch app
- Dashboard
- Chart analysis
- Alerts
- Journal
- Analytics dashboard
- Market Screener
- US Stock Screener
- AI Bottleneck
- Backtest Simulator
- Trading plan modal open/close
- TradingView retry and open-in-TradingView links
- Google login button behavior
- Floating AI Trading Copilot open/close

For screener-to-chart flows:

- Pick a US stock ticker from US Stock Screener
- Confirm it opens the chart analysis page
- Confirm TradingView receives an exchange-qualified symbol such as
  `NASDAQ:OUST`
- Confirm the right-side analysis panel is not blank
- Repeat for AI Bottleneck

For mobile readiness:

- Test at 390x844 and 430x932 viewport sizes
- Confirm sidebar/navigation is usable
- Confirm TradingView area is visible and scrollable
- Confirm tables do not break the page horizontally in an unusable way

## TradingView Rules

TradingView is the official chart source for live chart review.

- Primary endpoint: `www.tradingview-widget.com`
- Fallback endpoint: `s.tradingview.com`
- External manual fallback: `www.tradingview.com/chart`
- Production CSP must allow:
  - `www.tradingview-widget.com`
  - `s.tradingview.com`
  - `s3.tradingview.com`
  - `www.tradingview.com`
  - `*.tradingview.com`
  - `*.tradingview-widget.com`

If TradingView is blocked by an in-app browser, ad blocker, VPN, DNS filter, or
mobile shield, show a clear message and provide retry plus open-in-TradingView.

## Firebase Login Rules

Google login requires Firebase Console configuration:

- Enable Google provider
- Add `localhost` for local testing
- Add the Vercel production domain
- Add any custom domain

The app must show user-visible feedback for popup blocked, unauthorized domain,
network/internal auth errors, and redirect fallback. Do not let login fail
silently.

## Data And API Rules

- Server API routes must be rate limited.
- Market data proxy failures must return structured errors.
- Do not expose upstream provider API keys in the browser.
- Cache market responses for a short TTL where appropriate.
- Keep observability endpoints safe and non-sensitive.

## Testing Rules

- Add or update unit tests for domain logic changes.
- Prefer deterministic fixtures over live network calls.
- For UI-only changes, run lint/build and browser smoke tests.
- For risk, scoring, or trading-plan changes, add tests for edge cases:
  missing data, stale data, high RSI, extended price, invalid stop/target,
  allocation caps, and risk/reward calculations.

## Deployment Rules

Vercel deployment should use:

- Install: `npm ci`
- Build: `npm run build`
- Output: `dist`
- SPA rewrite: all routes to `/index.html`

GitHub Pages deployment uses `.github/workflows/github-pages.yml`.
It builds with `GITHUB_PAGES=true`, which sets the Vite base path to
`/QuantEdge-AI/`. The expected public URL is:

```text
https://adisak25144251.github.io/QuantEdge-AI/
```

After deployment:

- Open the production URL on desktop and mobile.
- Confirm TradingView chart loads or the official external fallback works.
- Confirm Google login works after adding the production domain to Firebase.
- Confirm API proxy endpoints are reachable if using the Express server
  deployment path. Static Vercel deployments only serve the frontend unless
  serverless/API routes are added.

## Git Rules

- Do not commit secrets, local logs, `node_modules`, or `dist` unless the user
  explicitly wants build artifacts committed.
- Use clear commit messages.
- Check status before committing.
- If the workspace is not already a Git repository, initialize it only when the
  user explicitly asks to push or publish.

Suggested commit message style:

```text
fix: improve tradingview mobile fallback
docs: add agent operating guide
chore: add vercel deployment config
```
