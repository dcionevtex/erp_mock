# Phase 3: API Routes - Research

**Researched:** 2026-04-28
**Domain:** Next.js 16 App Router route handlers + integration with existing lib modules
**Confidence:** HIGH

---

## Summary

Phase 3 wires seven Next.js route handlers to the already-complete pipeline infrastructure. Every non-trivial library function (processOrder, createVtexClient, extractOrderId, store CRUD, config, deduplicator) is already written and tested. This phase is almost entirely plumbing: create route files, call the right lib functions in the right order, and return correctly shaped JSON responses.

The biggest design decisions are already settled by earlier phases: all routes must use the Node.js runtime (not Edge), in-memory store is process-scoped via globalThis, config is assembled from getServerConfig() merged with getConfigOverrides(), and processOrder() must be awaited synchronously (no fire-and-forget). The only genuinely new code in this phase is the request-parsing, guard logic inside each route, the filter/search/sort logic for GET /api/erp/orders, and the feed-lock flag.

**Primary recommendation:** Each route handler is a thin orchestration shell. Import, call, return. Keep route files under ~80 lines each by delegating all business logic to existing lib modules.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HOOK-01 | `POST /api/vtex/hook` endpoint exists and accepts requests | App Router file convention: `src/app/api/vtex/hook/route.ts`, export `POST` |
| HOOK-02 | Hook endpoint extracts orderId from multiple payload shapes | `extractOrderId()` in `src/lib/hookParser.ts` already handles 6 payload shapes |
| HOOK-03 | Hook validates payload and returns HTTP 200 immediately (does not block) | On Vercel, MUST await the full pipeline before returning — fire-and-forget kills mid-pipeline (PITFALL S3). Await processOrder, then return 200. |
| HOOK-04 | Optional demo-level shared secret via `x-demo-hook-secret` header | `isHookSecretValid()` in `src/lib/config.ts` already implements this check |
| HOOK-05 | Hook URL displayed in UI | NEXT_PUBLIC_APP_URL env var (optional); route itself is always `/api/vtex/hook`; UI constructs full URL from `window.location.origin` |
| FEED-01 | User can trigger manual feed poll via `POST /api/vtex/feed/poll` | Route file: `src/app/api/vtex/feed/poll/route.ts`, export `POST` |
| FEED-02 | Calls VTEX Feed API, processes each valid event through pipeline | `vtexClient.getFeedItems()` + loop over items calling `processOrder()` |
| FEED-03 | Deduplicates feed events idempotently | `isDuplicate()` / `markProcessed()` from `src/lib/deduplicator.ts` |
| FEED-04 | Commits feed handle after successful full pipeline when auto-commit enabled | Call `vtexClient.commitFeedItems([item.handle])` only after processOrder resolves without leaving erpStatus as ERROR |
| FEED-05 | Duplicate events stored as `DUPLICATE_IGNORED` and visible in event log | upsertOrder with erpStatus 'DUPLICATE_IGNORED' + appendEventLog |
| API-01 | `POST /api/vtex/hook` — receives event, runs pipeline, returns 200 | Combined with HOOK-01..03 above |
| API-02 | `POST /api/vtex/feed/poll` — triggers feed poll, returns summary | Returns `{ processed, duplicates, errors, items: [...] }` |
| API-03 | `POST /api/vtex/orders/[orderId]/start-handling` — calls VTEX Start Handling | Route: `src/app/api/vtex/orders/[orderId]/start-handling/route.ts`; calls vtexClient.startHandling(); updates record |
| API-04 | `GET /api/erp/orders` — returns paginated/filtered list | `getAllOrders()` + in-memory filter/search/sort by query params |
| API-05 | `GET /api/erp/orders/[orderId]` — returns single record | `getOrderByOrderId()` or `getOrder()` with 404 if missing |
| API-06 | `POST /api/erp/orders/[orderId]/reprocess` — re-runs full pipeline | Reset record status, call processOrder() |
| API-07 | `POST /api/erp/orders/[orderId]/retry-start-handling` — retries Start Handling | Guard: only allowed when startHandlingStatus !== 'SUCCESS'; call vtexClient.startHandling() directly |
| ERR-02 | Handle VTEX 401/403 — record in timeline and inbox status | VtexApiError.status check in processOrder catch; already surfaced via GET_ORDER_ERROR / START_HANDLING_ERROR |
| ERR-03 | Handle VTEX 404 — record in timeline | Same mechanism as ERR-02; VtexApiError.status === 404 |
| ERR-04 | Handle VTEX 429 — record in timeline | Same catch path; message will contain "429" from VtexApiError.message format |
| ERR-05 | Handle malformed hook payloads — validation error response + event log | extractOrderId() returns undefined → return 400 + appendEventLog with WARN |
| ERR-06 | Errors appear in inbox status, timeline, and event log | processOrder already writes timeline entries; route handlers must also call appendEventLog |
| SEC-04 | VTEX app token never written to server logs | Already enforced in VtexApiError message format; route handlers must NOT log config objects |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.4 | Route handler runtime | Already installed; App Router is the project standard |
| typescript | 6.0.3 | Type safety | strict: true already set in tsconfig |

