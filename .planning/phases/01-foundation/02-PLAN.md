---
plan: 2
phase: 1
wave: 2
title: Shared TypeScript Types — VtexOrder, ErpOrderRecord, ErpOrderPayload, Pipeline Types
depends_on: [1]
files_modified:
  - src/types/index.ts
  - src/types/vtex.ts
  - src/types/erp.ts
  - src/types/__tests__/types.test.ts
requirements_addressed: []
requirements: []
autonomous: true
must_haves:
  truths:
    - "Every type required by sections 12 and 15 of CLAUDE.MD is exported from `@/types`"
    - "Importing `ErpOrderRecord`, `ErpOrderPayload`, `VtexOrder`, `IntegrationSource`, `ErpStatus`, `StartHandlingStatus`, `TimelineStatus` from `@/types` compiles under strict mode"
    - "All optional VTEX fields are typed with `?:` (not required), preventing PITFALLS S4 (runtime crashes on missing fields)"
    - "TypeScript build passes (`npx tsc --noEmit` exits 0) with the new types in place"
  artifacts:
    - path: "src/types/index.ts"
      provides: "Public type surface for the entire app — re-exports from vtex.ts and erp.ts"
      contains: "export type ErpOrderRecord"
    - path: "src/types/erp.ts"
      provides: "ERP domain types: ErpStatus, StartHandlingStatus, IntegrationSource, TimelineStatus, ErpOrderPayload, ErpOrderRecord, ErpTimelineEntry"
      contains: "export type ErpStatus"
    - path: "src/types/vtex.ts"
      provides: "VTEX wire-format types: VtexOrder, FeedItem, FeedEvent, VtexClientItem, VtexShippingData, VtexPaymentData, VtexClientProfileData"
      contains: "export type VtexOrder"
    - path: "src/types/__tests__/types.test.ts"
      provides: "Compile-time + runtime smoke test that every type can be constructed and assigned"
      contains: "ErpOrderRecord"
  key_links:
    - from: "src/types/index.ts"
      to: "src/types/erp.ts"
      via: "re-export"
      pattern: "export \\* from './erp'"
    - from: "src/types/index.ts"
      to: "src/types/vtex.ts"
      via: "re-export"
      pattern: "export \\* from './vtex'"
---

# Plan 2: Shared TypeScript Types — VtexOrder, ErpOrderRecord, ErpOrderPayload, Pipeline Types

## Objective
Define every shared TypeScript type the rest of the application depends on, so subsequent phases (core library, API routes, UI) can import a single stable type surface from `@/types` without ad-hoc `any` casts. This plan produces interfaces only — zero runtime logic.

## Context
This plan implements the **Data Model** specified in CLAUDE.MD section 15 and the ERP payload shape from section 12, plus the VTEX wire-format types needed by `vtexClient.ts` (Phase 2). All optional fields use `?:` to defend against PITFALL S4 (VTEX often returns partial orders for B2B/marketplace cases).

This plan creates types only. It must NOT import from any module other than `node:` builtins or other type files. No runtime side-effects.

The follow-up Plan 03 (in-memory store + env config) imports `ErpOrderRecord` and related types from this plan.

## Tasks

### Task 2.1: Create `src/types/erp.ts` with all ERP domain types

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/CLAUDE.MD (sections 12, 15 — exact type definitions)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/REQUIREMENTS.md (status enum values)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/ARCHITECTURE.md (Module Boundaries section)
</read_first>

<action>
Create the file `src/types/erp.ts` with EXACTLY these exports (do not omit any field, do not change literal-union member spelling — these strings are checked across the codebase):

