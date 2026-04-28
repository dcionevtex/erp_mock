# Architecture Research: VTEX OMS ERP Demo Console

**Researched:** 2026-04-28
**Confidence:** HIGH (Next.js App Router and Vercel compute behavior verified via official docs; VTEX API knowledge from training data — MEDIUM confidence on exact endpoint shapes)

---

## Component Map

Six major components, each with a single responsibility and a clean boundary.

```
src/
  lib/
    vtexClient.ts       — All outbound VTEX API calls
    erpSimulator.ts     — Order normalization + ERP acceptance simulation
    orderProcessor.ts   — Orchestration: event → full pipeline
    store.ts            — In-memory singleton state (orders + events)
    deduplicator.ts     — Idempotency key management
    piiMasker.ts        — PII masking utilities
    constants.ts        — VTEX endpoint paths, status enums
  app/
    api/
      vtex/
        hook/route.ts
        feed/poll/route.ts
        orders/[orderId]/start-handling/route.ts
      erp/
        orders/route.ts
        orders/[orderId]/route.ts
        orders/[orderId]/reprocess/route.ts
        orders/[orderId]/retry-start-handling/route.ts
        orders/[orderId]/resolve/route.ts
    (dashboard)/
      page.tsx            — Server component shell
      layout.tsx
    components/
      OrdersInbox.tsx     — "use client" — polling + filter + table
      OrderAccordion.tsx  — "use client" — expandable row
      ConfigPanel.tsx     — "use client" — settings form
      EventLog.tsx        — "use client" — debug view
      PollButton.tsx      — "use client" — triggers feed poll
  types/
    index.ts              — ErpOrderRecord, ErpStatus, all shared types
```

### Responsibility Summary

| Component | Responsibility | Has Side Effects? |
|-----------|---------------|-------------------|
| `vtexClient.ts` | HTTP calls to VTEX (getOrder, getFeedItems, commitFeedItems, startHandling) | Yes — outbound HTTP |
| `erpSimulator.ts` | Normalize VTEX order → ErpOrderPayload, simulate accept/reject | No — pure + configurable |
| `orderProcessor.ts` | Chain: getOrder → normalize → simulate → startHandling → store | Yes — calls all others |
| `store.ts` | Module-level singleton Map for orders + event log | Yes — mutable state |
| `deduplicator.ts` | Idempotency key generation + seen-set membership | Yes — mutates seen Set |
| `piiMasker.ts` | email/document masking functions | No — pure |

---

## Data Flow

### Hook Path (push from VTEX)

```
VTEX POST → /api/vtex/hook
  1. Parse body: extract orderId, state, eventId, timestamp
  2. Validate payload shape (zod or manual guard)
  3. Optional: validate x-demo-hook-secret header
  4. Build idempotency key: eventId ?? (orderId + state + timestamp)
  5. deduplicator.hasProcessed(key)?
       YES → log DUPLICATE_IGNORED to event log, return 200
       NO  → deduplicator.markProcessed(key)
  6. store.upsertOrder({ orderId, source: "HOOK", erpStatus: "RECEIVED" })
  7. store.appendTimeline(orderId, "Event received", SUCCESS)
  8. orderProcessor.process(orderId, source)  ← async, but awaited before response
  9. Return 200 { received: true, orderId }
```

### Feed Path (pull triggered by user)

```
User click → POST /api/vtex/feed/poll
  1. vtexClient.getFeedItems()
  2. For each item in response:
     a. Build idempotency key from item.eventId or (orderId + state + createdAt)
     b. deduplicator.hasProcessed(key)? → skip
     c. store.upsertOrder({ orderId, source: "FEED", erpStatus: "RECEIVED" })
     d. orderProcessor.process(orderId, "FEED")
     e. If AUTO_COMMIT_FEED=true → vtexClient.commitFeedItems([item.handle])
  3. Return 200 { processed: N, skipped: M }
```