### No new dependencies needed
All required libraries (config, store, vtexClient, orderProcessor, hookParser, deduplicator, constants) are already implemented in `src/lib/`. No npm installs for this phase.

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.5 | Unit test runner | Existing pure-function tests; NOT suitable for route handler integration tests without a server |

---

## Architecture Patterns

### Recommended Project Structure

```
src/app/api/
├── vtex/
│   ├── hook/
│   │   └── route.ts                          # POST /api/vtex/hook
│   ├── feed/
│   │   └── poll/
│   │       └── route.ts                      # POST /api/vtex/feed/poll
│   └── orders/
│       └── [orderId]/
│           └── start-handling/
│               └── route.ts                  # POST /api/vtex/orders/[orderId]/start-handling
└── erp/
    └── orders/
        ├── route.ts                          # GET /api/erp/orders
        └── [orderId]/
            ├── route.ts                      # GET /api/erp/orders/[orderId]
            ├── reprocess/
            │   └── route.ts                  # POST /api/erp/orders/[orderId]/reprocess
            └── retry-start-handling/
                └── route.ts                  # POST /api/erp/orders/[orderId]/retry-start-handling
```

### Pattern 1: App Router Route Handler File Convention

**What:** Each route file exports named async functions matching HTTP verbs. The Web API `Request` and `Response` types are used directly (no `req`/`res` Express-style params).

**When to use:** All seven routes in this phase.

```typescript
// src/app/api/vtex/hook/route.ts
export const runtime = 'nodejs';        // REQUIRED — store uses process memory
export const dynamic = 'force-dynamic'; // Required for GET routes reading live store

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json();
  // ... handler logic
  return Response.json({ received: true });
}
```

**Dynamic segment access:**
```typescript
// src/app/api/erp/orders/[orderId]/route.ts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;
  // ...
}
```

Note: In Next.js 15+, `params` is a Promise and must be awaited. This is the breaking change from Next.js 14.

### Pattern 2: Config Assembly at Route Call Site

**What:** processOrder never calls getServerConfig() internally. Routes assemble the config by merging env defaults with in-memory overrides.

**When to use:** Every route that invokes the VTEX pipeline.

```typescript
import { getServerConfig, getMissingCredentials } from '@/lib/config';
import { getConfigOverrides } from '@/lib/store';
import { createVtexClient } from '@/lib/vtexClient';
import type { AppConfig } from '@/types';

function buildConfig(): AppConfig & { appToken: string; demoHookSecret: string } {
  const base = getServerConfig();
  const overrides = getConfigOverrides();
  return { ...base, ...overrides };
}
```

### Pattern 3: Hook Route — Synchronous Pipeline (No Fire-and-Forget)

**What:** PITFALL S3 is critical — Vercel terminates the function after the response. The pipeline MUST be awaited before returning 200.

**When to use:** POST /api/vtex/hook only.

