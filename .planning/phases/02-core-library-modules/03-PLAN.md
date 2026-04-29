---
plan: 3
phase: 2
wave: 3
title: ERP Simulator and Order Normalizer
depends_on:
  - 1
files_modified:
  - src/lib/erpSimulator.ts
  - src/lib/__tests__/erpSimulator.test.ts
requirements_addressed:
  - PIPE-02
  - PIPE-03
  - TEST-01
  - TEST-04
autonomous: true
must_haves:
  truths:
    - "normalizeOrder maps VtexOrder to ErpOrderPayload with all required fields set"
    - "normalizeOrder applies maskEmail and maskDocument to customer fields at normalization time (SEC-01, SEC-02)"
    - "normalizeOrder handles null/absent clientProfileData without throwing (PITFALL S4)"
    - "normalizeOrder uses optional chaining on all VtexOrder field accesses"
    - "simulateErpAcceptance returns { status: 'SUCCESS', acceptedAt: ISO string } when config.simulateErpFailure is false"
    - "simulateErpAcceptance returns { status: 'FAILURE', reason: string, failedAt: ISO string } when config.simulateErpFailure is true"
    - "simulateErpAcceptance never calls getServerConfig() — config is a parameter"
    - "normalizeOrder sets externalOrderId and orderId from vtexOrder.orderId (falls back to empty string)"
    - "normalizeOrder computes item.total as quantity * sellingPrice when both are present"
  artifacts:
    - path: "src/lib/erpSimulator.ts"
      provides: "normalizeOrder pure function + simulateErpAcceptance config-injected function"
      exports: ["normalizeOrder", "simulateErpAcceptance"]
    - path: "src/lib/__tests__/erpSimulator.test.ts"
      provides: "Vitest suite for TEST-01 (normalization) and TEST-04 (simulator)"
  key_links:
    - from: "src/lib/erpSimulator.ts"
      to: "src/lib/piiMasker.ts"
      via: "imports maskEmail, maskDocument from '@/lib/piiMasker'"
      pattern: "from ['\"]@/lib/piiMasker['\"]"
    - from: "src/lib/erpSimulator.ts"
      to: "src/types/vtex.ts"
      via: "imports VtexOrder type"
      pattern: "from ['\"]@/types/vtex['\"]"
    - from: "src/lib/erpSimulator.ts"
      to: "src/types/erp.ts"
      via: "imports ErpOrderPayload, ErpSimulationResult, AppConfig types"
      pattern: "from ['\"]@/types"
---

# Plan 3: ERP Simulator and Order Normalizer

## Objective

Implement `erpSimulator.ts` with two exports: `normalizeOrder` (pure VtexOrder → ErpOrderPayload transform with PII masking applied at normalization time) and `simulateErpAcceptance` (reads the injected config flag). Wave 3 because this module imports from `piiMasker.ts` (Wave 1).

## Tasks

### Task 3.1: Implement erpSimulator.ts

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/erp.ts (ErpOrderPayload, ErpSimulationResult, AppConfig, ErpOrderItem, ErpOrderCustomer)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/vtex.ts (VtexOrder, VtexOrderItem, VtexClientProfileData, VtexLogisticsInfo, VtexPaymentTransaction)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/piiMasker.ts (maskEmail, maskDocument signatures)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/phases/02-core-library-modules/02-RESEARCH.md (Module 3: erpSimulator.ts section, Pitfall 4)
</read_first>

<action>
Create `src/lib/erpSimulator.ts` with the exact contract below.

**CRITICAL constraints:**
- `normalizeOrder` is a pure function — no side effects, no imports from `store.ts`, no HTTP.
- Every field access on the VtexOrder MUST use optional chaining (`?.`) to defend against partial responses (PITFALL S4).
- PII masking (`maskEmail`, `maskDocument`) is applied inside `normalizeOrder` so the resulting `ErpOrderPayload` always has pre-masked values. Do not expose unmasked customer fields.
- `simulateErpAcceptance` accepts `config` as a parameter. Never call `getServerConfig()` here. This keeps the function testable with `{ simulateErpFailure: true }` passed directly.
- `simulateErpAcceptance` never throws — it returns an `ErpSimulationResult` union type.

