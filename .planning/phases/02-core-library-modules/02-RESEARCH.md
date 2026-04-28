# Phase 2: Core Library Modules - Research

**Researched:** 2026-04-28
**Domain:** Pure TypeScript library modules — VTEX HTTP client, ERP normalization, PII masking, deduplication, order-processing orchestration
**Confidence:** HIGH (architecture and types from Phase 1 code; VTEX Feed/commit endpoint shape MEDIUM — official docs inaccessible, cross-verified with multiple community sources)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-01 | App calls VTEX Get Order API for each received orderId | vtexClient.getOrder() — endpoint confirmed: `GET /api/oms/pvt/orders/{orderId}`. Auth headers pattern established in constants.ts. |
| PIPE-02 | App normalizes the full VTEX order response into a typed ErpOrderPayload | erpSimulator.normalizeOrder() — VtexOrder type fully defined in vtex.ts, ErpOrderPayload in erp.ts. Pure function pattern documented. |
| PIPE-03 | App simulates ERP acceptance (SUCCESS default / FAILURE when toggle on) | erpSimulator.simulateErpAcceptance() — reads AppConfig.simulateErpFailure. Config reading pattern established in config.ts. |
| PIPE-04 | App calls VTEX Start Handling automatically after ERP simulation SUCCESS | orderProcessor.ts orchestration — sequential guard chain documented. |
| PIPE-05 | App does NOT call VTEX Start Handling when ERP simulation returns FAILURE | Guard in orderProcessor: early return after ERP failure. Unit-testable in isolation with injected mock vtexClient. |
| PIPE-06 | App does NOT call VTEX Start Handling when Get Order API call fails | Guard in orderProcessor: early return after getOrder throws. Typed VtexApiError allows status-code-specific handling. |
| PIPE-07 | App does NOT call Start Handling a second time for order already in START_HANDLING_SUCCESS | Guard uses store.getOrderByOrderId() to check existing startHandlingStatus before calling. |
| PIPE-08 | Each pipeline step is recorded with timestamp and status in the order processing timeline | store.appendTimelineEntry() with PipelineStepName enum already defined in erp.ts. All step names typed. |
| SEC-01 | Customer email address is masked in all UI views | piiMasker.maskEmail() — format `d***@domain.com`. Applied at normalization time, not display time (SEC-03). |
| SEC-02 | Customer document number (CPF/CNPJ) is masked in all UI views | piiMasker.maskDocument() — format `***-XX` pattern. Applied server-side. |
| SEC-03 | PII masking applied server-side at normalization time — raw VTEX payloads stored do NOT contain unmasked PII | vtexOrderRaw stored on ErpOrderRecord must go through piiMasker before being assigned. maskOrderPayload() deep utility needed. |
| TEST-01 | Unit tests for VTEX order normalization | src/lib/__tests__/erpSimulator.test.ts — normalizeOrder pure function, vitest, no HTTP. |
| TEST-02 | Unit tests for event deduplication | src/lib/__tests__/deduplicator.test.ts — buildKey, hasProcessed, markProcessed. Uses __resetStoreForTests(). |
| TEST-03 | Unit tests for Hook payload parsing | src/lib/__tests__/hookParser.test.ts OR tested within erpSimulator — extractOrderId covers multiple payload shapes. |
| TEST-04 | Unit tests for ERP simulator (SUCCESS default / FAILURE mode) | src/lib/__tests__/erpSimulator.test.ts — simulateErpAcceptance with config injection. |
| TEST-05 | Unit tests for PII masking utility | src/lib/__tests__/piiMasker.test.ts — maskEmail, maskDocument, maskOrderPayload. Pure functions. |
| TEST-06 | Unit tests for Start Handling guards | src/lib/__tests__/orderProcessor.test.ts — inject mock vtexClient and mock store; assert startHandling never called on ERP fail/getOrder fail/already-success. |
</phase_requirements>

---

## Summary

Phase 2 builds the five pure/near-pure library modules that implement the entire processing pipeline independently of any HTTP surface. The foundation from Phase 1 is solid: all types are defined and stable, the in-memory store exposes the correct mutation interface, and `config.ts` provides the server-side credential reading pattern. Phase 2 modules wire these together without adding any HTTP routing.

The most architecturally critical module is `orderProcessor.ts`. It is the single place where the three Start Handling guards are enforced (PIPE-05, PIPE-06, PIPE-07). It must accept injected dependencies (`vtexClient` and store functions) so tests can verify guard logic without making real VTEX API calls. The injection pattern is already documented in ARCHITECTURE.md and matches the pattern used in config.ts tests.

The VTEX Feed endpoint shape (`GET /api/orders/feed`) uses a response where each item contains `handle` (a JWT-like string, required for commit), `orderId`, `currentState`, `lastState`, `currentChangeDate`, and `lastChangeDate`. There is no `eventId` field confirmed from official sources — `handle` is the item identifier for commit, while `orderId + currentState + currentChangeDate` is the correct deduplication composite key. This is consistent with the existing `VtexFeedItem` type which already captures this pattern. The commit endpoint is `POST /api/orders/feed` with a body `{ handles: string[] }`.

**Primary recommendation:** Build modules strictly in dependency order — piiMasker → deduplicator → erpSimulator → vtexClient → orderProcessor. Write tests for each module immediately after implementing it, before building the next. The vitest infrastructure already exists and passes; use `__resetStoreForTests()` in `beforeEach` for any test that touches store state.

---

## Standard Stack