```typescript
export async function POST(request: Request): Promise<Response> {
  // 1. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 2. Optional demo secret check (HOOK-04)
  const cfg = buildConfig();
  const secret = request.headers.get('x-demo-hook-secret');
  if (!isHookSecretValid(secret, cfg)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Extract orderId (HOOK-02)
  const payload = body as VtexHookPayload;
  const orderId = extractOrderId(payload);
  if (!orderId) {
    appendEventLog({ /* WARN: malformed */ });
    return Response.json({ error: 'Cannot extract orderId from payload' }, { status: 400 });
  }

  // 4. Seed store record + run pipeline synchronously
  // ... upsertOrder, then await processOrder(orderId, 'HOOK', deps)

  // 5. Return 200 — VTEX needs a fast ACK but Vercel keeps function alive until response
  return Response.json({ received: true, orderId });
}
```

### Pattern 4: Feed Poll Route — Sequential Processing with Lock

**What:** Process feed items sequentially (not Promise.all) to avoid VTEX 429. Use a module-level flag to guard against concurrent polls (PITFALL C5).

**When to use:** POST /api/vtex/feed/poll only.

```typescript
// Module-level lock — survives across requests on a warm instance
let pollInProgress = false;

export async function POST(_request: Request): Promise<Response> {
  if (pollInProgress) {
    return Response.json(
      { error: 'Poll already in progress', code: 'POLL_LOCKED' },
      { status: 409 },
    );
  }
  pollInProgress = true;
  try {
    // ... sequential processing
  } finally {
    pollInProgress = false; // always release
  }
}
```

**Sequential loop pattern (PITFALL C8 — no Promise.all):**
```typescript
for (const item of items.slice(0, FEED_POLL_MAX_EVENTS)) {
  const orderId = item.orderId;
  if (!orderId) continue;

  const dupInput = {
    orderId,
    state: item.currentState ?? item.state,
    timestamp: item.currentChangeDate ?? item.date,
  };

  if (isDuplicate(dupInput)) {
    // Store as DUPLICATE_IGNORED (FEED-05)
    duplicates++;
    continue;
  }
  markProcessed(dupInput);

  // Seed record + await processOrder
  // ...

  // Commit only after successful pipeline (PITFALL C1)
  const record = getOrderByOrderId(orderId);
  if (cfg.autoCommitFeed && record && record.erpStatus !== 'ERROR') {
    await vtexClient.commitFeedItems([item.handle]);
  }
}
```

### Pattern 5: GET /api/erp/orders — Filter/Search/Sort

**What:** Decode URL search params, apply filter/search/sort to getAllOrders() result in memory.

**When to use:** GET /api/erp/orders (API-04, INBOX-04..06).

```typescript
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const source = searchParams.get('source');       // 'FEED' | 'HOOK' | null
  const status = searchParams.get('status');       // ErpStatus | null
  const search = searchParams.get('search');       // free text | null
  const sort   = searchParams.get('sort') ?? 'receivedAt_desc';

  let orders = getAllOrders(); // already sorted newest-first

  if (source && source !== 'ALL') {
    orders = orders.filter(o => o.source === source);
  }
  if (status && status !== 'ALL') {
    orders = orders.filter(o => o.erpStatus === status);
  }
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(o =>
      o.orderId.toLowerCase().includes(q) ||
      (o.sequence ?? '').toLowerCase().includes(q) ||
      (o.customerName ?? '').toLowerCase().includes(q) ||
      (o.erpPayload?.items ?? []).some(item =>
        (item.name ?? '').toLowerCase().includes(q),
      ),
    );
  }

  return Response.json({ orders, total: orders.length });
}
```

Supported `sort` values: `receivedAt_desc` (default), `receivedAt_asc`, `erpStatus_asc`. getAllOrders() already returns newest-first, so no additional sort is needed for the default case.

### Pattern 6: Error Response Shape (Standard Across All Routes)

Use a consistent shape for all error responses so the UI can render them uniformly:

```typescript
// 400
{ error: string, code?: string }

// 401 / 403
{ error: 'Forbidden' | 'Unauthorized', code: 'MISSING_CREDENTIALS' | 'INVALID_SECRET' }

// 404
{ error: 'Order not found', orderId: string }

// 409
{ error: string, code: 'POLL_LOCKED' | 'ALREADY_HANDLED' }

// 500
{ error: 'Internal error', message: string }
```