```typescript
// src/lib/erpSimulator.ts
// Pure ERP normalization + simulated ERP acceptance.
// Both functions accept their inputs via parameters — no environment variable reads.
// PII masking is applied at normalization time (SEC-01, SEC-02, SEC-03).

import type { VtexOrder } from '@/types/vtex';
import type { ErpOrderPayload, ErpSimulationResult, AppConfig } from '@/types/erp';
import { maskEmail, maskDocument } from '@/lib/piiMasker';

/**
 * Map a full VTEX Get Order response to the normalized ERP payload.
 *
 * Rules:
 *  - externalOrderId and orderId: vtexOrder.orderId ?? ''
 *  - customer.emailMasked: maskEmail(profile?.email) — always masked
 *  - customer.documentMasked: maskDocument(profile?.document) — always masked
 *  - customer.name: firstName + ' ' + lastName (trimmed), or undefined if both absent
 *  - items[].total: quantity * sellingPrice (both must be non-null numbers), else undefined
 *  - paymentSummary: first transaction's first payment's paymentSystemName
 *  - shippingSummary: logisticsInfo[0].selectedSla
 *  - marketplace: 'MARKETPLACE' if marketplaceOrderId is non-empty, else undefined
 *  - rawSource: always 'VTEX'
 *  - All field accesses use optional chaining (vtexOrder.items?.map, etc.)
 */
export function normalizeOrder(vtexOrder: VtexOrder): ErpOrderPayload {
  const profile = vtexOrder.clientProfileData;
  const items = vtexOrder.items ?? [];
  const logistics = vtexOrder.shippingData?.logisticsInfo ?? [];
  const firstSla = logistics[0]?.selectedSla ?? undefined;
  const payments = vtexOrder.paymentData?.transactions?.[0]?.payments ?? [];
  const firstPayment = payments[0];

  const customerName =
    [profile?.firstName, profile?.lastName]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join(' ') || undefined;

  return {
    externalOrderId: vtexOrder.orderId ?? '',
    orderId: vtexOrder.orderId ?? '',
    sequence: vtexOrder.sequence,
    status: vtexOrder.status,
    creationDate: vtexOrder.creationDate,
    customer: {
      name: customerName,
      emailMasked: profile?.email ? maskEmail(profile.email) : undefined,
      documentMasked: profile?.document ? maskDocument(profile.document) : undefined,
    },
    items: items.map((item) => ({
      skuId: item.id,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      sellingPrice: item.sellingPrice,
      total:
        item.quantity != null && item.sellingPrice != null
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
 * Simulate ERP acceptance. Returns SUCCESS by default; returns FAILURE when
 * config.simulateErpFailure is true.
 *
 * Never throws — callers can rely on the return value discriminant (status).
 * Config is a parameter — never call getServerConfig() here.
 */
export function simulateErpAcceptance(
  _payload: ErpOrderPayload,
  config: Pick<AppConfig, 'simulateErpFailure'>,
): ErpSimulationResult {
  if (config.simulateErpFailure) {
    return {
      status: 'FAILURE',
      reason: 'ERP failure simulation enabled via config flag',
      failedAt: new Date().toISOString(),
    };
  }
  return {
    status: 'SUCCESS',
    acceptedAt: new Date().toISOString(),
  };
}
```
</action>

<acceptance_criteria>
- `grep -E "^export function normalizeOrder" src/lib/erpSimulator.ts` returns 1 match
- `grep -E "^export function simulateErpAcceptance" src/lib/erpSimulator.ts` returns 1 match
- `grep -E "from ['\"]@/lib/piiMasker['\"]" src/lib/erpSimulator.ts` returns 1 match
- `grep -E "process\.env|getServerConfig" src/lib/erpSimulator.ts` returns 0 matches
- `grep -E "structuredClone|store" src/lib/erpSimulator.ts` returns 0 matches (pure function — no store dependency)
- `npx tsc --noEmit` passes with zero errors
</acceptance_criteria>

---

### Task 3.2: Write erpSimulator test suite (TEST-01, TEST-04)

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/erpSimulator.ts (just created in Task 3.1)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/erp.ts (ErpOrderPayload shape)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/vtex.ts (VtexOrder shape)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/phases/02-core-library-modules/02-RESEARCH.md (Validation Architecture section, PII Masker Tests example)
</read_first>

<action>
Create `src/lib/__tests__/erpSimulator.test.ts`. No mocking needed — both functions are pure.

**Helper fixture at top of test file:**

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeOrder, simulateErpAcceptance } from '@/lib/erpSimulator';
import type { VtexOrder } from '@/types/vtex';
import type { ErpOrderPayload } from '@/types/erp';

