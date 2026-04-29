---
plan: 4
phase: 2
wave: 4
title: Order Processor with Pipeline Orchestration and Guards
depends_on:
  - 1
  - 2
  - 3
files_modified:
  - src/lib/orderProcessor.ts
  - src/lib/__tests__/orderProcessor.test.ts
requirements_addressed:
  - PIPE-04
  - PIPE-05
  - PIPE-06
  - PIPE-07
  - PIPE-08
  - TEST-06
autonomous: true
must_haves:
  truths:
    - "processOrder calls vtexClient.startHandling after successful ERP simulation (PIPE-04)"
    - "processOrder does NOT call vtexClient.startHandling when simulateErpAcceptance returns FAILURE (PIPE-05)"
    - "processOrder does NOT call vtexClient.startHandling when vtexClient.getOrder throws (PIPE-06)"
    - "processOrder does NOT call vtexClient.getOrder or vtexClient.startHandling when record.startHandlingStatus is already 'SUCCESS' (PIPE-07)"
    - "processOrder writes a timestamped ErpTimelineEntry for every pipeline step: GET_ORDER_REQUESTED, GET_ORDER_SUCCESS or GET_ORDER_ERROR, ERP_PAYLOAD_NORMALIZED, ERP_SIMULATION_STARTED, ERP_SIMULATION_SUCCESS or ERP_SIMULATION_ERROR, START_HANDLING_REQUESTED, START_HANDLING_SUCCESS or START_HANDLING_ERROR (PIPE-08)"
    - "processOrder accepts vtexClient and config as injected parameters — never calls getServerConfig()"
    - "processOrder uses maskOrderPayload before storing vtexOrderRaw on the record (SEC-03)"
    - "All three guard conditions verified by unit tests in orderProcessor.test.ts (TEST-06)"
  artifacts:
    - path: "src/lib/orderProcessor.ts"
      provides: "processOrder async function + ProcessOrderDeps interface"
      exports: ["processOrder", "ProcessOrderDeps"]
    - path: "src/lib/__tests__/orderProcessor.test.ts"
      provides: "Vitest suite for TEST-06 — all four guard scenarios + happy path"
  key_links:
    - from: "src/lib/orderProcessor.ts"
      to: "src/lib/vtexClient.ts"
      via: "VtexClient interface injected via ProcessOrderDeps.vtexClient"
      pattern: "ProcessOrderDeps"
    - from: "src/lib/orderProcessor.ts"
      to: "src/lib/erpSimulator.ts"
      via: "imports normalizeOrder, simulateErpAcceptance"
      pattern: "from ['\"]@/lib/erpSimulator['\"]"
    - from: "src/lib/orderProcessor.ts"
      to: "src/lib/piiMasker.ts"
      via: "imports maskOrderPayload — applied to vtexOrderRaw before store write"
      pattern: "maskOrderPayload"
    - from: "src/lib/orderProcessor.ts"
      to: "src/lib/store.ts"
      via: "imports upsertOrder, getOrderByOrderId, setOrderStatus, appendTimelineEntry, incrementAttempts"
      pattern: "from ['\"]@/lib/store['\"]"
    - from: "src/lib/__tests__/orderProcessor.test.ts"
      to: "src/lib/store.ts"
      via: "imports upsertOrder, __resetStoreForTests"
      pattern: "__resetStoreForTests"
---

# Plan 4: Order Processor with Pipeline Orchestration and Guards

## Objective

Implement `orderProcessor.ts` — the single module that orchestrates the complete pipeline (Get Order → PII-mask raw → normalize → ERP simulate → Start Handling) and enforces all three Start Handling guards (PIPE-05, PIPE-06, PIPE-07) with timestamped timeline recording at every step. Wave 4 depends on Plans 1 (piiMasker), 2 (vtexClient), and 3 (erpSimulator).

## Tasks

### Task 4.1: Implement orderProcessor.ts with full pipeline and guards

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/store.ts (upsertOrder, getOrderByOrderId, setOrderStatus, appendTimelineEntry, incrementAttempts signatures)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/vtexClient.ts (VtexClient interface, VtexApiError)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/erpSimulator.ts (normalizeOrder, simulateErpAcceptance)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/piiMasker.ts (maskOrderPayload)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/erp.ts (IntegrationSource, AppConfig, ErpOrderRecord, PipelineStepName)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/phases/02-core-library-modules/02-RESEARCH.md (Module 5: orderProcessor.ts section, Guard Test Pattern section)
</read_first>

<action>
Create `src/lib/orderProcessor.ts` with the contract below.