### Core (already installed — no new dependencies needed for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^6.0.3 | Static typing throughout | Already configured, strict mode assumed |
| Node.js built-in `fetch` | Node 24 native | HTTP calls in vtexClient | No node-fetch needed; Node 24 ships native fetch |
| vitest | ^4.1.5 | Unit test runner | Already installed and configured in vitest.config.ts |
| zod | ^3.x (in node_modules) | Optional: runtime validation for vtexClient responses | Available; use for VtexOrder narrowing if desired |

### No New Installation Needed

All Phase 2 modules are pure TypeScript. They import from `@/types` and `@/lib` only. The Node.js native `fetch` API is available on Node 24 for `vtexClient`. No additional npm packages are required.

**Verify Node fetch availability:**
```bash
node -e "console.log(typeof fetch)"   # should print: function
```

---

## Architecture Patterns

### Module Build Order (strict dependency order)

```
1. src/lib/piiMasker.ts         — pure, zero deps beyond types
2. src/lib/deduplicator.ts      — pure logic; calls store.hasProcessedKey / store.markProcessedKey
3. src/lib/erpSimulator.ts      — normalizeOrder (pure) + simulateErpAcceptance (reads config)
4. src/lib/vtexClient.ts        — HTTP calls, uses constants + config, throws VtexApiError
5. src/lib/orderProcessor.ts    — orchestrates all four above; accepts injected deps
```

### Module 1: piiMasker.ts

**What:** Pure functions that mask customer PII fields before any storage.
**Critical:** SEC-03 requires masking at ingestion time, not display time. The `vtexOrderRaw` field on `ErpOrderRecord` must already be masked when stored.

```typescript
// src/lib/piiMasker.ts

/** "diego.cione@vtex.com" → "d***@vtex.com" */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return '***';
  return `${email[0]}***${email.slice(atIdx)}`;
}

/** "123.456.789-09" → "***-09"  |  "12.345.678/0001-90" → "***-90" */
export function maskDocument(doc: string | null | undefined): string {
  if (!doc) return '';
  const cleaned = doc.replace(/\D/g, '');           // digits only
  if (cleaned.length < 4) return '***';
  return `***-${cleaned.slice(-2)}`;
}

/**
 * Deep-clone and mask PII fields from a raw VTEX order payload (type unknown).
 * Targets: clientProfileData.email, clientProfileData.document, clientProfileData.phone
 * Used to sanitize vtexOrderRaw before storing on ErpOrderRecord.
 */
export function maskOrderPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = structuredClone(payload) as Record<string, unknown>;
  const profile = clone['clientProfileData'];
  if (profile && typeof profile === 'object') {
    const p = profile as Record<string, unknown>;
    if (typeof p['email'] === 'string') p['email'] = maskEmail(p['email']);
    if (typeof p['document'] === 'string') p['document'] = maskDocument(p['document']);
    if (typeof p['phone'] === 'string') p['phone'] = '(**) *****-****';
  }
  const shipping = clone['shippingData'];
  if (shipping && typeof shipping === 'object') {
    const addr = (shipping as Record<string, unknown>)['address'];
    if (addr && typeof addr === 'object') {
      const a = addr as Record<string, unknown>;
      if (typeof a['street'] === 'string') a['street'] = `${a['street'].slice(0, 4)}***`;
      if (typeof a['receiverName'] === 'string') a['receiverName'] = `${a['receiverName'].split(' ')[0]} ***`;
    }
  }
  return clone;
}
```

**Why `structuredClone` over JSON.parse/stringify:** Native deep clone, handles dates correctly, no circular reference issues.

### Module 2: deduplicator.ts

**What:** Builds idempotency keys from feed events or hook payloads, delegates storage to the existing `processedKeys` Set in store.ts.
**Key insight from PITFALL S5:** Do NOT deduplicate on `orderId` alone. VTEX legitimately re-delivers events for the same order in different states.

```typescript
// src/lib/deduplicator.ts
import { hasProcessedKey, markProcessedKey } from '@/lib/store';

export interface DeduplicatorInput {
  eventId?: string | null;
  orderId?: string | null;
  state?: string | null;      // from VtexFeedItem.state or hook currentState
  timestamp?: string | null;  // from VtexFeedItem.date or hook currentChangeDate
}

/**
 * Build the idempotency key for an event.
 * Priority: eventId (if present and non-empty) → orderId+state+timestamp composite.
 * NEVER deduplicate on orderId alone (PITFALL S5).
 */
export function buildDeduplicationKey(input: DeduplicatorInput): string {
  if (input.eventId) return `eventId:${input.eventId}`;
  const orderId = input.orderId ?? 'unknown';
  const state = input.state ?? 'unknown';
  const ts = input.timestamp ?? 'unknown';
  return `composite:${orderId}:${state}:${ts}`;
}

export function isDuplicate(input: DeduplicatorInput): boolean {
  return hasProcessedKey(buildDeduplicationKey(input));
}

export function markProcessed(input: DeduplicatorInput): void {
  markProcessedKey(buildDeduplicationKey(input));
}
```

**Note on VtexFeedItem fields:** The `VtexFeedItem` type has optional `eventId` and `id` fields. From VTEX Feed v3 documentation, the actual feed item shape does NOT include a reliable `eventId`. The confirmed fields are `handle`, `orderId`, `currentState`, `lastState`, `currentChangeDate`, `lastChangeDate`. Therefore `buildDeduplicationKey` for feed events should use `orderId + currentState + currentChangeDate` as the composite. The `eventId`/`id` fields on VtexFeedItem remain for forward compatibility.