### orderProcessor.process(orderId, source)

```
  1. store.setStatus(orderId, "PROCESSING")
  2. vtexClient.getOrder(orderId)
       ERROR → store.setStatus(orderId, "ERROR"), appendTimeline("Get Order failed", ERROR), STOP
  3. appendTimeline("Get Order success", SUCCESS)
  4. erpSimulator.normalize(vtexOrder) → ErpOrderPayload
  5. appendTimeline("ERP payload normalized", SUCCESS)
  6. erpSimulator.simulate(erpPayload)
       FAILURE → store.setStatus(orderId, "ERROR"), appendTimeline("ERP rejected", ERROR), STOP
  7. store.setStatus(orderId, "ERP_ACCEPTED")
  8. appendTimeline("ERP accepted", SUCCESS)
  9. vtexClient.startHandling(orderId)
       ERROR → store.setStatus(orderId, "START_HANDLING_ERROR"), appendTimeline("Start Handling failed", ERROR), STOP
  10. store.setStatus(orderId, "START_HANDLING_SUCCESS")
  11. appendTimeline("Start Handling success", SUCCESS)
```

Guards enforced by orderProcessor:
- If getOrder fails → startHandling is never called (early return at step 2)
- If ERP simulation fails → startHandling is never called (early return at step 6)
- These guards are unit-testable in isolation

---

## Module Boundaries

### `store.ts` — In-Memory Singleton

```typescript
// Module-level variables — live for the duration of the warm instance
const orders = new Map<string, ErpOrderRecord>();
const eventLog: EventLogEntry[] = [];
const processedKeys = new Set<string>();

export const store = {
  upsertOrder,
  getOrder,
  getAllOrders,
  setStatus,
  appendTimeline,
  addEventLog,
};
```

Interface contract: all mutation goes through `store.*` functions. No component touches `orders` Map directly. This is the single seam for future persistence replacement — swap the Map for a Vercel KV client without touching any caller.

### `vtexClient.ts` — VTEX HTTP Client

```typescript
export interface VtexClient {
  getOrder(orderId: string): Promise<VtexOrder>;
  getFeedItems(): Promise<FeedItem[]>;
  commitFeedItems(handles: string[]): Promise<void>;
  startHandling(orderId: string): Promise<void>;
}
```

Reads credentials from `process.env` (VTEX_ACCOUNT, VTEX_APP_KEY, VTEX_APP_TOKEN, VTEX_ENVIRONMENT). Never accepts credentials as function arguments — prevents accidental exposure via logs. Base URL: `https://{account}.{environment}/api/oms/pvt/`. All errors thrown as typed `VtexApiError` with status code, so `orderProcessor` can distinguish 404 vs 429 vs 401.

### `erpSimulator.ts` — Pure Transform + Configurable Simulator

```typescript
export function normalize(vtexOrder: VtexOrder): ErpOrderPayload;  // pure
export function simulate(payload: ErpOrderPayload): ErpSimResult;  // reads SIMULATE_ERP_FAILURE env
```

`normalize` is a pure function — ideal for unit testing. `simulate` reads the `SIMULATE_ERP_FAILURE` environment variable (or an in-memory config flag toggled by the Config Panel). The in-memory config flag approach is preferred for the demo because it allows toggling without redeployment.

### `deduplicator.ts`

```typescript
export function buildKey(event: RawEvent): string;
export function hasProcessed(key: string): boolean;
export function markProcessed(key: string): void;
```

Backed by `processedKeys` Set inside `store.ts` (or a dedicated module-scoped Set). The Set is memory-resident: works correctly within a warm instance, resets on cold start. For a demo tool this is acceptable — document clearly.

### `piiMasker.ts`

```typescript
export function maskEmail(email: string): string;    // d***@domain.com
export function maskDocument(doc: string): string;   // ***456
```

Pure functions, no state, easily testable.

### `orderProcessor.ts` — Orchestrator