```typescript
// src/types/erp.ts
// ERP domain types — the simulated ERP's view of an order.
// See CLAUDE.MD §12 (ErpOrderPayload) and §15 (ErpOrderRecord, status enums).

export type IntegrationSource = "FEED" | "HOOK";

export type TimelineStatus = "SUCCESS" | "ERROR" | "INFO" | "SKIPPED";

export type ErpStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "ERP_ACCEPTED"
  | "START_HANDLING_SUCCESS"
  | "START_HANDLING_ERROR"
  | "ERROR"
  | "DUPLICATE_IGNORED"
  | "MANUALLY_RESOLVED";

export type StartHandlingStatus =
  | "NOT_STARTED"
  | "SUCCESS"
  | "ERROR";

export type PipelineStepName =
  | "EVENT_RECEIVED"
  | "GET_ORDER_REQUESTED"
  | "GET_ORDER_SUCCESS"
  | "GET_ORDER_ERROR"
  | "ERP_PAYLOAD_NORMALIZED"
  | "ERP_SIMULATION_STARTED"
  | "ERP_SIMULATION_SUCCESS"
  | "ERP_SIMULATION_ERROR"
  | "START_HANDLING_REQUESTED"
  | "START_HANDLING_SUCCESS"
  | "START_HANDLING_ERROR"
  | "FEED_ITEM_COMMITTED"
  | "DUPLICATE_IGNORED"
  | "MANUALLY_RESOLVED"
  | "ERROR";

export type ErpTimelineEntry = {
  timestamp: string; // ISO 8601
  step: PipelineStepName | string; // string fallback for ad-hoc messages
  status: TimelineStatus;
  message?: string;
};

export type ErpOrderItem = {
  skuId?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  price?: number;
  sellingPrice?: number;
  total?: number;
};

export type ErpOrderCustomer = {
  name?: string;
  emailMasked?: string;
  documentMasked?: string;
};

// The normalized payload an ERP would consume — see CLAUDE.MD §12.
export type ErpOrderPayload = {
  externalOrderId: string;
  orderId: string;
  sequence?: string;
  status?: string;
  creationDate?: string;
  customer?: ErpOrderCustomer;
  items: ErpOrderItem[];
  totals?: unknown;
  paymentSummary?: string;
  shippingSummary?: string;
  logisticsInfo?: unknown;
  marketplace?: string;
  rawSource?: "VTEX";
};

export type ErpSimulationResult =
  | { status: "SUCCESS"; acceptedAt: string }
  | { status: "FAILURE"; reason: string; failedAt: string };

// The internal record stored in the in-memory store — see CLAUDE.MD §15.
export type ErpOrderRecord = {
  id: string;                         // app-internal id (uuid or orderId)
  orderId: string;                    // VTEX orderId
  sequence?: string;                  // VTEX sequence
  source: IntegrationSource;
  vtexStatus?: string;
  erpStatus: ErpStatus;
  startHandlingStatus: StartHandlingStatus;
  customerName?: string;
  customerEmailMasked?: string;
  totalValue?: number;
  itemCount?: number;
  paymentSummary?: string;
  shippingSummary?: string;
  receivedAt: string;                 // ISO 8601
  lastAttemptAt?: string;             // ISO 8601
  attempts: number;
  errorMessage?: string;
  vtexOrderRaw?: unknown;             // PII-masked raw payload (see SEC-03)
  erpPayload?: ErpOrderPayload;
  startHandlingResponse?: unknown;
  timeline: ErpTimelineEntry[];
};

// Event log entry for the technical/debug view (separate from the per-order timeline).
export type EventLogEntry = {
  timestamp: string;
  source: IntegrationSource | "SYSTEM";
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  orderId?: string;
  payload?: unknown; // PII-masked
};

// Configuration shape (used by the in-memory config in Plan 03 and CONFIG-* requirements in Phase 4).
export type IntegrationMode = "FEED" | "HOOK";

export type AppConfig = {
  account: string;
  environment: string;
  appKey: string;
  // appToken is intentionally NOT exposed in this type because it must never be returned in API responses.
  // The store keeps it internally; the API surface uses AppConfigPublic instead.
  integrationMode: IntegrationMode;
  autoCommitFeed: boolean;
  simulateErpFailure: boolean;
};

// Public-safe config (returned by GET /api/config — never includes the token).
export type AppConfigPublic = AppConfig & {
  appTokenConfigured: boolean;
};
```