**CRITICAL constraints:**
- `processOrder` accepts `vtexClient` and `config` as injected dependencies. Never call `getServerConfig()` inside this module. The API route caller is responsible for building merged config and passing it in.
- All three Start Handling guards MUST be in this file only (not scattered across other modules):
  - PIPE-07: `record.startHandlingStatus === 'SUCCESS'` → skip entire pipeline, write SKIPPED timeline entry
  - PIPE-06: `vtexClient.getOrder` throws → write GET_ORDER_ERROR timeline entry, return early (no Start Handling)
  - PIPE-05: `simulateErpAcceptance` returns `status !== 'SUCCESS'` → write ERP_SIMULATION_ERROR timeline entry, return early (no Start Handling)
- `maskOrderPayload` MUST be called on `vtexOrder` before assigning to `vtexOrderRaw` on the record (SEC-03).
- Timeline entries MUST use exact `PipelineStepName` values from `src/types/erp.ts`:
  - `'GET_ORDER_REQUESTED'`, `'GET_ORDER_SUCCESS'`, `'GET_ORDER_ERROR'`
  - `'ERP_PAYLOAD_NORMALIZED'`, `'ERP_SIMULATION_STARTED'`, `'ERP_SIMULATION_SUCCESS'`, `'ERP_SIMULATION_ERROR'`
  - `'START_HANDLING_REQUESTED'`, `'START_HANDLING_SUCCESS'`, `'START_HANDLING_ERROR'`
- Every `appendTimelineEntry` call MUST include `timestamp: new Date().toISOString()`.
- `processOrder` must be the ONLY exported async function. The `ProcessOrderDeps` interface must also be exported.

