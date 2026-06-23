# CLAUDE.md

## Project: VTEX Demo Platform

A multi-simulator demo tool for VTEX Solution Engineers and SAs. Each simulator exposes real protocol-compliant endpoints and shows every request/response in a live dashboard. Built on Next.js 16, TypeScript, Tailwind CSS v4, Neon PostgreSQL, and Vercel.

**DO NOT OVER-ENGINEER. This is a demo tool — clarity and correctness beat abstraction.**

---

## 1. What This Platform Is Today

The launcher at `/` is the entry point. It links to four live simulators plus community field tools and The Lab (upcoming experimental utilities).

### Simulators

| Simulator | Path | Status | What it demonstrates |
|---|---|---|---|
| ERP Simulator | `/erp` | Live | OMS → ERP order handoff via Feed or Hook, Get Order, Start Handling, invoice, shipping label |
| Payment Provider Protocol | `/payment-provider` | Live | PPP endpoints (create, cancel, refund, settlement), account-scoped, scenario toggles |
| External Seller Simulator | `/marketplace` | Beta | Fulfillment simulation, order placement, cancellation, SKU registration via Change Notification + Suggestions flow |
| Gift Card Provider | `/gift-card` | Beta | Gift Card Provider Protocol endpoints, fictional card auto-return, transaction lifecycle |
| External IDP Simulator | `/idp` | New | OAuth 2.0 Authorization Code flow mock; VTEX storefronts authenticate against it via the Authentication admin |

### Shared platform features

- **Google OAuth SSO** — NextAuth v5, @vtex.com emails only, configured in `src/auth.ts`
- **Neon PostgreSQL** — Optional persistence via `DATABASE_URL`. Falls back to globalThis in-memory store without it. `src/lib/db.ts` is the abstraction layer.
- **Account-scoped isolation** — PPP, Marketplace, and Gift Card simulators namespace all state by VTEX account name. Each account gets its own URL and call log.
- **VTEX Platform Status carousel** — Homepage fetches status.vtex.com and surfaces active incidents.

---

## 2. Architecture Patterns

Follow these patterns when adding features or new simulators.

### 2.1 Account-scoped simulator pattern

PPP, Marketplace, and Gift Card all follow the same pattern:

```
src/types/[simulator].ts          — types for the protocol
src/lib/[simulator]Store.ts       — in-memory state keyed by account name
src/lib/[simulator]Handlers.ts    — business logic, protocol responses
src/app/api/[simulator]/[account]/config/route.ts   — GET config for account
src/app/api/[simulator]/[account]/calls/route.ts    — GET call log
src/app/api/[simulator]/[account]/[...protocol routes]
src/app/[simulator]/page.tsx      — 'use client' dashboard, stores account in localStorage
```

Each store module exports:
- `getState(account: string)` — returns account-specific state (creates if missing)
- `clearState(account: string)` — resets state for an account
- `recordCall(account, call)` — appends to the call log

Each dashboard page:
- Reads account name from localStorage on mount
- Derives the simulator URL from `window.location.origin + /api/[simulator]/${account}`
- Shows the URL in a copy-able field so VTEX can be pointed at it
- Has a live call log that polls the calls endpoint
- Has scenario toggles that update store state

### 2.2 ERP simulator pattern

Different from the others — it's VTEX-credential-aware, not account-scoped in the same way.

- Credentials set via ConfigPanel (`src/components/ConfigPanel.tsx`) and stored in session via `src/lib/store.ts` (`setServerSecrets`)
- `src/lib/vtexClient.ts` calls VTEX APIs using those credentials
- Orders flow: Hook/Feed → `src/lib/orderProcessor.ts` → `src/lib/erpSimulator.ts` → store
- `src/lib/db.ts` persists orders to Neon if `DATABASE_URL` is set

### 2.3 Adding a new simulator

1. Add types to `src/types/[simulator].ts`
2. Create `src/lib/[simulator]Store.ts` with account-keyed state and call recorder
3. Create `src/lib/[simulator]Handlers.ts` with protocol response logic
4. Create API routes under `src/app/api/[simulator]/[account]/`
5. Create dashboard at `src/app/[simulator]/page.tsx`
6. Add the tool card to the `TOOLS` array in `src/app/page.tsx`
7. Add the simulator tag to the release notes types in `src/app/release-notes/page.tsx`

### 2.4 Call log pattern

Every simulator records incoming VTEX calls. The call object shape:

```ts
{
  id: string;
  timestamp: string;
  method: string;
  path: string;
  requestBody?: unknown;
  responseBody?: unknown;
  statusCode: number;
}
```

Render it in the dashboard using a live-polling table with request/response inspector (collapsible).

---

## 3. Key Files

```
src/auth.ts                     — NextAuth config (Google, @vtex.com guard)
src/lib/config.ts               — Server-side config builder (env → override → secrets)
src/lib/db.ts                   — Neon PostgreSQL abstraction
src/lib/store.ts                — GlobalThis in-memory store (ERP orders, events, secrets)
src/lib/vtexClient.ts           — VTEX API client (getOrder, feed, startHandling)
src/lib/erpSimulator.ts         — ERP payload normalizer
src/lib/orderProcessor.ts       — Full ERP order processing pipeline
src/lib/piiMasker.ts            — PII masking at ingestion time
src/lib/deduplicator.ts         — Feed event deduplication
src/app/page.tsx                — Launcher homepage (TOOLS, FIELD_TOOLS, LAB_APPS)
src/app/release-notes/page.tsx  — RELEASES array with full changelog
src/components/Sidebar.tsx      — ERP simulator navigation sidebar
src/components/OrderRow.tsx     — Expandable order accordion with all actions
src/components/DanfeSheet.tsx   — Printable electronic invoice (NF-e format)
```