Rules to follow exactly:
- The literal union members (e.g., `"RECEIVED" | "PROCESSING" | ...`) MUST match the strings listed above. They are referenced verbatim by INBOX-05 (Phase 4 filter dropdown), CLAUDE.MD §13, and the test suite.
- Every VTEX-derived field on `ErpOrderRecord` is optional (`?:`) except `id`, `orderId`, `source`, `erpStatus`, `startHandlingStatus`, `receivedAt`, `attempts`, `timeline`. Defending against partial VTEX responses is mandatory (PITFALL S4).
- Do NOT add `appToken` to any exported type. If you need a server-internal config type that includes the token, define it inside the future `src/lib/config.ts` (Plan 03) — not in `@/types`.
</action>

<acceptance_criteria>
- File `src/types/erp.ts` exists
- `grep -q "export type ErpStatus" src/types/erp.ts` exits 0
- `grep -q "export type ErpOrderRecord" src/types/erp.ts` exits 0
- `grep -q "export type ErpOrderPayload" src/types/erp.ts` exits 0
- `grep -q "export type IntegrationSource" src/types/erp.ts` exits 0
- `grep -q "export type StartHandlingStatus" src/types/erp.ts` exits 0
- `grep -q "export type TimelineStatus" src/types/erp.ts` exits 0
- `grep -q "export type ErpTimelineEntry" src/types/erp.ts` exits 0
- `grep -q "export type AppConfig" src/types/erp.ts` exits 0
- `grep -q "export type EventLogEntry" src/types/erp.ts` exits 0
- File does NOT contain the literal substring `appToken:` (the token is never on a public type)
- All eight `ErpStatus` members are present: `grep -E "RECEIVED|PROCESSING|ERP_ACCEPTED|START_HANDLING_SUCCESS|START_HANDLING_ERROR|ERROR|DUPLICATE_IGNORED|MANUALLY_RESOLVED" src/types/erp.ts | wc -l` is at least 8
- `npx tsc --noEmit` exits 0 after this file is added
</acceptance_criteria>

---

### Task 2.2: Create `src/types/vtex.ts` with VTEX wire-format types

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/CLAUDE.MD (sections 7, 11)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/PITFALLS.md (S4, S5, M4)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/ARCHITECTURE.md (vtexClient.ts boundary)
</read_first>

<action>
Create the file `src/types/vtex.ts` with EXACTLY these exports. Every field is optional (`?:`) except where the VTEX API contract guarantees presence. This is intentional — the normalizer (Phase 2) handles partial orders defensively.