/** Minimal valid VtexOrder for tests that only care about one field */
function makeOrder(overrides: Partial<VtexOrder> = {}): VtexOrder {
  return {
    orderId: 'v123-01',
    sequence: '501234',
    status: 'ready-for-handling',
    creationDate: '2026-04-28T10:00:00Z',
    items: [],
    clientProfileData: {
      firstName: 'Diego',
      lastName: 'Cione',
      email: 'diego.cione@vtex.com',
      document: '123.456.789-09',
      phone: '(11) 91234-5678',
    },
    shippingData: {
      logisticsInfo: [{ selectedSla: 'Normal' }],
      address: {
        street: 'Avenida Paulista',
        receiverName: 'Diego Cione',
        city: 'São Paulo',
      },
    },
    paymentData: {
      transactions: [
        {
          payments: [{ paymentSystemName: 'Visa', installments: 1, value: 10000 }],
        },
      ],
    },
    ...overrides,
  };
}
```

**Test groups (all MUST be present):**

1. `describe('normalizeOrder — required fields')`:
   - `it('sets externalOrderId and orderId from vtexOrder.orderId')` — assert both equal `'v123-01'`
   - `it('sets orderId to empty string when vtexOrder.orderId is undefined')` — `makeOrder({ orderId: undefined })`, assert `result.orderId === ''`
   - `it('sets sequence, status, creationDate')` — assert `sequence === '501234'`, `status === 'ready-for-handling'`, `creationDate === '2026-04-28T10:00:00Z'`
   - `it('sets rawSource to VTEX')` — assert `result.rawSource === 'VTEX'`

2. `describe('normalizeOrder — customer PII masking (SEC-01, SEC-02)')`:
   - `it('masks customer email in emailMasked')` — assert `result.customer?.emailMasked === 'd***@vtex.com'`
   - `it('masks customer document in documentMasked')` — assert `result.customer?.documentMasked === '***-09'`
   - `it('sets customer.name from firstName + lastName')` — assert `result.customer?.name === 'Diego Cione'`
   - `it('sets customer.name to undefined when both firstName and lastName are absent')`  — `clientProfileData: {}`, assert `result.customer?.name === undefined`
   - `it('sets emailMasked to undefined when email is absent')` — `clientProfileData: { firstName: 'A' }`, assert `result.customer?.emailMasked === undefined`
   - `it('returns customer object even when clientProfileData is null')` — `makeOrder({ clientProfileData: null })`, assert `result.customer` is an object (with undefined fields) not throw
   - `it('returns customer object when clientProfileData is absent')` — `makeOrder({ clientProfileData: undefined })`, assert no throw

3. `describe('normalizeOrder — items')`:
   - `it('maps items array with skuId, productId, name, quantity, price, sellingPrice')` — use order with one item, assert all fields
   - `it('computes item.total as quantity * sellingPrice')` — `{ quantity: 2, sellingPrice: 5000 }` → `total === 10000`
   - `it('sets item.total to undefined when quantity is missing')`
   - `it('sets item.total to undefined when sellingPrice is missing')`
   - `it('maps empty items array to empty result array')`

4. `describe('normalizeOrder — logistics and payment')`:
   - `it('sets shippingSummary from logisticsInfo[0].selectedSla')` — assert `shippingSummary === 'Normal'`
   - `it('sets paymentSummary from first payment paymentSystemName')` — assert `paymentSummary === 'Visa'`
   - `it('sets shippingSummary to undefined when shippingData is null')` — `makeOrder({ shippingData: null })`
   - `it('sets paymentSummary to undefined when paymentData is null')` — `makeOrder({ paymentData: null })`
   - `it('sets marketplace to MARKETPLACE when marketplaceOrderId is present')` — `makeOrder({ marketplaceOrderId: 'ext-456' })`, assert `marketplace === 'MARKETPLACE'`
   - `it('sets marketplace to undefined when marketplaceOrderId is absent')`

5. `describe('simulateErpAcceptance — TEST-04')`:
   - `it('returns SUCCESS when simulateErpFailure is false')` — assert `result.status === 'SUCCESS'` and `'acceptedAt' in result`
   - `it('returns FAILURE when simulateErpFailure is true')` — assert `result.status === 'FAILURE'` and `'reason' in result` and `'failedAt' in result`
   - `it('SUCCESS result acceptedAt is a valid ISO 8601 date string')` — `new Date(result.acceptedAt)` does not produce `Invalid Date`
   - `it('FAILURE result failedAt is a valid ISO 8601 date string')`
   - `it('does not throw regardless of config value')`
   - `it('the _payload parameter is not read — same result for any payload')` — call with empty `{} as ErpOrderPayload` and full payload, assert both return same status
</action>

<acceptance_criteria>
- File `src/lib/__tests__/erpSimulator.test.ts` exists
- `grep -c "describe(" src/lib/__tests__/erpSimulator.test.ts` returns at least 5
- `grep -c "it(" src/lib/__tests__/erpSimulator.test.ts` returns at least 22
- `npx vitest run src/lib/__tests__/erpSimulator.test.ts --reporter=verbose` exits 0 with all tests passing
- `npx vitest run src/lib/__tests__/ --reporter=verbose` exits 0 (all Wave 1 + Wave 2 + Wave 3 tests still pass)
- `npx tsc --noEmit` passes with zero errors
</acceptance_criteria>

---

## Verification

### Must-Haves

- [ ] `src/lib/erpSimulator.ts` exports `normalizeOrder` and `simulateErpAcceptance`
- [ ] `normalizeOrder` imports and applies `maskEmail` + `maskDocument` from `piiMasker.ts`
- [ ] `normalizeOrder` never calls `getServerConfig()` or reads `process.env`
- [ ] `simulateErpAcceptance` never calls `getServerConfig()` or reads `process.env`
- [ ] `normalizeOrder` handles `clientProfileData: null` without throwing
- [ ] All `normalizeOrder` tests pass: normalization maps all fields, PII is masked, items.total computed correctly
- [ ] All `simulateErpAcceptance` tests pass: SUCCESS default, FAILURE when flag true
- [ ] `npx vitest run src/lib/__tests__/erpSimulator.test.ts --reporter=verbose` exits 0
- [ ] `npx tsc --noEmit` passes with zero errors