### Module 3: erpSimulator.ts

**What:** Two exports — `normalizeOrder` (pure transform) and `simulateErpAcceptance` (reads config flag).

```typescript
// src/lib/erpSimulator.ts
import type { VtexOrder } from '@/types/vtex';
import type { ErpOrderPayload, ErpSimulationResult } from '@/types/erp';
import type { AppConfig } from '@/types/erp';
import { maskEmail, maskDocument } from '@/lib/piiMasker';

/**
 * Pure function — VtexOrder → ErpOrderPayload.
 * All field accesses use optional chaining (PITFALL S4).
 * PII masking applied here (SEC-01, SEC-02, SEC-03).
 */
export function normalizeOrder(vtexOrder: VtexOrder): ErpOrderPayload {
  const profile = vtexOrder.clientProfileData;
  const items = vtexOrder.items ?? [];
  const logistics = vtexOrder.shippingData?.logisticsInfo ?? [];
  const firstSla = logistics[0]?.selectedSla ?? undefined;
  const payments = vtexOrder.paymentData?.transactions?.[0]?.payments ?? [];
  const firstPayment = payments[0];

  return {
    externalOrderId: vtexOrder.orderId ?? '',
    orderId: vtexOrder.orderId ?? '',
    sequence: vtexOrder.sequence,
    status: vtexOrder.status,
    creationDate: vtexOrder.creationDate,
    customer: profile
      ? {
          name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || undefined,
          emailMasked: profile.email ? maskEmail(profile.email) : undefined,
          documentMasked: profile.document ? maskDocument(profile.document) : undefined,
        }
      : undefined,
    items: items.map((item) => ({
      skuId: item.id,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      sellingPrice: item.sellingPrice,
      total: item.quantity != null && item.sellingPrice != null
        ? item.quantity * item.sellingPrice
        : undefined,
    })),
    totals: vtexOrder.totals,
    paymentSummary: firstPayment?.paymentSystemName,
    shippingSummary: firstSla,
    logisticsInfo: vtexOrder.shippingData?.logisticsInfo,
    marketplace: vtexOrder.marketplaceOrderId ? 'MARKETPLACE' : undefined,
    rawSource: 'VTEX',
  };
}

/**
 * Reads simulateErpFailure from the merged config (env + in-memory overrides).
 * Returns ErpSimulationResult — never throws.
 * Accepts config as a parameter for testability (don't call getServerConfig() internally).
 */
export function simulateErpAcceptance(
  _payload: ErpOrderPayload,
  config: Pick<AppConfig, 'simulateErpFailure'>,
): ErpSimulationResult {
  if (config.simulateErpFailure) {
    return {
      status: 'FAILURE',
      reason: 'ERP failure simulation enabled',
      failedAt: new Date().toISOString(),
    };
  }
  return { status: 'SUCCESS', acceptedAt: new Date().toISOString() };
}
```

**Why config is a parameter:** Avoids importing `getServerConfig()` inside a function called by tests. Tests can pass `{ simulateErpFailure: true }` directly.

### Module 4: vtexClient.ts

**What:** All outbound HTTP calls to VTEX. Throws a typed `VtexApiError` class on non-2xx. Accepts a config parameter (not environment variable reads) for testability.

**VTEX API Endpoints (confirmed from research):**

| Operation | Method | Path |
|-----------|--------|------|
| Get Order | GET | `/api/oms/pvt/orders/{orderId}` |
| Get Feed Items | GET | `/api/orders/feed?maxLot=10` |
| Commit Feed Items | POST | `/api/orders/feed` |
| Start Handling | POST | `/api/oms/pvt/orders/{orderId}/start-handling` |

**VTEX Feed item response shape (MEDIUM confidence — from community sources, docs inaccessible):**
```json
{
  "handle": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "orderId": "v69305315atmc-01",
  "currentState": "ready-for-handling",
  "lastState": "payment-approved",
  "currentChangeDate": "2020-07-13T20:25:13.2304508Z",
  "lastChangeDate": "2020-07-13T20:25:03.9527532Z",
  "domain": "Marketplace"
}
```
Note: `handle` is a JWT-like string. It is NOT the same as `eventId`. Use `handle` for commit, use `orderId+currentState+currentChangeDate` for deduplication.

**Commit feed items request body (MEDIUM confidence):**
```json
{ "handles": ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."] }
```

**Start Handling:** POST with empty body `{}` or no body. Returns 200 with `{ date, receipt }` or 204 — treat either as success. Always set `Content-Type: application/json` even with empty body (PITFALL M6).