Owns the pipeline sequence. Takes a `VtexClient` and a `Store` as constructor/function arguments so unit tests can inject mocks. This is the most test-critical module.

---

## API Route Structure

All routes live under `app/api/`. Next.js App Router route files export named HTTP method functions.

### VTEX-Facing Routes (inbound from VTEX or triggered by user)

```
POST /api/vtex/hook
  File: app/api/vtex/hook/route.ts
  Dependencies: deduplicator, store, orderProcessor
  Returns: 200 { received: true, orderId } always (VTEX expects fast 200)
  Guard: validate x-demo-hook-secret if DEMO_HOOK_SECRET env is set

POST /api/vtex/feed/poll
  File: app/api/vtex/feed/poll/route.ts
  Dependencies: vtexClient, deduplicator, store, orderProcessor
  Returns: 200 { processed: N, skipped: M, errors: [...] }
  Note: triggered manually by the UI, not by VTEX

POST /api/vtex/orders/[orderId]/start-handling
  File: app/api/vtex/orders/[orderId]/start-handling/route.ts
  Dependencies: vtexClient, store
  Used by: UI retry action
  Returns: 200 { success: true } | 200 { success: false, error: string }
  Note: idempotency guard — do not re-call if already START_HANDLING_SUCCESS
```

### ERP-Facing Routes (UI data endpoints)

```
GET /api/erp/orders
  File: app/api/erp/orders/route.ts
  Query params: source (FEED|HOOK|ALL), status, search, sort
  Returns: ErpOrderRecord[] (PII already masked)
  Used by: OrdersInbox client polling

GET /api/erp/orders/[orderId]
  File: app/api/erp/orders/[orderId]/route.ts
  Returns: single ErpOrderRecord with full vtexOrderRaw + erpPayload

POST /api/erp/orders/[orderId]/reprocess
  File: app/api/erp/orders/[orderId]/reprocess/route.ts
  Resets status to RECEIVED, re-runs orderProcessor.process()

POST /api/erp/orders/[orderId]/retry-start-handling
  File: app/api/erp/orders/[orderId]/retry-start-handling/route.ts
  Calls vtexClient.startHandling() again regardless of current status

POST /api/erp/orders/[orderId]/resolve
  File: app/api/erp/orders/[orderId]/resolve/route.ts
  Sets erpStatus to MANUALLY_RESOLVED
```

### Route Dependency Graph

```
hook/route         → orderProcessor → vtexClient, erpSimulator, store, deduplicator
feed/poll/route    → vtexClient, orderProcessor, store, deduplicator
start-handling     → vtexClient, store
erp/orders         → store (read-only)
erp/orders/[id]    → store (read-only)
reprocess          → orderProcessor, store
retry-sh           → vtexClient, store
resolve            → store
```

---

## In-Memory State Strategy

### How It Works on Vercel

**Verified from Vercel official docs (2026-04-10):** When a serverless function instance is warm (a "hot boot"), the underlying Node.js process is reused. Module-level variables — Maps, Sets, arrays declared at the top of a module — persist across requests hitting the same warm instance. Vercel explicitly documents this as a feature to exploit for caching and memoization.

**Cold start reality:** When a new instance is spun up (cold boot), module-level state initializes fresh. For a demo app with a single user/session running against a single Vercel region, this is acceptable. In practice, Vercel keeps at least one instance warm on paid plans (production deployments get pre-warmed instances). The typical demo workflow — one operator, one region — means state accumulates predictably within a session.

**The critical constraint:** Multiple concurrent instances do NOT share state. If Vercel scales to two instances (possible under concurrent load), the two instances have separate in-memory stores. For a demo tool with a single operator this is an edge case, but must be documented.

### Singleton Pattern

```typescript
// src/lib/store.ts
// Module-level singleton — initialized once per process lifetime
const orders = new Map<string, ErpOrderRecord>();
const eventLog: EventLogEntry[] = [];
const seenKeys = new Set<string>();

// Exported accessor — this is the entire public surface
export const store = { ... };
```