```typescript
// src/lib/orderProcessor.ts
// Full pipeline orchestration: Get Order → PII mask → normalize → ERP simulate → Start Handling.
// All three Start Handling guards live here (PIPE-05, PIPE-06, PIPE-07).
// Accepts injected dependencies for testability — never calls getServerConfig() directly.

import type { IntegrationSource, AppConfig } from '@/types/erp';
import type { VtexClient } from '@/lib/vtexClient';
import {
  upsertOrder,
  getOrderByOrderId,
  setOrderStatus,
  appendTimelineEntry,
  incrementAttempts,
} from '@/lib/store';
import { normalizeOrder, simulateErpAcceptance } from '@/lib/erpSimulator';
import { maskOrderPayload } from '@/lib/piiMasker';

export interface ProcessOrderDeps {
  vtexClient: VtexClient;
  config: Pick<AppConfig, 'simulateErpFailure'>;
}

/**
 * Run the full processing pipeline for a given orderId.
 * The record must already exist in the store before this is called (created by the caller).
 *
 * Guard ordering:
 *   1. PIPE-07: If startHandlingStatus === 'SUCCESS' → write SKIPPED timeline entry and return.
 *   2. PIPE-06: If getOrder throws → write GET_ORDER_ERROR timeline entry and return.
 *   3. PIPE-05: If ERP simulation returns FAILURE → write ERP_SIMULATION_ERROR timeline entry and return.
 *
 * Timeline entries are written for every pipeline step (PIPE-08).
 * vtexOrderRaw stored on the record is always PII-masked via maskOrderPayload (SEC-03).
 */
export async function processOrder(
  orderId: string,
  _source: IntegrationSource,
  deps: ProcessOrderDeps,
): Promise<void> {
  const record = getOrderByOrderId(orderId);
  if (!record) return;

  // PIPE-07 guard: already successfully handled — skip entire pipeline
  if (record.startHandlingStatus === 'SUCCESS') {
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_REQUESTED',
      status: 'SKIPPED',
      message: 'Order already has startHandlingStatus SUCCESS — pipeline skipped (PIPE-07)',
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
    message: `Calling VTEX Get Order for orderId: ${orderId}`,
  });

  let vtexOrder;
  try {
    vtexOrder = await deps.vtexClient.getOrder(orderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setOrderStatus(record.id, 'ERROR');
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'GET_ORDER_ERROR',
      status: 'ERROR',
      message,
    });
    // PIPE-06: Do NOT proceed to Start Handling
    return;
  }

  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'GET_ORDER_SUCCESS',
    status: 'SUCCESS',
    message: `Get Order succeeded for orderId: ${orderId}`,
  });

  // Step 2: Normalize + store PII-masked raw payload (SEC-03)
  const erpPayload = normalizeOrder(vtexOrder);
  const maskedRaw = maskOrderPayload(vtexOrder);

  // Re-fetch the record to get the latest state before upsert
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
    // PIPE-05: Do NOT proceed to Start Handling
    return;
  }

  setOrderStatus(record.id, 'ERP_ACCEPTED');
  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'ERP_SIMULATION_SUCCESS',
    status: 'SUCCESS',
    message: erpResult.acceptedAt,
  });

  // Step 4: Start Handling (PIPE-04)
  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'START_HANDLING_REQUESTED',
    status: 'INFO',
  });

  try {
    await deps.vtexClient.startHandling(orderId);
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
</action>

<acceptance_criteria>
- `grep -E "^export async function processOrder" src/lib/orderProcessor.ts` returns 1 match
- `grep -E "^export interface ProcessOrderDeps" src/lib/orderProcessor.ts` returns 1 match
- `grep -E "getServerConfig|process\.env" src/lib/orderProcessor.ts` returns 0 matches
- `grep -E "maskOrderPayload" src/lib/orderProcessor.ts` returns at least 1 match
- `grep -E "GET_ORDER_REQUESTED|GET_ORDER_SUCCESS|GET_ORDER_ERROR" src/lib/orderProcessor.ts` returns at least 3 matches
- `grep -E "ERP_SIMULATION_STARTED|ERP_SIMULATION_SUCCESS|ERP_SIMULATION_ERROR" src/lib/orderProcessor.ts` returns at least 3 matches
- `grep -E "START_HANDLING_REQUESTED|START_HANDLING_SUCCESS|START_HANDLING_ERROR" src/lib/orderProcessor.ts` returns at least 3 matches
- `grep -E "PIPE-07|startHandlingStatus.*SUCCESS|SUCCESS.*startHandlingStatus" src/lib/orderProcessor.ts` returns at least 1 match (PIPE-07 guard comment or condition)
- `npx tsc --noEmit` passes with zero errors
</acceptance_criteria>

---

### Task 4.2: Write orderProcessor test suite (TEST-06) covering all guard scenarios

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/orderProcessor.ts (just created in Task 4.1)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/store.ts (upsertOrder, getOrderByOrderId, __resetStoreForTests)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/vtexClient.ts (VtexClient interface, VtexApiError)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/phases/02-core-library-modules/02-RESEARCH.md (Guard Test Pattern section — use the exact makeMockVtexClient and guard test patterns)
</read_first>

<action>
Create `src/lib/__tests__/orderProcessor.test.ts`. Tests must inject mock `VtexClient` objects — never use `vi.stubGlobal` or import the real vtexClient factory.

**Helper at top of test file:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processOrder } from '@/lib/orderProcessor';
import { upsertOrder, getOrderByOrderId, __resetStoreForTests } from '@/lib/store';
import { VtexApiError } from '@/lib/vtexClient';
import type { VtexClient } from '@/lib/vtexClient';
import type { ErpOrderRecord } from '@/types/erp';
import type { VtexOrder } from '@/types/vtex';

/** Minimal ErpOrderRecord for test seeding */
function makeRecord(overrides: Partial<ErpOrderRecord> = {}): ErpOrderRecord {
  return {
    id: 'rec-001',
    orderId: 'vtex-001',
    source: 'HOOK',
    erpStatus: 'RECEIVED',
    startHandlingStatus: 'NOT_STARTED',
    receivedAt: new Date().toISOString(),
    attempts: 0,
    timeline: [],
    ...overrides,
  };
}

/** Minimal VtexOrder returned by mock getOrder */
const MOCK_VTEX_ORDER: VtexOrder = {
  orderId: 'vtex-001',
  status: 'ready-for-handling',
  items: [],
  clientProfileData: {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    document: '12345678909',
  },
  shippingData: null,
  paymentData: null,
};

/** Create a mock VtexClient with all methods as vi.fn() — override as needed */
function makeMockVtexClient(overrides: Partial<VtexClient> = {}): VtexClient {
  return {
    getOrder: vi.fn().mockResolvedValue(MOCK_VTEX_ORDER),
    getFeedItems: vi.fn().mockResolvedValue([]),
    commitFeedItems: vi.fn().mockResolvedValue(undefined),
    startHandling: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  __resetStoreForTests();
  vi.clearAllMocks();
});
```

**Test groups (all MUST be present):**

1. `describe('processOrder — PIPE-07: guard against double Start Handling')`:
   - `it('does NOT call getOrder when startHandlingStatus is already SUCCESS')` — seed record with `startHandlingStatus: 'SUCCESS'`, run processOrder, assert `mockClient.getOrder` not called
   - `it('does NOT call startHandling when startHandlingStatus is already SUCCESS')` — assert `mockClient.startHandling` not called
   - `it('writes a SKIPPED timeline entry when startHandlingStatus is already SUCCESS')` — assert record timeline includes entry with `step: 'START_HANDLING_REQUESTED'` and `status: 'SKIPPED'`

2. `describe('processOrder — PIPE-06: guard when Get Order fails')`:
   - `it('does NOT call startHandling when getOrder throws VtexApiError 404')` — seed with NOT_STARTED record, mock `getOrder` to reject with `new VtexApiError({ status: 404, url: '/orders/vtex-001' })`, assert `mockClient.startHandling` not called
   - `it('does NOT call startHandling when getOrder throws VtexApiError 401')`
   - `it('does NOT call startHandling when getOrder throws a generic Error')`
   - `it('sets erpStatus to ERROR on the record when getOrder throws')` — assert `getOrderByOrderId('vtex-001')?.erpStatus === 'ERROR'`
   - `it('writes GET_ORDER_ERROR timeline entry when getOrder throws')` — assert timeline has entry with `step: 'GET_ORDER_ERROR'` and `status: 'ERROR'`