```typescript
// src/lib/vtexClient.ts

import type { VtexOrder, VtexFeedItem, VtexApiErrorShape } from '@/types/vtex';
import { buildVtexBaseUrl, VTEX_API_PATHS, VTEX_REQUIRED_HEADERS } from '@/lib/constants';

export class VtexApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly url: string;

  constructor(shape: VtexApiErrorShape) {
    // SECURITY: never include appToken in message (PITFALL S2)
    super(`VTEX API error ${shape.status} on ${shape.url}`);
    this.name = 'VtexApiError';
    this.status = shape.status;
    this.statusText = shape.statusText ?? '';
    this.body = shape.body;
    this.url = shape.url;
  }
}

export interface VtexClientConfig {
  account: string;
  environment: string;
  appKey: string;
  appToken: string;
}

export interface VtexClient {
  getOrder(orderId: string): Promise<VtexOrder>;
  getFeedItems(maxLot?: number): Promise<VtexFeedItem[]>;
  commitFeedItems(handles: string[]): Promise<void>;
  startHandling(orderId: string): Promise<void>;
}

/** Create a VtexClient instance from a config object. */
export function createVtexClient(config: VtexClientConfig): VtexClient {
  const baseUrl = buildVtexBaseUrl(config.account, config.environment);

  function buildHeaders(): Record<string, string> {
    return {
      [VTEX_REQUIRED_HEADERS.appKeyHeader]: config.appKey,
      [VTEX_REQUIRED_HEADERS.appTokenHeader]: config.appToken,
      [VTEX_REQUIRED_HEADERS.accept]: 'application/json',
      [VTEX_REQUIRED_HEADERS.contentType]: 'application/json',
    };
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let errorBody: unknown;
      try { errorBody = await res.json(); } catch { errorBody = await res.text(); }
      throw new VtexApiError({ status: res.status, statusText: res.statusText, body: errorBody, url });
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return {
    async getOrder(orderId) {
      return request<VtexOrder>('GET', VTEX_API_PATHS.getOrder(orderId));
    },
    async getFeedItems(maxLot = 10) {
      const path = `${VTEX_API_PATHS.feedItems()}?maxLot=${maxLot}`;
      const data = await request<VtexFeedItem[] | { message?: string } | unknown>('GET', path);
      // Feed returns array or empty; normalize to array
      if (Array.isArray(data)) return data as VtexFeedItem[];
      return [];
    },
    async commitFeedItems(handles) {
      if (handles.length === 0) return;
      await request<void>('POST', VTEX_API_PATHS.feedCommit(), { handles });
    },
    async startHandling(orderId) {
      await request<void>('POST', VTEX_API_PATHS.startHandling(orderId), {});
    },
  };
}
```

**Key design choices:**
- `createVtexClient(config)` factory function — tests pass mock config or mock the whole VtexClient interface
- Empty body `{}` on `startHandling` — defends PITFALL M6
- 204 handled explicitly — Start Handling can return either 200 or 204
- Token never appears in error messages — `VtexApiError` only includes url and status

### Module 5: orderProcessor.ts

**What:** Orchestrates the full pipeline. Enforces all three Start Handling guards. Writes to store for every step. Accepts `vtexClient` and config as injected parameters for testability.

```typescript
// src/lib/orderProcessor.ts
import type { IntegrationSource } from '@/types/erp';
import type { VtexClient } from '@/lib/vtexClient';
import type { AppConfig } from '@/types/erp';
import {
  upsertOrder, getOrderByOrderId, setOrderStatus,
  appendTimelineEntry, incrementAttempts
} from '@/lib/store';
import { normalizeOrder, simulateErpAcceptance } from '@/lib/erpSimulator';
import { maskOrderPayload } from '@/lib/piiMasker';

export interface ProcessOrderDeps {
  vtexClient: VtexClient;
  config: Pick<AppConfig, 'simulateErpFailure'>;
}

export async function processOrder(
  orderId: string,
  source: IntegrationSource,
  deps: ProcessOrderDeps,
): Promise<void> {
  const record = getOrderByOrderId(orderId);
  if (!record) return; // Guard: record must exist before processing starts

  // PIPE-07 guard: skip if already successfully handled
  if (record.startHandlingStatus === 'SUCCESS') {
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_REQUESTED',
      status: 'SKIPPED',
      message: 'Order already in START_HANDLING_SUCCESS — skipped',
    });
    return;
  }

  incrementAttempts(record.id);
  setOrderStatus(record.id, 'PROCESSING');

  // Step 1: Get Order
  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'GET_ORDER_REQUESTED',
    status: 'INFO',
  });

  let vtexOrder;
  try {
    vtexOrder = await deps.vtexClient.getOrder(orderId);
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'GET_ORDER_SUCCESS',
      status: 'SUCCESS',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setOrderStatus(record.id, 'ERROR');
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'GET_ORDER_ERROR',
      status: 'ERROR',
      message,
    });
    // PIPE-06: Stop. Do NOT call startHandling.
    return;
  }

  // Step 2: Normalize + store PII-masked raw payload
  const erpPayload = normalizeOrder(vtexOrder);
  const maskedRaw = maskOrderPayload(vtexOrder);

  // Persist both — erpPayload has masked PII fields; vtexOrderRaw is already masked
  const freshRecord = getOrderByOrderId(orderId);
  if (freshRecord) {
    upsertOrder({
      ...freshRecord,
      vtexOrderRaw: maskedRaw,
      erpPayload,
      vtexStatus: vtexOrder.status,
      customerName: erpPayload.customer?.name,
      customerEmailMasked: erpPayload.customer?.emailMasked,
      totalValue: vtexOrder.value,
      itemCount: vtexOrder.items?.length,
      paymentSummary: erpPayload.paymentSummary,
      shippingSummary: erpPayload.shippingSummary,
    });
  }

  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'ERP_PAYLOAD_NORMALIZED',
    status: 'SUCCESS',
  });

  // Step 3: ERP simulation
  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'ERP_SIMULATION_STARTED',
    status: 'INFO',
  });

  const erpResult = simulateErpAcceptance(erpPayload, deps.config);

  if (erpResult.status !== 'SUCCESS') {
    setOrderStatus(record.id, 'ERROR');
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'ERP_SIMULATION_ERROR',
      status: 'ERROR',
      message: erpResult.reason,
    });
    // PIPE-05: Stop. Do NOT call startHandling.
    return;
  }

  setOrderStatus(record.id, 'ERP_ACCEPTED');
  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'ERP_SIMULATION_SUCCESS',
    status: 'SUCCESS',
    message: erpResult.acceptedAt,
  });

  // Step 4: Start Handling
  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'START_HANDLING_REQUESTED',
    status: 'INFO',
  });

  try {
    await deps.vtexClient.startHandling(orderId);
    // Update startHandlingStatus atomically
    const r = getOrderByOrderId(orderId);
    if (r) upsertOrder({ ...r, startHandlingStatus: 'SUCCESS' });
    setOrderStatus(record.id, 'START_HANDLING_SUCCESS');
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_SUCCESS',
      status: 'SUCCESS',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const r = getOrderByOrderId(orderId);
    if (r) upsertOrder({ ...r, startHandlingStatus: 'ERROR', errorMessage: message });
    setOrderStatus(record.id, 'START_HANDLING_ERROR');
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_ERROR',
      status: 'ERROR',
      message,
    });
  }
}
```