The singleton is created when the module is first imported. All API routes import from `store.ts`. Because Next.js bundles all route handlers that use the same modules into a single Vercel Function bundle, they share the same module instance in the same process.

**Why this works in Next.js specifically:** Next.js on Vercel bundles API route handlers together (per the Vercel docs: "dynamic code will be bundled into the fewest number of Vercel Functions possible"). This means `hook/route.ts`, `feed/poll/route.ts`, and `erp/orders/route.ts` all run in the same Node.js process and share the same `store.ts` singleton. This is the intended pattern for this type of demo.

### Persistence Seam

The seam for future replacement is the `store` interface. When persistence is needed:

```typescript
// Today:          Map<string, ErpOrderRecord>
// Future option A: Vercel KV (Redis-backed, serverless-safe)
// Future option B: Supabase Postgres with connection pooling
// Future option C: PlanetScale / Neon serverless Postgres

// The store.ts interface does not change — only the implementation
```

Document in code: `// NOTE: In-memory store. Not shared across Vercel instances. Replace with Vercel KV for production.`

### Config State

The Configuration Panel (VTEX account, app key, app token, integration mode, ERP failure toggle) can store its state in the same module-level singleton:

```typescript
// store.ts addition
let config: AppConfig = {
  account: process.env.VTEX_ACCOUNT ?? '',
  environment: process.env.VTEX_ENVIRONMENT ?? 'vtexcommercestable.com.br',
  appKey: process.env.VTEX_APP_KEY ?? '',
  appToken: process.env.VTEX_APP_TOKEN ?? '',  // never exposed in GET responses
  simulateErpFailure: process.env.SIMULATE_ERP_FAILURE === 'true',
  autoCommitFeed: process.env.AUTO_COMMIT_FEED === 'true',
  integrationMode: 'HOOK',
};
```

Env vars provide the deploy-time default. UI config overrides the in-memory value at runtime. On cold start, env vars win again — correct for demo use.

---

## UI Architecture

### App Router Structure

```
app/
  layout.tsx          — Root layout: fonts, global styles, nav shell
  page.tsx            — Redirects to /dashboard (server component, 1 line)
  dashboard/
    page.tsx          — Server component: renders shell + passes no props
    layout.tsx        — (optional) dashboard-specific nav
  components/
    OrdersInbox.tsx   — "use client"
    OrderAccordion.tsx — "use client"
    ConfigPanel.tsx   — "use client"
    EventLog.tsx      — "use client"
    PollButton.tsx    — "use client"
    StatusBadge.tsx   — "use client" or shared RSC-safe
```

### Server vs Client Component Decision

The dashboard has no server-rendered data benefit — it polls a local API and shows live state. Almost everything should be a Client Component.

| Component | Type | Reason |
|-----------|------|--------|
| `app/layout.tsx` | Server Component | Static shell, no interactivity |
| `app/dashboard/page.tsx` | Server Component | Thin wrapper only — renders `<OrdersInbox />` |
| `OrdersInbox.tsx` | Client Component | Needs polling, filter state, search state |
| `OrderAccordion.tsx` | Client Component | Expand/collapse state, copy actions |
| `ConfigPanel.tsx` | Client Component | Form state, POST to config endpoint |
| `EventLog.tsx` | Client Component | Polling, filter state |
| `PollButton.tsx` | Client Component | onClick triggers POST |

**Avoid the trap of over-using Server Components here.** The data is live and changes with every order event. Server Components with ISR would be stale by design. Use Client Components with `setInterval` polling against `GET /api/erp/orders`.

### Client Polling Pattern