```typescript
// src/types/vtex.ts
// VTEX OMS wire-format types — the shapes the VTEX API actually returns.
// All fields default to optional to defend against partial responses (PITFALL S4).

export type VtexClientProfileData = {
  email?: string;
  firstName?: string;
  lastName?: string;
  document?: string;
  documentType?: string;
  phone?: string;
  corporateName?: string;
  isCorporate?: boolean;
};

export type VtexShippingAddress = {
  addressId?: string;
  addressType?: string;
  receiverName?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  complement?: string;
  reference?: string;
};

export type VtexLogisticsInfo = {
  itemIndex?: number;
  selectedSla?: string;
  selectedDeliveryChannel?: string;
  shippingEstimate?: string;
  shippingEstimateDate?: string;
  deliveryCompany?: string;
  deliveryWindow?: unknown;
  price?: number;
  listPrice?: number;
  sellingPrice?: number;
};

export type VtexShippingData = {
  address?: VtexShippingAddress;
  logisticsInfo?: VtexLogisticsInfo[];
};

export type VtexOrderItem = {
  uniqueId?: string;
  id?: string;       // skuId
  productId?: string;
  ean?: string;
  refId?: string;
  name?: string;
  quantity?: number;
  price?: number;
  listPrice?: number;
  sellingPrice?: number;
  measurementUnit?: string;
  unitMultiplier?: number;
  imageUrl?: string;
};

export type VtexPaymentTransaction = {
  transactionId?: string;
  paymentSystemName?: string;
  installments?: number;
  value?: number;
  status?: string;
  group?: string;
};

export type VtexPaymentData = {
  transactions?: Array<{
    transactionId?: string;
    payments?: VtexPaymentTransaction[];
  }>;
};

export type VtexTotal = {
  id?: string;        // "Items" | "Discounts" | "Shipping" | "Tax" | ...
  name?: string;
  value?: number;
};

// Top-level VTEX Get Order response.
export type VtexOrder = {
  orderId?: string;
  sequence?: string;
  status?: string;
  statusDescription?: string;
  creationDate?: string;
  lastChange?: string;
  marketplaceOrderId?: string;
  marketplaceServicesEndpoint?: string;
  origin?: string;
  affiliateId?: string;
  salesChannel?: string;
  storePreferencesData?: unknown;
  value?: number;
  totals?: VtexTotal[];
  items?: VtexOrderItem[];
  clientProfileData?: VtexClientProfileData | null;
  shippingData?: VtexShippingData | null;
  paymentData?: VtexPaymentData | null;
  hostname?: string;
  customData?: unknown;
};

// VTEX Feed item (the queue entry — see CLAUDE.MD §11, PITFALL M4).
// `handle` is the commit identifier; `eventId`/`id` (if present) is the dedup identifier.
export type VtexFeedItem = {
  handle: string;       // REQUIRED — used by commitFeedItems
  eventId?: string;
  id?: string;
  orderId?: string;
  state?: string;
  parentAccountName?: string;
  date?: string;
};

// VTEX Hook payload — orderId may live at multiple paths (PITFALL C6).
// Typed as a discriminated grab-bag; extraction logic in Phase 3 handles the variants.
export type VtexHookPayload = {
  orderId?: string;
  OrderId?: string;
  state?: string;
  domain?: string;
  lastState?: string;
  currentState?: string;
  lastChange?: string;
  vtexAccount?: string;
  order?: { orderId?: string; OrderId?: string; state?: string };
  data?: { orderId?: string; OrderId?: string; state?: string };
  // Catch-all for unforeseen shapes — extraction is best-effort.
  [key: string]: unknown;
};

// Start Handling response — VTEX returns no body on success; minimal type.
export type VtexStartHandlingResponse = {
  date?: string;
  receipt?: string;
};

// Typed VTEX error wrapper (thrown by vtexClient on non-2xx).
export type VtexApiErrorShape = {
  status: number;
  statusText?: string;
  body?: unknown;
  url: string;
};
```

Do not add a `password`, `appToken`, or `secret` field to any VTEX type. These are credentials, not wire-format fields.
</action>

<acceptance_criteria>
- File `src/types/vtex.ts` exists
- `grep -q "export type VtexOrder" src/types/vtex.ts` exits 0
- `grep -q "export type VtexFeedItem" src/types/vtex.ts` exits 0
- `grep -q "export type VtexHookPayload" src/types/vtex.ts` exits 0
- `grep -q "export type VtexClientProfileData" src/types/vtex.ts` exits 0
- `grep -q "export type VtexShippingData" src/types/vtex.ts` exits 0
- `grep -q "export type VtexPaymentData" src/types/vtex.ts` exits 0
- `grep -q "export type VtexStartHandlingResponse" src/types/vtex.ts` exits 0
- `grep -q "handle: string" src/types/vtex.ts` exits 0 (VtexFeedItem.handle is required)
- File contains the literal substring `clientProfileData?: VtexClientProfileData | null` (note: optional + nullable, defends S4)
- `npx tsc --noEmit` exits 0 after this file is added
</acceptance_criteria>