### Recommended Project Structure (Phase 2 additions)

```
src/
  lib/
    piiMasker.ts            — NEW: pure PII masking (SEC-01, SEC-02, SEC-03)
    deduplicator.ts         — NEW: idempotency key builder (FEED-03, PIPE-07)
    erpSimulator.ts         — NEW: normalizeOrder + simulateErpAcceptance (PIPE-02, PIPE-03)
    vtexClient.ts           — NEW: VTEX HTTP client (PIPE-01, PIPE-04)
    orderProcessor.ts       — NEW: orchestration with guards (PIPE-05, PIPE-06, PIPE-07, PIPE-08)
    __tests__/
      piiMasker.test.ts     — NEW: TEST-05
      deduplicator.test.ts  — NEW: TEST-02
      erpSimulator.test.ts  — NEW: TEST-01, TEST-03, TEST-04
      vtexClient.test.ts    — NEW: integration-style (mock fetch)
      orderProcessor.test.ts — NEW: TEST-06 (guard tests)
    store.ts                — EXISTING (Phase 1)
    config.ts               — EXISTING (Phase 1)
    constants.ts            — EXISTING (Phase 1)
    utils.ts                — EXISTING (Phase 1)
  types/
    erp.ts                  — EXISTING (Phase 1)
    vtex.ts                 — EXISTING (Phase 1)
    index.ts                — EXISTING (Phase 1)
```

### Anti-Patterns to Avoid

- **Calling getServerConfig() inside erpSimulator or orderProcessor:** These must accept config as parameters for testability. Config reading belongs in the caller (API route or test).
- **Using `Promise.all` for sequential VTEX calls:** Process feed events sequentially — `for (const item of items)` — to avoid 429 rate limiting (PITFALL C8).
- **Using `handle` as the deduplication key:** Handle is a JWT that can change between deliveries. Deduplicate on `orderId+currentState+currentChangeDate`.
- **Storing unmasked PII in vtexOrderRaw:** Apply `maskOrderPayload()` before storing `vtexOrderRaw` on `ErpOrderRecord` (SEC-03, PITFALL C7).
- **Accessing `order.clientProfileData.email` without optional chaining:** All access must be `?.` (PITFALL S4).
- **Throwing raw Error objects from vtexClient without type info:** Throw `VtexApiError` with status code so `orderProcessor` can distinguish 404 vs 429 vs 401.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep object cloning for PII masking | Custom recursive cloner | `structuredClone()` (Node 24 native) | Handles circular refs, dates, typed arrays correctly |
| HTTP client with auth headers | Custom fetch wrapper per endpoint | `createVtexClient()` factory centralizing all headers | One place to fix header bugs (PITFALL M6) |
| Custom test double for VTEX client | Class-based mock | Simple object literal implementing `VtexClient` interface | Vitest doesn't need class mocks — typed object is enough |
| Environment variable merging for config | Hand-rolled merge logic | Already exists in `config.ts` + `store.getConfigOverrides()` | Phase 1 solved this; just call `getServerConfig()` at route level and pass to modules |
| Deduplication storage | Custom Map in deduplicator.ts | `store.hasProcessedKey` / `store.markProcessedKey` | Store already implements bounded Set with overflow pruning |

---

## Common Pitfalls

### Pitfall 1: VtexFeedItem `state` vs `currentState` field naming
**What goes wrong:** The existing `VtexFeedItem` type has a `state?: string` field. The actual VTEX Feed v3 response uses `currentState` and `lastState`. When building the deduplication key from a feed item, code may read `item.state` (undefined) instead of `item.currentState`.
**How to avoid:** Update `VtexFeedItem` to include `currentState?: string` and `lastState?: string` and use those in `buildDeduplicationKey`. Keep `state` for backward compat or use a type alias.
**Confidence:** MEDIUM — confirmed from multiple community sources that VTEX Feed v3 uses `currentState`.

### Pitfall 2: commitFeedItems called with VTEX Feed path used for both GET and POST
**What goes wrong:** `VTEX_API_PATHS.feedItems()` and `VTEX_API_PATHS.feedCommit()` both return `/api/orders/feed`. This is correct per VTEX design — the same path serves GET (retrieve) and POST (commit). However it looks like a bug. Adding a comment at the constant and in `vtexClient` prevents future confusion.
**How to avoid:** Add a code comment at both path constants: `// Same path for GET (retrieve) and POST (commit) — this is correct per VTEX Feed v3 design`.