```typescript
// OrdersInbox.tsx
'use client';

export function OrdersInbox() {
  const [orders, setOrders] = useState<ErpOrderRecord[]>([]);
  const [filters, setFilters] = useState<Filters>({ source: 'ALL', status: 'ALL', search: '' });

  useEffect(() => {
    const fetchOrders = async () => {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/erp/orders?${params}`);
      const data = await res.json();
      setOrders(data);
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);  // poll every 3 seconds
    return () => clearInterval(interval);
  }, [filters]);

  // render...
}
```

3-second polling is adequate for a demo. The interval clears on unmount. Filter changes trigger an immediate refetch plus restart the interval.

### Route Segment Config for API Routes

API routes that write to or read from the in-memory store must be marked dynamic to prevent Next.js from statically caching them:

```typescript
// app/api/erp/orders/route.ts
export const dynamic = 'force-dynamic';
```

Without this, Next.js 15 may cache GET responses at build time. All API routes in this app should export `dynamic = 'force-dynamic'`.

### Config Panel → API Pattern

The Config Panel POSTs to `POST /api/config` which updates the in-memory config object in `store.ts`. It never sends appToken in GET responses — only a masked indicator (`"configured"` | `"not set"`).

---

## Build Order

This is the phase dependency graph. Each phase can only start when its dependencies are complete.

### Phase 1 — Foundation (no dependencies)
**What:** Project scaffold, TypeScript config, shared types, constants, env wiring

- `npx create-next-app@latest` with TypeScript + Tailwind + App Router
- `src/types/index.ts` — all shared types: `ErpOrderRecord`, `ErpStatus`, `IntegrationSource`, `ErpOrderPayload`, `VtexOrder`, `FeedItem`, timeline types
- `src/lib/constants.ts` — VTEX endpoint paths, default environment, status enums
- `.env.example` — all required env vars

**Why first:** Every other module imports from `types/index.ts`. Types must be stable before any implementation. No circular dependencies possible if types are defined before implementations.

### Phase 2 — Core Library Modules (depends on Phase 1)
**What:** The four pure/near-pure library modules

Build in this order within Phase 2 (each depends on the previous being type-stable):

1. `src/lib/piiMasker.ts` — pure functions, zero dependencies except types
2. `src/lib/deduplicator.ts` — depends on types only
3. `src/lib/store.ts` — depends on types; `deduplicator` can be embedded here or imported
4. `src/lib/erpSimulator.ts` — depends on types, piiMasker; normalize() is pure and testable immediately
5. `src/lib/vtexClient.ts` — depends on types, constants; all VTEX HTTP calls

**Why before API routes:** API routes are thin orchestration wrappers. They cannot be written or tested until the modules they call exist.

### Phase 3 — Orchestration (depends on Phase 2)
**What:** `orderProcessor.ts` — the pipeline that chains all Phase 2 modules

- Implements the get → normalize → simulate → startHandling chain
- Enforces the Start Handling guards
- Writes timeline entries to store
- All three guard conditions (getOrder fail, ERP fail, startHandling fail) are implemented here

**Why separate phase:** `orderProcessor.ts` imports from all Phase 2 modules. It is the most complex module and the one that carries the most business logic. It deserves a dedicated step with unit tests before any HTTP surface is built around it.

### Phase 4 — API Routes (depends on Phases 2 + 3)
**What:** All route handlers under `app/api/`

Build order within Phase 4:
1. `POST /api/vtex/hook` — first route to test the full pipeline end-to-end
2. `GET /api/erp/orders` + `GET /api/erp/orders/[orderId]` — needed before UI can show anything
3. `POST /api/vtex/feed/poll` — adds Feed path
4. `POST /api/vtex/orders/[orderId]/start-handling` — manual retry surface
5. `POST /api/erp/orders/[orderId]/reprocess` + `/retry-start-handling` + `/resolve` — action endpoints

**Why hook before feed:** Hook is simpler (single event, no loop, no commit). Getting the pipeline working end-to-end via Hook before adding Feed loop complexity reduces debugging surface.

### Phase 5 — UI Dashboard (depends on Phase 4)
**What:** All client components and dashboard page

Build order within Phase 5:
1. `ConfigPanel.tsx` — needed to configure VTEX credentials before any live data can flow
2. `PollButton.tsx` — simple, enables manual feed trigger
3. `OrdersInbox.tsx` (table without accordion) — shows orders are flowing
4. `OrderAccordion.tsx` — detailed order view, highest UI complexity
5. `EventLog.tsx` — secondary debug view, lowest priority

**Why config first in UI:** Without configured credentials, no live VTEX call works. The config panel is the prerequisite for any end-to-end demo validation.

### Phase 6 — Tests (can run in parallel with Phase 5)
**What:** Unit tests for the core library modules

Test priority order:
1. `piiMasker` — pure, trivial to test, high confidence
2. `erpSimulator.normalize` — pure, most important for demo correctness
3. `deduplicator` — tests idempotency logic
4. `orderProcessor` — mock vtexClient and store; tests all three guards
5. `vtexClient` — integration-level, use nock or msw for HTTP mocking

### Dependency Graph Summary

```
Phase 1: types + constants + env
    ↓