---

### Task 2.3: Create barrel `src/types/index.ts` and a compile-smoke test

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/erp.ts (created in Task 2.1)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/vtex.ts (created in Task 2.2)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/vitest.config.ts (test glob pattern)
</read_first>

<action>
Create `src/types/index.ts` as a re-export barrel. EXACT content:

```typescript
// src/types/index.ts
// Public type surface for the entire app. Other modules import from `@/types`.

export * from './erp';
export * from './vtex';
```

Then create the smoke test at `src/types/__tests__/types.test.ts` to confirm every key type can be constructed and assigned. EXACT content:

```typescript
// src/types/__tests__/types.test.ts
// Compile-time + runtime smoke test for the shared types.
// Catches accidental rename, removal, or import-path breakage.

import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  AppConfig,
  AppConfigPublic,
  ErpOrderCustomer,
  ErpOrderItem,
  ErpOrderPayload,
  ErpOrderRecord,
  ErpSimulationResult,
  ErpStatus,
  ErpTimelineEntry,
  EventLogEntry,
  IntegrationMode,
  IntegrationSource,
  PipelineStepName,
  StartHandlingStatus,
  TimelineStatus,
  VtexFeedItem,
  VtexHookPayload,
  VtexOrder,
  VtexStartHandlingResponse,
} from '@/types';

describe('shared types', () => {
  it('constructs a minimal ErpOrderRecord', () => {
    const record: ErpOrderRecord = {
      id: 'rec-1',
      orderId: 'v1234',
      source: 'HOOK',
      erpStatus: 'RECEIVED',
      startHandlingStatus: 'NOT_STARTED',
      receivedAt: '2026-04-28T00:00:00.000Z',
      attempts: 0,
      timeline: [],
    };
    expect(record.orderId).toBe('v1234');
    expect(record.timeline).toHaveLength(0);
  });

  it('constructs a minimal ErpOrderPayload', () => {
    const payload: ErpOrderPayload = {
      externalOrderId: 'v1234',
      orderId: 'v1234',
      items: [],
    };
    expect(payload.items).toEqual([]);
  });

  it('accepts every ErpStatus literal', () => {
    const statuses: ErpStatus[] = [
      'RECEIVED',
      'PROCESSING',
      'ERP_ACCEPTED',
      'START_HANDLING_SUCCESS',
      'START_HANDLING_ERROR',
      'ERROR',
      'DUPLICATE_IGNORED',
      'MANUALLY_RESOLVED',
    ];
    expect(statuses).toHaveLength(8);
  });

  it('accepts every StartHandlingStatus literal', () => {
    const statuses: StartHandlingStatus[] = ['NOT_STARTED', 'SUCCESS', 'ERROR'];
    expect(statuses).toHaveLength(3);
  });

  it('accepts every IntegrationSource literal', () => {
    const sources: IntegrationSource[] = ['FEED', 'HOOK'];
    expect(sources).toHaveLength(2);
  });

  it('accepts every TimelineStatus literal', () => {
    const statuses: TimelineStatus[] = ['SUCCESS', 'ERROR', 'INFO', 'SKIPPED'];
    expect(statuses).toHaveLength(4);
  });

  it('VtexFeedItem requires handle', () => {
    const item: VtexFeedItem = { handle: 'h-1' };
    expect(item.handle).toBe('h-1');
    // Type-level check: handle is a required string
    expectTypeOf<VtexFeedItem>().toHaveProperty('handle').toBeString();
  });

  it('VtexOrder.clientProfileData is optional and nullable', () => {
    const o1: VtexOrder = {};
    const o2: VtexOrder = { clientProfileData: null };
    const o3: VtexOrder = { clientProfileData: { email: 'x@y.z' } };
    expect(o1.clientProfileData).toBeUndefined();
    expect(o2.clientProfileData).toBeNull();
    expect(o3.clientProfileData?.email).toBe('x@y.z');
  });

  it('AppConfigPublic carries appTokenConfigured but not appToken', () => {
    const cfg: AppConfigPublic = {
      account: 'demo',
      environment: 'vtexcommercestable.com.br',
      appKey: 'k',
      integrationMode: 'HOOK',
      autoCommitFeed: false,
      simulateErpFailure: false,
      appTokenConfigured: true,
    };
    expect(cfg.appTokenConfigured).toBe(true);
    // @ts-expect-error appToken must NOT be a property of AppConfigPublic
    const _shouldNotCompile: string = cfg.appToken;
  });

  it('ErpSimulationResult is a discriminated union', () => {
    const ok: ErpSimulationResult = { status: 'SUCCESS', acceptedAt: 'now' };
    const fail: ErpSimulationResult = { status: 'FAILURE', reason: 'simulated', failedAt: 'now' };
    expect(ok.status).toBe('SUCCESS');
    expect(fail.status).toBe('FAILURE');
  });

  it('PipelineStepName covers expected steps', () => {
    const steps: PipelineStepName[] = [
      'EVENT_RECEIVED',
      'GET_ORDER_REQUESTED',
      'GET_ORDER_SUCCESS',
      'ERP_PAYLOAD_NORMALIZED',
      'ERP_SIMULATION_SUCCESS',
      'START_HANDLING_SUCCESS',
    ];
    expect(steps).toHaveLength(6);
  });
});
```