### Pitfall 3: orderProcessor record lookup race on upsert
**What goes wrong:** `processOrder` looks up the record by orderId at the start, then again after `normalizeOrder` to persist the enriched data. Between the first and second lookup, a concurrent call could have modified the record (unlikely in demo context, possible under load). The second upsert could overwrite a newer status.
**How to avoid:** Use `getOrderByOrderId` for both lookups (already done in the pattern above). For MVP demo this is acceptable — document in code that upsert is not atomic.

### Pitfall 4: simulateErpAcceptance called before `appendTimelineEntry('ERP_SIMULATION_STARTED')`
**What goes wrong:** If `simulateErpAcceptance` fails synchronously (throws, e.g., due to wrong config shape), the timeline never gets `ERP_SIMULATION_STARTED`. Timeline appears to jump from `ERP_PAYLOAD_NORMALIZED` to `ERP_SIMULATION_ERROR`.
**How to avoid:** Write `ERP_SIMULATION_STARTED` timeline entry before calling `simulateErpAcceptance`. Since it returns a result (never throws by design), use `try/catch` defensively around it as well.

### Pitfall 5: VtexApiError token leak
**What goes wrong:** `VtexApiError` is constructed inside `vtexClient`. If the error `message` property is ever passed to VTEX API response bodies or logged with context objects that include config, the token could appear.
**How to avoid:** `VtexApiError` constructor only concatenates `status` + `url`. Config is never passed to `VtexApiError`. Confirmed by the pattern: credentials exist only in the headers map, which is discarded after `fetch()` resolves/rejects.

---

## Code Examples

### Mock VtexClient for Testing

```typescript
// Source: architecture pattern from ARCHITECTURE.md §Key Architecture Decisions #4

import type { VtexClient } from '@/lib/vtexClient';
import type { VtexOrder } from '@/types/vtex';

function makeMockVtexClient(overrides: Partial<VtexClient> = {}): VtexClient {
  return {
    getOrder: vi.fn().mockResolvedValue({ orderId: 'test-order', status: 'ready-for-handling' } satisfies Partial<VtexOrder> as VtexOrder),
    getFeedItems: vi.fn().mockResolvedValue([]),
    commitFeedItems: vi.fn().mockResolvedValue(undefined),
    startHandling: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
```

### Guard Test Pattern (TEST-06)

```typescript
// src/lib/__tests__/orderProcessor.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processOrder } from '@/lib/orderProcessor';
import { upsertOrder, __resetStoreForTests } from '@/lib/store';
import { VtexApiError } from '@/lib/vtexClient';

beforeEach(() => {
  __resetStoreForTests();
  vi.clearAllMocks();
});

it('does NOT call startHandling when ERP simulation fails (PIPE-05)', async () => {
  upsertOrder({ id: 'o1', orderId: 'vtex-001', source: 'HOOK', erpStatus: 'RECEIVED',
    startHandlingStatus: 'NOT_STARTED', receivedAt: new Date().toISOString(), attempts: 0, timeline: [] });
  const mockClient = makeMockVtexClient();
  await processOrder('vtex-001', 'HOOK', {
    vtexClient: mockClient,
    config: { simulateErpFailure: true }, // force FAILURE
  });
  expect(mockClient.startHandling).not.toHaveBeenCalled();
});

it('does NOT call startHandling when getOrder fails (PIPE-06)', async () => {
  upsertOrder({ id: 'o1', orderId: 'vtex-001', source: 'HOOK', erpStatus: 'RECEIVED',
    startHandlingStatus: 'NOT_STARTED', receivedAt: new Date().toISOString(), attempts: 0, timeline: [] });
  const mockClient = makeMockVtexClient({
    getOrder: vi.fn().mockRejectedValue(new VtexApiError({ status: 404, url: '/api/oms/pvt/orders/vtex-001' })),
  });
  await processOrder('vtex-001', 'HOOK', { vtexClient: mockClient, config: { simulateErpFailure: false } });
  expect(mockClient.startHandling).not.toHaveBeenCalled();
});

it('does NOT call startHandling when already SUCCESS (PIPE-07)', async () => {
  upsertOrder({ id: 'o1', orderId: 'vtex-001', source: 'HOOK', erpStatus: 'START_HANDLING_SUCCESS',
    startHandlingStatus: 'SUCCESS', receivedAt: new Date().toISOString(), attempts: 0, timeline: [] });
  const mockClient = makeMockVtexClient();
  await processOrder('vtex-001', 'HOOK', { vtexClient: mockClient, config: { simulateErpFailure: false } });
  expect(mockClient.startHandling).not.toHaveBeenCalled();
  expect(mockClient.getOrder).not.toHaveBeenCalled(); // entire pipeline skipped
});
```

### PII Masker Tests (TEST-05)