### Pattern 7: Missing Credentials Guard

Every route that calls VTEX APIs must check credentials before building the client:

```typescript
const cfg = buildConfig();
const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
if (missing.length > 0) {
  return Response.json(
    { error: 'VTEX credentials not configured', missing },
    { status: 401 },
  );
}
const vtexClient = createVtexClient(cfg);
```

### Pattern 8: HOOK-05 — Hook URL Display

The hook URL is not an API concern — it is derived purely in the UI by reading `window.location.origin`. However, `NEXT_PUBLIC_APP_URL` can be set optionally for Vercel environments where the origin may differ from the deployment URL:

```typescript
// In the UI component (Phase 4):
const hookUrl = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/vtex/hook`
  : `${window.location.origin}/api/vtex/hook`;
```

No server-side logic is required for HOOK-05. The route itself does not need to know its own URL.

### Pattern 9: Reprocess Endpoint

**What:** POST /api/erp/orders/[orderId]/reprocess resets the record to a clean state and re-runs the full pipeline.

```typescript
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;
  const existing = getOrderByOrderId(orderId);
  if (!existing) {
    return Response.json({ error: 'Order not found', orderId }, { status: 404 });
  }

  // Reset to RECEIVED so processOrder doesn't hit the PIPE-07 guard
  upsertOrder({
    ...existing,
    erpStatus: 'RECEIVED',
    startHandlingStatus: 'NOT_STARTED',
    errorMessage: undefined,
    attempts: 0,
    timeline: [
      ...existing.timeline,
      { timestamp: new Date().toISOString(), step: 'REPROCESS_REQUESTED', status: 'INFO' },
    ],
  });

  const cfg = buildConfig();
  const vtexClient = createVtexClient(cfg);
  await processOrder(orderId, existing.source, { vtexClient, config: cfg });

  return Response.json({ ok: true, orderId });
}
```

### Pattern 10: Retry-Start-Handling Endpoint

**What:** POST /api/erp/orders/[orderId]/retry-start-handling bypasses the full pipeline and calls Start Handling directly. Only valid when startHandlingStatus is NOT 'SUCCESS'.

```typescript
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;
  const existing = getOrderByOrderId(orderId);
  if (!existing) {
    return Response.json({ error: 'Order not found', orderId }, { status: 404 });
  }
  if (existing.startHandlingStatus === 'SUCCESS') {
    return Response.json(
      { error: 'Start Handling already succeeded — no retry needed', code: 'ALREADY_HANDLED' },
      { status: 409 },
    );
  }

  // Call Start Handling directly
  const cfg = buildConfig();
  const vtexClient = createVtexClient(cfg);
  try {
    await vtexClient.startHandling(orderId);
    const r = getOrderByOrderId(orderId)!;
    upsertOrder({ ...r, startHandlingStatus: 'SUCCESS' });
    setOrderStatus(r.id, 'START_HANDLING_SUCCESS');
    appendTimelineEntry(r.id, { timestamp: new Date().toISOString(), step: 'START_HANDLING_SUCCESS', status: 'SUCCESS', message: 'Manual retry succeeded' });
    return Response.json({ ok: true, orderId, startHandlingStatus: 'SUCCESS' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const r = getOrderByOrderId(orderId)!;
    upsertOrder({ ...r, startHandlingStatus: 'ERROR', errorMessage: message });
    setOrderStatus(r.id, 'START_HANDLING_ERROR');
    appendTimelineEntry(r.id, { timestamp: new Date().toISOString(), step: 'START_HANDLING_ERROR', status: 'ERROR', message });
    return Response.json({ ok: false, orderId, error: message }, { status: 502 });
  }
}
```

### Anti-Patterns to Avoid

- **Fire-and-forget in hook route:** `processOrder(...)` without `await` will be killed by Vercel mid-pipeline. Always await.
- **Promise.all across VTEX API calls:** Causes rate limiting (PITFALL C8). Use `for...of` loop.
- **Committing feed handles before pipeline completes:** Must commit AFTER processOrder resolves successfully (PITFALL C1).
- **Calling processOrder without seeding the store record first:** processOrder checks `getOrderByOrderId(orderId)` — if no record exists it is a no-op.
- **export const runtime = 'edge':** Breaks the in-memory store (Edge isolates have no shared process memory). Use `'nodejs'` or omit (default is nodejs on Vercel with Next.js).
- **Logging the config object directly:** cfg contains appToken. Only log safe fields like `cfg.account`.
- **Using `req.json()` twice:** The body stream can only be consumed once. Parse once, store in a variable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| orderId extraction from hook payload | Custom extraction logic | `extractOrderId()` from `@/lib/hookParser` | Already handles 6 payload shapes, tested |
| Full pipeline orchestration | Inline Get Order + ERP + Start Handling sequence | `processOrder()` from `@/lib/orderProcessor` | Guards (PIPE-05/06/07), timeline writes, status updates all handled |
| VTEX HTTP calls | Inline fetch with headers | `createVtexClient()` from `@/lib/vtexClient` | Auth headers, error throwing, 204 handling, content-type already correct |
| Deduplication | Custom Set or Map | `isDuplicate()` / `markProcessed()` from `@/lib/deduplicator` | Correct key format (eventId or composite), backed by bounded store |
| Config assembly | Reading process.env directly | `getServerConfig()` + `getConfigOverrides()` from `@/lib/config` | Missing credential detection, override merge, token safety all handled |
| In-memory order CRUD | Direct Map access | Store functions from `@/lib/store` | globalThis guard, sorted queries, bounded collections all built in |
| Event log | Separate array | `appendEventLog()` / `getEventLog()` from `@/lib/store` | Bounded to 1000 entries, newest-first sort included |

**Key insight:** Every hard problem is already solved in Phase 2. Route handlers are 50–80 lines each of pure orchestration.

---

## Common Pitfalls

### Pitfall 1: params Must Be Awaited in Next.js 15+
**What goes wrong:** Accessing `params.orderId` directly (without await) gives a TypeScript error or returns undefined at runtime in Next.js 15+.
**Why it happens:** Next.js made params a Promise in v15 to support async segment resolution.
**How to avoid:** Always destructure via `const { orderId } = await params;`
**Warning signs:** TypeScript error "Property 'orderId' does not exist on type 'Promise<...>'" or undefined orderId at runtime.

### Pitfall 2: export const dynamic = 'force-dynamic' on GET Routes
**What goes wrong:** GET routes that read from the in-memory store are cached by Next.js by default (static optimization). They return stale data from build time.
**Why it happens:** Next.js App Router caches GET route handlers unless opted out.
**How to avoid:** Add `export const dynamic = 'force-dynamic';` to ALL GET route files (GET /api/erp/orders and GET /api/erp/orders/[orderId]).
**Warning signs:** GET /api/erp/orders always returns empty array even after orders are processed; works in dev but broken in production build.

### Pitfall 3: Store Record Must Exist Before processOrder Is Called
**What goes wrong:** processOrder() starts with `getOrderByOrderId(orderId)` — if no record exists, it silently returns. The pipeline never runs.
**Why it happens:** Routes forget to upsertOrder() before calling processOrder().
**How to avoid:** Seed the record (upsertOrder) with erpStatus 'RECEIVED' before calling processOrder. The hook and feed routes own this seeding step.
**Warning signs:** No timeline entries appear; processOrder returns immediately with no side effects.

### Pitfall 4: Feed Poll Lock Not Released on Error
**What goes wrong:** The `pollInProgress` flag is set to true but an error throws before it is reset. All subsequent poll requests return 409 indefinitely (until the serverless instance recycles).
**Why it happens:** Missing try/finally around the poll logic.
**How to avoid:** Always wrap the poll body in try/finally and reset the flag in finally.
**Warning signs:** "Poll already in progress" error persists after what appears to be a completed poll.

### Pitfall 5: Logging Config Objects (SEC-04)
**What goes wrong:** `console.log('config:', cfg)` leaks the appToken to Vercel function logs.
**Why it happens:** Debugging convenience.
**How to avoid:** Never log the config object. Log only safe fields: `console.log('account:', cfg.account)`. Use maskToken() for diagnostic display.
**Warning signs:** Vercel function logs contain the literal app token value.

### Pitfall 6: VtexApiError.status for Specific Error Classification (ERR-02..04)
**What goes wrong:** The route catches a generic Error and records "VTEX API error" without distinguishing 401/403/404/429.
**Why it happens:** `catch (err)` with `err.message` access doesn't surface the status code.
**How to avoid:** Type-check the error with `instanceof VtexApiError` to read `.status`:
```typescript
import { VtexApiError } from '@/lib/vtexClient';

function classifyVtexError(err: unknown): string {
  if (err instanceof VtexApiError) {
    if (err.status === 401 || err.status === 403) return 'AUTH_ERROR';
    if (err.status === 404) return 'NOT_FOUND';
    if (err.status === 429) return 'RATE_LIMITED';
  }
  return 'UNKNOWN_ERROR';
}
```
processOrder already logs VtexApiError messages into the timeline. The route handler layer can read the record's errorMessage after processOrder resolves to determine what happened.

### Pitfall 7: Duplicate upsertOrder After processOrder Overwrites Its Work
**What goes wrong:** The route calls `upsertOrder(partial)` after processOrder() returns, accidentally overwriting the erpStatus/startHandlingStatus that processOrder() wrote.
**Why it happens:** Route tries to add metadata after the pipeline, using a stale pre-pipeline record.
**How to avoid:** After processOrder() resolves, always re-fetch the record with `getOrderByOrderId(orderId)` before any further upsert. Better: don't upsert at all after processOrder if processOrder already sets all required fields.

---

## Code Examples

Verified patterns from source files read during research:

### Seeding a New Order Record (Hook Route Pattern)
```typescript
// Before calling processOrder — must exist in store first
const record: ErpOrderRecord = {
  id: orderId,           // use orderId as the internal id for simplicity
  orderId,
  source: 'HOOK',
  erpStatus: 'RECEIVED',
  startHandlingStatus: 'NOT_STARTED',
  receivedAt: new Date().toISOString(),
  attempts: 0,
  timeline: [{
    timestamp: new Date().toISOString(),
    step: 'EVENT_RECEIVED',
    status: 'INFO',
    message: `Hook event received for orderId: ${orderId}`,
  }],
};
upsertOrder(record);
```

### Config Assembly at Route Call Site
```typescript
import { getServerConfig } from '@/lib/config';
import { getConfigOverrides } from '@/lib/store';

function buildConfig() {
  return { ...getServerConfig(), ...getConfigOverrides() };
}
```

### Feed Item Dedup + Process Loop
```typescript
import { isDuplicate, markProcessed } from '@/lib/deduplicator';
import { FEED_POLL_MAX_EVENTS } from '@/lib/constants';

for (const item of items.slice(0, FEED_POLL_MAX_EVENTS)) {
  const orderId = item.orderId;
  if (!orderId) continue;

  const dedupInput = {
    eventId: item.eventId ?? item.id,
    orderId,
    state: item.currentState ?? item.state,
    timestamp: item.currentChangeDate ?? item.date,
  };

  if (isDuplicate(dedupInput)) {
    // Record as DUPLICATE_IGNORED
    duplicates++;
    continue;
  }
  markProcessed(dedupInput);
  // ... seed record, await processOrder
}
```

### Dynamic Segment Access (Next.js 15+ Pattern)
```typescript
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params; // must await in Next.js 15+
  // ...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router `pages/api/` | App Router `app/api/` with `route.ts` | Next.js 13+ | Named HTTP verb exports; Web API Request/Response (no express-style req/res) |
| `req.query.orderId` | `(await params).orderId` | Next.js 15 | params is now a Promise — must be awaited |
| `res.status(200).json({})` | `Response.json({}, { status: 200 })` | Next.js 13+ | Standard Web API Response |
| `export const config = { runtime: 'nodejs' }` | `export const runtime = 'nodejs'` | Next.js 13+ | New export constant format |
| GET routes always dynamic | GET routes statically cached by default | Next.js 13+ | Must opt out with `export const dynamic = 'force-dynamic'` for live data |

**Deprecated/outdated:**
- Pages Router (`pages/api/` files): Not used in this project. App Router exclusively.
- `NextRequest` / `NextResponse` from 'next/server': Still valid but unnecessary here — plain `Request` / `Response.json()` is simpler and sufficient for these routes.

---

## Open Questions

1. **Should POST routes also export `dynamic = 'force-dynamic'`?**
   - What we know: POST routes are never cached by Next.js (mutations are always dynamic by default).
   - What's unclear: Whether Next.js 16 has any edge case where a POST is cached.
   - Recommendation: Only required for GET routes. POST routes are safe without it.

2. **Should the reprocess endpoint reset `attempts` to 0 or preserve the count?**
   - What we know: The REQUIREMENTS.md and CLAUDE.MD don't specify; INBOX-02 lists "attempt count" as a visible column.
   - What's unclear: Whether "attempts" means total lifetime attempts or attempts since last reprocess.
   - Recommendation: Preserve historical attempts, add the new attempt on top (increment via processOrder's incrementAttempts call). Do NOT reset to 0 — the count is useful for debugging.

3. **Should the hook route return 200 even when credentials are missing?**
   - What we know: VTEX expects a fast 200 ACK. If credentials are missing, the pipeline fails anyway and the error is logged.
   - What's unclear: Whether VTEX re-delivers if it gets a 401 instead of 200.
   - Recommendation: Return 200 always for valid payloads regardless of credential state. Log the credential error to the event log and write it to the timeline. This prevents VTEX from hammering a misconfigured endpoint with retries.

---

## Validation Architecture

nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/__tests__/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOOK-01 | POST /api/vtex/hook exists and accepts POST | manual/smoke | `curl -X POST http://localhost:3000/api/vtex/hook -H "Content-Type: application/json" -d '{"orderId":"test-001"}'` | ❌ Wave 0 |
| HOOK-02 | extractOrderId from multiple payload shapes | unit (already done) | `npx vitest run src/lib/__tests__/hookParser.test.ts` | ✅ existing |
| HOOK-03 | Hook pipeline runs synchronously before 200 | integration/manual | `npx vitest run src/app/api/__tests__/` | ❌ Wave 0 |
| HOOK-04 | x-demo-hook-secret header validated | unit (already done) | `npx vitest run src/lib/__tests__/config.test.ts` | ✅ existing |
| HOOK-05 | Hook URL derivable from env/window.location | not testable via Vitest | manual browser check | N/A |
| FEED-01..05 | Feed poll processes items, deduplicates, commits | integration/manual | `npx vitest run src/app/api/__tests__/feedPoll.test.ts` | ❌ Wave 0 |
| FEED-03 | Deduplication by eventId / composite key | unit (already done) | `npx vitest run src/lib/__tests__/deduplicator.test.ts` | ✅ existing |
| API-01 | POST /api/vtex/hook returns 200 with valid payload | integration/manual | manual curl | ❌ Wave 0 |
| API-02 | POST /api/vtex/feed/poll returns summary JSON | integration/manual | manual curl | ❌ Wave 0 |
| API-03 | POST /api/vtex/orders/[orderId]/start-handling | integration/manual | manual curl | ❌ Wave 0 |
| API-04 | GET /api/erp/orders returns filtered list | unit (store + filter) | `npx vitest run src/app/api/__tests__/erpOrders.test.ts` | ❌ Wave 0 |
| API-05 | GET /api/erp/orders/[orderId] returns single record | unit (store lookup) | `npx vitest run src/app/api/__tests__/erpOrders.test.ts` | ❌ Wave 0 |
| API-06 | POST reprocess resets + re-runs pipeline | unit (store state transitions) | `npx vitest run src/app/api/__tests__/erpOrders.test.ts` | ❌ Wave 0 |
| API-07 | POST retry-start-handling calls startHandling if not SUCCESS | unit | `npx vitest run src/app/api/__tests__/erpOrders.test.ts` | ❌ Wave 0 |
| ERR-02..04 | 401/403/404/429 VtexApiErrors recorded in timeline | unit (processOrder already tested) | `npx vitest run src/lib/__tests__/orderProcessor.test.ts` | ✅ existing |
| ERR-05 | Malformed hook payload returns 400 | unit | `npx vitest run src/app/api/__tests__/hookRoute.test.ts` | ❌ Wave 0 |
| ERR-06 | Errors visible in inbox, timeline, event log | integration/manual | manual browser inspection | N/A |
| SEC-04 | appToken not in server logs | unit (config test already done) | `npx vitest run src/lib/__tests__/config.test.ts` | ✅ existing |

### Testing Strategy for Route Handlers

Next.js App Router route handlers cannot be called as pure functions without a running Next.js server. The two viable testing approaches are:

1. **Extract handler logic to pure helper functions** (preferred): The filter/search/sort logic for GET /api/erp/orders and the dedup loop for the feed poll can be extracted to pure functions in `src/lib/` and unit-tested with Vitest without a server. This is the recommended approach for business logic.

2. **Integration testing via `next dev` + curl / fetch**: Spin up `npm run dev` and test endpoints with curl commands. Not automatable in Vitest without `next-test-api-route-handler` or similar, which is not in the project's dependencies and adds unnecessary complexity for an MVP.

For this MVP, the recommended stance is: write Vitest unit tests for any extractable logic (filter helper, dedup loop body), and verify full route behavior manually via curl during implementation.

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/__tests__/` (existing unit tests — fast, under 5s)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + manual curl smoke test of all 7 endpoints before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/app/api/__tests__/hookRoute.test.ts` — covers HOOK-01, HOOK-03 (malformed payload → 400, missing orderId → 400) by calling handler logic extracted to a helper
- [ ] `src/app/api/__tests__/erpOrders.test.ts` — covers API-04..07 filter/search/sort logic and retry guard
- [ ] No new framework installs needed — Vitest already configured

*(If logic is kept inline in route files rather than extracted, these test files become manual-only and Wave 0 gaps reduce to zero test files)*

---

## Sources

### Primary (HIGH confidence)
- Source code: `src/lib/orderProcessor.ts`, `src/lib/vtexClient.ts`, `src/lib/hookParser.ts`, `src/lib/config.ts`, `src/lib/store.ts`, `src/lib/constants.ts`, `src/lib/deduplicator.ts` — direct inspection of existing implementations
- Source code: `src/types/erp.ts`, `src/types/vtex.ts` — type definitions confirm all required shapes exist
- `package.json` — next@16.2.4, vitest@4.1.5, typescript@6.0.3 confirmed
- `vitest.config.ts` — jsdom environment, globals: true, include pattern confirmed
- `tsconfig.json` — strict: true confirmed, paths alias `@/*` → `./src/*` confirmed
- `.planning/research/PITFALLS.md` — C1/C3/C5/C6/S3/S4/S8 pitfalls directly applicable to this phase

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` Accumulated Decisions — params-as-Promise in Next.js 15+ confirmed, App Router exclusively confirmed, Node.js >= 24.0.0 runtime confirmed
- `.planning/REQUIREMENTS.md` — full requirement traceability confirmed; all Phase 3 requirements (HOOK-01..05, FEED-01..05, API-01..07, ERR-02..06, SEC-04) identified

### Tertiary (LOW confidence)
- None — all critical findings verified from source code and project files directly.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed from package.json and existing source files
- Architecture: HIGH — Next.js App Router route handler conventions confirmed from existing src/app/ structure and Next.js 16 project setup; params-as-Promise confirmed from STATE.md decisions
- Pitfalls: HIGH — PITFALLS.md was purpose-written for this project and directly addresses hook, feed, and store integration scenarios
- Filter/search logic: HIGH — getAllOrders() API confirmed from store.ts; query param patterns are standard URLSearchParams

**Research date:** 2026-04-28
**Valid until:** 2026-06-01 (stable Next.js/Vitest stack; VTEX API unchanged)
