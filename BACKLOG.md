# Backlog

## UI / Design

- [x] `BL-001` **Apply VTEX brand guidelines to the frontend**
  Apply the official VTEX brand design system (colors, typography, spacing, components) across the entire dashboard UI to make the demo feel native to the VTEX ecosystem.

## Persistence

- [x] `BL-006` **Persist ERP Orders and Event Log across deployments / cold starts**
  Currently both the order inbox and the event log live in `globalThis` in-memory. Every Vercel cold start (new serverless instance) starts with an empty store — orders and events written by one invocation are invisible to the next.

  **Recommended solution: [Neon](https://neon.tech) (serverless Postgres) via Vercel Integration**

  Why Neon over the alternatives:
  | Option | Fit | Notes |
  |---|---|---|
  | **Neon (Vercel Postgres)** | ✅ Best | Free tier, 1-click Vercel integration, SQL for filter/sort/search, JSON columns for timeline & payload |
  | Upstash Redis / Vercel KV | OK | Good for simple key-value, but querying orders (filter by status, search by customer) gets ugly fast |
  | Supabase | OK | Also Postgres, great free tier, but requires a separate account and more setup steps |
  | PlanetScale (MySQL) | ❌ | No free tier anymore |

  **Implementation scope:**
  - Add Neon integration in Vercel dashboard → `DATABASE_URL` env var is injected automatically
  - Replace `src/lib/store.ts` in-memory Maps with Postgres queries using `@neondatabase/serverless` (no ORM needed for this data model)
  - Two tables: `erp_orders` (JSONB column for timeline + payload) and `event_log`
  - All existing API routes stay the same — only the store module changes
  - Add `DATABASE_URL=` to `.env.example`
  - Keep the in-memory store as a fallback when `DATABASE_URL` is not set (local dev with no DB)

## Order Details

- [ ] `BL-007` **Shipping label mockup in order accordion**
  Inside the order detail accordion, show a simulated shipping label preview that an ERP operator can use to see dispatch info at a glance and print. Label must include: From (VTEX account), To (customer name + masked contact), SLA/carrier, order fields, a real CODE128 barcode generated from the orderId, and a Print button that opens a print-ready 4×6in label in a new window.

## Feed Polling

- [ ] `BL-002` **Poll Feed modal with live status**
  When the user clicks "Poll Feed Now", open a modal showing real-time progress of the polling run — items found, each orderId being processed, ERP result, Start Handling result, and a final summary (processed / skipped / errors). Modal closes manually or auto-closes on success.

## Configuration Panel

- [x] `BL-005` **Persist configuration across Vercel cold starts using an encrypted cookie**
  Currently all config entered via the UI is stored in server memory and lost on every cold start / new serverless invocation. Fix by persisting the config as an **encrypted HttpOnly cookie** using `iron-session`. Non-secret fields (account, environment, mode) and the App Key are stored as-is; the App Token is encrypted with a server-side `SESSION_SECRET` env var. On every request the server reads the cookie and decrypts it — no external service (no Vercel KV) required, zero infra cost, and the App Token is never exposed in plaintext in the browser.
  **Approach:** `npm i iron-session` → wrap POST /api/config to write a sealed cookie → wrap GET /api/config and all VTEX-calling routes to read it → add `SESSION_SECRET` to `.env.example` and Vercel env vars.

- [x] `BL-003` **App Key does not need to be masked**
  The App Key is not a secret — it can be displayed in plain text in the UI. Only the App Token must remain hidden.

- [x] `BL-004` **Show the stored App Key value next to the CONFIGURED badge**
  After an App Key is saved, display it alongside the "CONFIGURED" indicator (e.g. `CONFIGURED · vtexappkey-mystore-XXXXX`) so the operator can confirm which key is active. The App Token must continue to show only "CONFIGURED" with no value revealed.