```typescript
// src/lib/__tests__/piiMasker.test.ts
import { describe, it, expect } from 'vitest';
import { maskEmail, maskDocument, maskOrderPayload } from '@/lib/piiMasker';

describe('maskEmail', () => {
  it('masks with first char + *** + @domain', () => {
    expect(maskEmail('diego.cione@vtex.com')).toBe('d***@vtex.com');
  });
  it('handles null/undefined gracefully', () => {
    expect(maskEmail(null)).toBe('');
    expect(maskEmail(undefined)).toBe('');
  });
});

describe('maskDocument', () => {
  it('masks CPF leaving last 2 digits', () => {
    expect(maskDocument('123.456.789-09')).toBe('***-09');
  });
  it('masks CNPJ leaving last 2 digits', () => {
    expect(maskDocument('12.345.678/0001-90')).toBe('***-90');
  });
});

describe('maskOrderPayload', () => {
  it('masks email and document in clientProfileData', () => {
    const raw = { clientProfileData: { email: 'real@test.com', document: '123.456.789-09' } };
    const masked = maskOrderPayload(raw) as typeof raw;
    expect(masked.clientProfileData.email).not.toBe('real@test.com');
    expect(masked.clientProfileData.email).toContain('***');
    expect(masked.clientProfileData.document).not.toBe('123.456.789-09');
  });
  it('does not mutate the original object', () => {
    const raw = { clientProfileData: { email: 'real@test.com' } };
    maskOrderPayload(raw);
    expect(raw.clientProfileData.email).toBe('real@test.com');
  });
});
```

---

## VtexFeedItem Type Update Needed

The existing `VtexFeedItem` in `vtex.ts` has `state?: string` but the actual VTEX Feed v3 response uses `currentState` and `lastState`. The type needs to be updated:

```typescript
// Existing — add these fields:
export type VtexFeedItem = {
  handle: string;       // REQUIRED — used by commitFeedItems
  eventId?: string;     // Keep for forward compat
  id?: string;          // Keep for forward compat
  orderId?: string;
  state?: string;       // Keep existing — may be used by some VTEX configs
  currentState?: string; // ADD: VTEX Feed v3 primary state field
  lastState?: string;    // ADD: VTEX Feed v3 previous state
  currentChangeDate?: string; // ADD: used as dedup timestamp
  lastChangeDate?: string;
  parentAccountName?: string;
  date?: string;
};
```

This is a non-breaking change (adding optional fields). The deduplicator should prefer `currentState + currentChangeDate` over `state + date` for the composite key.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-fetch` for HTTP in Node | Native `fetch` built-in | Node 18+ (stable Node 24) | No dependency needed for vtexClient HTTP calls |
| `jest` for TypeScript tests | `vitest` | 2022-2023 (vitest 1.0) | Already installed; faster, native ESM, no transform config |
| `JSON.parse(JSON.stringify(x))` for deep clone | `structuredClone()` | Node 17+ (stable Node 24) | Handles dates, avoids JSON serialization edge cases |
| Concrete class VtexClient | Factory function + interface | Current best practice | Easier to mock in tests without class instantiation |

---

## Open Questions

1. **VTEX Feed response: array or wrapped object?**
   - What we know: VTEX Feed v3 retrieve returns an array of items with `handle`, `orderId`, `currentState`, `lastState`, `currentChangeDate`. Community sources confirm this.
   - What's unclear: Does the endpoint return a raw array `[...]` or a wrapped object `{ events: [...] }`? Some community examples show raw array; others mention a wrapper.
   - Recommendation: Write `getFeedItems` to handle both — if result is array use directly; if it has an `events` property, use that; otherwise return `[]`. This defensive normalization costs nothing and prevents a cryptic undefined error.

2. **Start Handling: 200 with body or 204 no-content?**
   - What we know: VTEX returns `{ date, receipt }` on some endpoints; 204 on others. The `VtexStartHandlingResponse` type in `vtex.ts` has both `date` and `receipt` as optional.
   - What's unclear: The exact HTTP status code for a successful Start Handling call is not confirmed from official docs.
   - Recommendation: Handle both — check `res.status === 204` explicitly (already done in `createVtexClient` pattern above). Treat either 200 or 204 as success.

3. **Config merge order for simulateErpFailure in orderProcessor**
   - What we know: `store.ts` has `getConfigOverrides()` which holds UI-set values. `getServerConfig()` reads env vars. The merge should be `env defaults + in-memory overrides`.
   - What's unclear: Who is responsible for merging? The API route (caller) or `orderProcessor` (callee)?
   - Recommendation: The API route is responsible for building merged config and passing it to `processOrder(orderId, source, { vtexClient, config: merged })`. `orderProcessor` never calls `getServerConfig()` or `getConfigOverrides()` directly. This keeps the module pure and testable.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (root) — already configured with `jsdom`, `globals: true`, path aliases |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |
| Watch mode | `npm run test:watch` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | getOrder calls correct VTEX endpoint with auth headers | unit (mock fetch) | `npm test -- piiMasker` | No — Wave 0 |
| PIPE-02 | normalizeOrder maps all required ERP fields from VtexOrder | unit (pure) | `npm test -- erpSimulator` | No — Wave 0 |
| PIPE-02 | normalizeOrder handles null clientProfileData gracefully | unit (pure) | `npm test -- erpSimulator` | No — Wave 0 |
| PIPE-03 | simulateErpAcceptance returns SUCCESS when flag false | unit (pure) | `npm test -- erpSimulator` | No — Wave 0 |
| PIPE-03 | simulateErpAcceptance returns FAILURE when flag true | unit (pure) | `npm test -- erpSimulator` | No — Wave 0 |
| PIPE-05 | startHandling NOT called when ERP returns FAILURE | unit (mock client) | `npm test -- orderProcessor` | No — Wave 0 |
| PIPE-06 | startHandling NOT called when getOrder throws | unit (mock client) | `npm test -- orderProcessor` | No — Wave 0 |
| PIPE-07 | startHandling NOT called when startHandlingStatus is SUCCESS | unit (mock client) | `npm test -- orderProcessor` | No — Wave 0 |
| PIPE-08 | Timeline entries written for each pipeline step | unit (mock client) | `npm test -- orderProcessor` | No — Wave 0 |
| SEC-01 | maskEmail produces d***@domain.com format | unit (pure) | `npm test -- piiMasker` | No — Wave 0 |
| SEC-02 | maskDocument produces ***-XX format for CPF and CNPJ | unit (pure) | `npm test -- piiMasker` | No — Wave 0 |
| SEC-03 | vtexOrderRaw stored on record has masked email and document | unit (pure) | `npm test -- piiMasker` | No — Wave 0 |
| TEST-01 | normalizeOrder unit tests (fields, optional handling) | unit | `npm test -- erpSimulator` | No — Wave 0 |
| TEST-02 | Dedup by eventId, composite key fallback, non-duplicates pass | unit | `npm test -- deduplicator` | No — Wave 0 |
| TEST-03 | extractOrderId handles multiple hook payload shapes | unit | `npm test -- erpSimulator` | No — Wave 0 |
| TEST-04 | ERP simulator: SUCCESS default, FAILURE when toggle on | unit | `npm test -- erpSimulator` | No — Wave 0 |
| TEST-05 | PII masking: email, document, leaves non-PII unchanged | unit | `npm test -- piiMasker` | No — Wave 0 |
| TEST-06 | Start Handling guard conditions: 4 scenarios | unit | `npm test -- orderProcessor` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- [module-name]` (single module test file)
- **Per wave merge:** `npm test` (full suite — all test files in `src/**/*.test.ts`)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