Phase 2: piiMasker → deduplicator → store → erpSimulator → vtexClient
    ↓
Phase 3: orderProcessor
    ↓
Phase 4: API routes (hook first, then read endpoints, then feed, then actions)
    ↓
Phase 5: UI (config → poll button → inbox → accordion → event log)

Phase 6: Tests (run alongside Phase 5, targeting Phases 2-3)
```

Critical path for a working demo: Phase 1 → 2 → 3 → 4 (hook + GET orders) → 5 (config + inbox). Everything else is enhancement.

---

## Key Architecture Decisions and Rationale

### 1. Single `orderProcessor.ts` orchestrator rather than inline route logic
Routes are thin by design. All business logic lives in `orderProcessor.ts`. This makes the pipeline testable without HTTP and ensures Feed and Hook share identical processing behavior.

### 2. `dynamic = 'force-dynamic'` on all API routes
Next.js 15 changed the default caching for GET handlers from static to dynamic (confirmed in Next.js 15 changelog), but explicit `force-dynamic` is defensive — prevents any caching layer from serving stale in-memory data.

### 3. Polling over WebSockets/SSE for the dashboard
WebSockets and Server-Sent Events require persistent connections which are not compatible with Vercel serverless functions (max 60s duration, stateless invocations). Polling every 3 seconds is correct for this architecture. For a demo tool used by one operator this is more than adequate.

### 4. `orderProcessor` accepts injected dependencies for testability
```typescript
export async function processOrder(
  orderId: string,
  source: IntegrationSource,
  deps: { vtex: VtexClient; store: Store } = defaultDeps
)
```
Default deps use the real singletons. Tests pass mocks. This avoids the need for module mocking libraries.

### 5. VTEX App Token never in GET responses
The `GET /api/config` response returns `appTokenConfigured: boolean`, never the token value. The token is write-only from the UI perspective.

---

## Sources

- Next.js Route Handlers official docs: https://nextjs.org/docs/app/api-reference/file-conventions/route (version 16.2.4, updated 2026-04-10) — HIGH confidence
- Vercel Compute / cold and hot boots: https://vercel.com/docs/fundamentals/what-is-compute (confirmed warm instance state persistence) — HIGH confidence
- Vercel Runtimes: https://vercel.com/docs/functions/runtimes (confirmed Next.js bundles routes into fewest functions) — HIGH confidence
- Next.js ISR / `dynamic = 'force-dynamic'`: https://nextjs.org/docs/app/guides/incremental-static-regeneration (version 16.2.4, updated 2026-04-10) — HIGH confidence
- VTEX Feed/Hook API shapes and Start Handling endpoint: training data (VTEX developers.vtex.com — WebFetch permission denied) — MEDIUM confidence, verify exact payload field names during implementation