Notes:
- The `// @ts-expect-error` comment is intentional: it asserts that `cfg.appToken` does NOT exist on `AppConfigPublic`. If somebody adds `appToken` to that type later, the directive fails the build — exactly what we want for SEC-04.
- This file uses `expectTypeOf` from Vitest 4. If the API changed in a minor revision, fall back to runtime assertions only — but keep the `@ts-expect-error` directive because that is the actual guard for SEC-04.

Run `npx tsc --noEmit` and `npm test` to confirm both pass.
</action>

<acceptance_criteria>
- File `src/types/index.ts` exists
- `grep -q "export \* from './erp'" src/types/index.ts` exits 0 (literal `export * from './erp'`)
- `grep -q "export \* from './vtex'" src/types/index.ts` exits 0
- File `src/types/__tests__/types.test.ts` exists
- `grep -q "ErpOrderRecord" src/types/__tests__/types.test.ts` exits 0
- `grep -q "@ts-expect-error" src/types/__tests__/types.test.ts` exits 0 (the SEC-04 type-level guard)
- Command `npx tsc --noEmit` exits 0
- Command `npm test` exits 0 and stdout reports the new tests (at least 11 total tests, including the smoke test from Plan 1)
- Command `npm test` stdout contains the substring `shared types` (the describe block name)
</acceptance_criteria>

---

## Verification

### Must-Haves (phase goal requires these)
- [ ] All shared TypeScript types are defined in `src/types/` and exported from `@/types` (Tasks 2.1, 2.2, 2.3)
- [ ] `import { ErpOrderRecord, VtexOrder, ErpOrderPayload } from '@/types'` compiles under strict mode (Task 2.3 test file proves this)
- [ ] `npx tsc --noEmit` exits 0 with all type files in place (each task)
- [ ] `npm test` exits 0 and runs the new type smoke tests (Task 2.3)
- [ ] No type file exposes `appToken` on a publicly-shaped type (SEC-04 type-level guard)

### Should-Haves
- [ ] Every VTEX field that VTEX may omit is typed as optional (`?:`) — defends PITFALL S4
- [ ] `VtexFeedItem.handle` is required (PITFALL M4 — handle vs eventId distinction)
- [ ] All status string literals match CLAUDE.MD §15 EXACTLY (no typos like `MANUALLY_RESOLVE`)
- [ ] `PipelineStepName` enumerates every step listed in CLAUDE.MD §14.7 (Processing Timeline section)