All of the following test files are new — none exist yet:

- [ ] `src/lib/__tests__/piiMasker.test.ts` — covers SEC-01, SEC-02, SEC-03, TEST-05
- [ ] `src/lib/__tests__/deduplicator.test.ts` — covers TEST-02
- [ ] `src/lib/__tests__/erpSimulator.test.ts` — covers TEST-01, TEST-03, TEST-04, PIPE-02, PIPE-03
- [ ] `src/lib/__tests__/vtexClient.test.ts` — covers PIPE-01 (mock `fetch` with `vi.stubGlobal`)
- [ ] `src/lib/__tests__/orderProcessor.test.ts` — covers TEST-06, PIPE-05, PIPE-06, PIPE-07, PIPE-08

Existing test infrastructure covers Phase 1 modules and can be reused as patterns. The `__resetStoreForTests()` helper from `store.ts` must be called in `beforeEach` for any test that reads or writes store state.

---

## Sources

### Primary (HIGH confidence)
- `src/types/erp.ts` — ErpOrderPayload, ErpOrderRecord, ErpTimelineEntry, PipelineStepName, ErpSimulationResult shapes
- `src/types/vtex.ts` — VtexOrder, VtexFeedItem, VtexHookPayload, VtexApiErrorShape shapes
- `src/lib/store.ts` — All store mutation functions available (upsertOrder, appendTimelineEntry, etc.)
- `src/lib/config.ts` — getServerConfig(), getPublicConfig(), maskToken() pattern
- `src/lib/constants.ts` — VTEX_API_PATHS, buildVtexBaseUrl(), VTEX_REQUIRED_HEADERS
- `src/lib/__tests__/store.test.ts` — Test patterns: beforeEach(__resetStoreForTests), vi.fn() style
- `.planning/research/ARCHITECTURE.md` — Module boundary definitions, build order, injection pattern
- `.planning/research/PITFALLS.md` — C2 (ERP guard), C3 (double startHandling guard), C7 (PII raw payload), S4 (optional chaining), S5 (dedup key), M4 (handle vs eventId), M6 (Content-Type header), M7 (PII in event log)
- `vitest.config.ts` — jsdom environment, globals, path aliases all confirmed

### Secondary (MEDIUM confidence)
- VTEX Feed v3 community docs and GitHub orders-feed-example: Feed item shape confirmed as `{ handle, orderId, currentState, lastState, currentChangeDate, lastChangeDate, domain }`. Handle is JWT-like string.
- VTEX Feed commit: `POST /api/orders/feed` with body `{ handles: string[] }` — consistent across multiple community sources.
- VTEX Start Handling: `POST /api/oms/pvt/orders/{orderId}/start-handling` with empty body, returns 200 or 204 — consistent with `VtexStartHandlingResponse` type already defined.
- Node 24 native `fetch` and `structuredClone` availability: confirmed by Node 18+ release notes and package.json `engines: { node: ">=24.0.0" }`.

### Tertiary (LOW confidence — flag for validation during implementation)
- VTEX Feed response wrapper: unclear if `GET /api/orders/feed` returns raw array or `{ events: [...] }` — implement defensively
- VTEX Start Handling exact HTTP status code: may be 200 or 204 — handle both
- VTEX Feed `maxLot` parameter name: confirmed from training data; verify against actual VTEX response during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed and confirmed in package.json
- Architecture patterns: HIGH — built directly from Phase 1 code, existing types, and documented pitfalls
- VTEX API endpoints (Get Order, Start Handling): HIGH — paths confirmed in constants.ts (from Phase 1 research)
- VTEX Feed item shape / commit body: MEDIUM — inaccessible official docs; cross-verified via community sources
- Pitfalls: HIGH — directly from PITFALLS.md research document, each flagged with phase attribution

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (VTEX API shapes are stable; Feed v3 has been stable since 2020)