3. `describe('processOrder — PIPE-05: guard when ERP simulation fails')`:
   - `it('does NOT call startHandling when simulateErpFailure config is true')` — pass `config: { simulateErpFailure: true }`, assert `mockClient.startHandling` not called
   - `it('sets erpStatus to ERROR on the record when ERP simulation fails')`
   - `it('writes ERP_SIMULATION_ERROR timeline entry when ERP simulation fails')` — assert timeline has entry with `step: 'ERP_SIMULATION_ERROR'` and `status: 'ERROR'`

4. `describe('processOrder — PIPE-04 + PIPE-08: happy path')`:
   - `it('calls startHandling after successful ERP simulation')` — pass `config: { simulateErpFailure: false }`, assert `mockClient.startHandling` called once with `'vtex-001'`
   - `it('sets erpStatus to START_HANDLING_SUCCESS on the record after successful full pipeline')`
   - `it('sets startHandlingStatus to SUCCESS on the record')`
   - `it('records GET_ORDER_REQUESTED timeline entry')`
   - `it('records GET_ORDER_SUCCESS timeline entry')`
   - `it('records ERP_PAYLOAD_NORMALIZED timeline entry')`
   - `it('records ERP_SIMULATION_STARTED timeline entry')`
   - `it('records ERP_SIMULATION_SUCCESS timeline entry')`
   - `it('records START_HANDLING_REQUESTED timeline entry')`
   - `it('records START_HANDLING_SUCCESS timeline entry')`
   - `it('stores masked vtexOrderRaw — email is masked in the stored raw payload (SEC-03)')` — after processOrder, assert `record.vtexOrderRaw` as object does not contain `'test@example.com'` unmasked

5. `describe('processOrder — Start Handling error handling')`:
   - `it('sets startHandlingStatus to ERROR when startHandling throws')` — mock `startHandling` to reject, assert `getOrderByOrderId('vtex-001')?.startHandlingStatus === 'ERROR'`
   - `it('sets erpStatus to START_HANDLING_ERROR when startHandling throws')`
   - `it('writes START_HANDLING_ERROR timeline entry when startHandling throws')`

6. `describe('processOrder — no-op when record not found')`:
   - `it('does nothing when orderId does not exist in the store')` — do NOT seed a record, call processOrder, assert no throw and mock methods not called

Use `beforeEach(() => { __resetStoreForTests(); vi.clearAllMocks(); })` at the top level (already in template). Timeline assertions: `getOrderByOrderId('vtex-001')?.timeline.some(e => e.step === 'X' && e.status === 'Y')`.
</action>

<acceptance_criteria>
- File `src/lib/__tests__/orderProcessor.test.ts` exists
- `grep -c "describe(" src/lib/__tests__/orderProcessor.test.ts` returns at least 6
- `grep -c "it(" src/lib/__tests__/orderProcessor.test.ts` returns at least 26
- `grep -E "vi\.stubGlobal" src/lib/__tests__/orderProcessor.test.ts` returns 0 matches (only injected mocks)
- `grep -E "__resetStoreForTests" src/lib/__tests__/orderProcessor.test.ts` returns at least 2 matches
- `npx vitest run src/lib/__tests__/orderProcessor.test.ts --reporter=verbose` exits 0 with all tests passing
- `npm test` exits 0 (full test suite: all Phase 1 store tests + all Phase 2 piiMasker + deduplicator + erpSimulator + vtexClient + hookParser + orderProcessor tests)
- `npx tsc --noEmit` passes with zero errors
</acceptance_criteria>

---

## Verification

### Must-Haves

- [ ] `src/lib/orderProcessor.ts` exports `processOrder` and `ProcessOrderDeps`
- [ ] `processOrder` does NOT call `getServerConfig()` or read `process.env`
- [ ] `maskOrderPayload` is called on `vtexOrder` before `vtexOrderRaw` is stored (SEC-03)
- [ ] PIPE-07 guard: `startHandlingStatus === 'SUCCESS'` skips entire pipeline (getOrder not called)
- [ ] PIPE-06 guard: `getOrder` throws → return early, startHandling not called
- [ ] PIPE-05 guard: ERP FAILURE → return early, startHandling not called
- [ ] PIPE-08: all nine `PipelineStepName` step names written to timeline in happy path
- [ ] All guard scenarios tested and passing: `npx vitest run src/lib/__tests__/orderProcessor.test.ts --reporter=verbose`
- [ ] Full suite green: `npm test`
- [ ] `npx tsc --noEmit` passes with zero errors