---

## 4. Security and Data Handling

- **Never log or expose `appToken`**. The `ServerAppConfig` internal type contains it; it must not appear in exported types, logs, or API responses.
- **PII masking at ingestion** — `src/lib/piiMasker.ts` runs at read time. Customer email and document are masked before storage.
- **Auth guard** — All pages except `/login` require a valid @vtex.com session. Middleware enforces this.
- **Hook endpoint** — Returns 200 immediately even without credentials to prevent VTEX retry storms.
- **No secrets in client bundles** — VTEX credentials never reach the browser.

---

## 5. Environment Variables

```env
# Required for ERP simulator (can be set via UI at runtime)
VTEX_ACCOUNT=
VTEX_ENVIRONMENT=vtexcommercestable.com.br
VTEX_APP_KEY=
VTEX_APP_TOKEN=

# Required for auth
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Optional — enables persistent storage
DATABASE_URL=

# Optional — ERP simulator behavior defaults
AUTO_COMMIT_FEED=false
SIMULATE_ERP_FAILURE=false
```

Without `DATABASE_URL`, the app runs fully in-memory. This is fine for demos but resets on cold starts.

---

## 6. ERP Simulator: Key Flows

### Hook flow
```
POST /api/vtex/hook → ack 200 immediately → process async
  → parse payload (hookParser.ts)
  → deduplicate (deduplicator.ts)
  → getOrder (vtexClient.ts)
  → normalize (erpSimulator.ts)
  → simulate ERP acceptance
  → startHandling (vtexClient.ts) — only if ERP accepted
  → persist to store/db
```

### Feed flow
```
POST /api/vtex/feed/poll → acquire module-level lock
  → getFeedItems (vtexClient.ts)
  → for each: deduplicate → getOrder → normalize → ERP acceptance → startHandling
  → commitFeedItems if AUTO_COMMIT_FEED=true
```

### Start Handling rules
- Called ONLY after ERP simulation returns SUCCESS
- If Get Order fails → no Start Handling
- If ERP simulation fails → no Start Handling
- User can manually retry from the order accordion

---

## 7. Payment Provider Protocol

Implements the VTEX PPP spec. All routes are under `/api/payment-provider/[account]/`.

Required endpoints implemented:
- `GET manifest` — capabilities declaration
- `POST payments` — create payment intent
- `GET payments/[paymentId]` — get payment status
- `POST payments/[paymentId]/cancellations` — cancel
- `POST payments/[paymentId]/refunds` — refund
- `GET payments/[paymentId]/settlements` — settlements

Scenario toggle on the dashboard controls approve vs. deny behavior. VTEX calls these endpoints during checkout — the demo shows every call in the inspector.

---

## 8. External Seller Simulator

Implements the VTEX External Seller Fulfillment Protocol. Routes under `/api/marketplace/[account]/`.

Required endpoints:
- `POST pvt/orderForms/simulation` — checkout simulation (stock, price, SLAs)
- `POST pvt/orders` — order placement (returns array response)
- `POST pvt/orders/[orderId]/cancel` — cancellation
- `POST pvt/orders/[orderId]/fulfill` — fulfillment confirmation

Catalog registration flow (Catalog tab):
1. Change Notification → `POST /api/marketplace/[account]/change-notification`
2. If 404 → send SKU Suggestion automatically → `POST /api/marketplace/[account]/suggest-sku`
3. Step-by-step result panel shows each call with its VTEX response

VTEX Suggestions API base URL: `api.vtex.com` (not `vtexcommercestable.com.br`).

---

## 9. Gift Card Provider

Implements the VTEX Gift Card Provider Protocol. Routes under `/api/gift-card/[account]/`.

Key behavior:
- Any customer email at checkout returns a fictional gift card with configurable balance (default 9999)
- The hub endpoint (`GET hub`) is the registration endpoint VTEX calls to find the provider
- Scenario toggle: return card (approved) vs. return empty (no cards)
- Transaction lifecycle: search → get card → debit → settle

---

## 10. Release Management

Every meaningful set of changes must add an entry to the `RELEASES` array in `src/app/release-notes/page.tsx`.

Version rules:
- `PATCH` (x.x.+1) — bug fixes, small improvements to existing features
- `MINOR` (x.+1.0) — new self-contained features or significant UX changes
- `MAJOR` (+1.0.0) — new simulator or full architectural redesign

Simulator tags available: `'platform' | 'erp' | 'ppp' | 'marketplace' | 'giftcard' | 'idp'`

How to update:
1. Remove `tag: 'latest'` from the previous top entry
2. Prepend a new entry with new version, today's date, `tag: 'latest'`, correct simulators, and changes
3. Commit: `chore: update release notes to vX.Y.Z`

**Current baseline: `1.6.0`**

---

## 11. What Is Out of Scope

Do not build these unless explicitly requested:

- CI/CD pipeline
- RBAC beyond the @vtex.com guard
- Real outbound ERP API integration
- Docker support
- Multi-tenant user accounts (each user runs their own demo session)
- Advanced retry queues with exponential backoff
- Audit trail beyond the existing call log and timeline
- Advanced observability platform

---

## 12. Development Notes

- `npm run dev` starts at localhost:3000
- `npm run build` must exit 0 before any PR
- `npm run test` runs Vitest — all tests must stay green
- Node.js >= 24.0.0 required
- App Router only — no Pages Router
- `params` must be awaited as a Promise in all dynamic segment routes (Next.js 15+ behavior)
- Hook route returns 200 even on credential failure — do not change this
- Feed poll uses a module-level lock with try/finally — do not remove the lock
- `getServerConfig()` must not be called inside `processOrder()` — config is injected via deps
