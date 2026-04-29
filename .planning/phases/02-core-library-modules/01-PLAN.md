---
plan: 1
phase: 2
wave: 1
title: PII Masker and Deduplicator
depends_on: none
files_modified:
  - src/lib/piiMasker.ts
  - src/lib/deduplicator.ts
  - src/lib/__tests__/piiMasker.test.ts
  - src/lib/__tests__/deduplicator.test.ts
  - src/types/vtex.ts
requirements_addressed:
  - SEC-01
  - SEC-02
  - SEC-03
  - TEST-02
  - TEST-05
autonomous: true
must_haves:
  truths:
    - "maskEmail('diego.cione@vtex.com') returns 'd***@vtex.com'"
    - "maskDocument('123.456.789-09') returns '***-09' (CPF) and '12.345.678/0001-90' returns '***-90' (CNPJ)"
    - "maskOrderPayload deep-clones input via structuredClone — original is never mutated"
    - "maskOrderPayload masks clientProfileData.email, clientProfileData.document, clientProfileData.phone, shippingData.address.street, shippingData.address.receiverName"
    - "buildDeduplicationKey returns 'eventId:{x}' when eventId is non-empty"
    - "buildDeduplicationKey falls back to 'composite:{orderId}:{state}:{timestamp}' when eventId is empty"
    - "isDuplicate returns true after markProcessed has been called for the same input; false otherwise"
    - "VtexFeedItem includes currentState, lastState, currentChangeDate, lastChangeDate optional fields"
  artifacts:
    - path: "src/lib/piiMasker.ts"
      provides: "maskEmail, maskDocument, maskPhone, maskAddress, maskOrderPayload pure functions"
      exports: ["maskEmail", "maskDocument", "maskPhone", "maskAddress", "maskOrderPayload"]
    - path: "src/lib/deduplicator.ts"
      provides: "buildDeduplicationKey, isDuplicate, markProcessed using store-backed processedKeys"
      exports: ["buildDeduplicationKey", "isDuplicate", "markProcessed", "DeduplicatorInput"]
    - path: "src/lib/__tests__/piiMasker.test.ts"
      provides: "Vitest suite for SEC-01, SEC-02, SEC-03, TEST-05"
    - path: "src/lib/__tests__/deduplicator.test.ts"
      provides: "Vitest suite for TEST-02 (eventId, composite, non-dupe)"
    - path: "src/types/vtex.ts"
      provides: "VtexFeedItem extended with currentState/lastState/currentChangeDate/lastChangeDate"
      contains: "currentState?: string"
  key_links:
    - from: "src/lib/deduplicator.ts"
      to: "src/lib/store.ts"
      via: "imports hasProcessedKey, markProcessedKey from '@/lib/store'"
      pattern: "from ['\"]@/lib/store['\"]"
    - from: "src/lib/piiMasker.ts"
      to: "structuredClone"
      via: "deep clone before mutation"
      pattern: "structuredClone\\("
    - from: "src/lib/__tests__/deduplicator.test.ts"
      to: "src/lib/store.ts"
      via: "imports __resetStoreForTests"
      pattern: "__resetStoreForTests"
---

# Plan 1: PII Masker and Deduplicator

## Objective

Build the foundational pure utility modules — `piiMasker.ts` (server-side masking applied at ingestion time, never display time) and `deduplicator.ts` (idempotency keys backed by the existing store) — plus extend `VtexFeedItem` with the actual VTEX Feed v3 state fields. These modules have zero downstream dependencies and unblock all subsequent plans.

## Tasks

### Task 1.1: Extend VtexFeedItem type with VTEX Feed v3 fields

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/vtex.ts
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/phases/02-core-library-modules/02-RESEARCH.md (section "VtexFeedItem Type Update Needed")
</read_first>

<action>
Open `src/types/vtex.ts` and update the `VtexFeedItem` type to include the VTEX Feed v3 state fields. This is a non-breaking change — all new fields are optional.

The type MUST become exactly:

```typescript
// VTEX Feed item (the queue entry — see CLAUDE.MD §11, PITFALL M4).
// `handle` is the commit identifier; for dedup prefer composite of orderId+currentState+currentChangeDate.
// VTEX Feed v3 confirmed fields: handle, orderId, currentState, lastState, currentChangeDate, lastChangeDate, domain.
export type VtexFeedItem = {
  handle: string;             // REQUIRED — used by commitFeedItems
  eventId?: string;           // Forward compat — not always present in Feed v3
  id?: string;                // Forward compat
  orderId?: string;
  state?: string;             // Legacy field name (kept for backward compat)
  currentState?: string;      // VTEX Feed v3 primary state field
  lastState?: string;         // VTEX Feed v3 previous state
  currentChangeDate?: string; // ISO 8601 — used as dedup timestamp
  lastChangeDate?: string;    // ISO 8601
  domain?: string;            // e.g., "Marketplace"
  parentAccountName?: string;
  date?: string;              // Legacy field name (kept for backward compat)
};
```

Keep all other types in the file unchanged. Do not modify `VtexOrder`, `VtexHookPayload`, or any other type.
</action>

<acceptance_criteria>
- `grep -E "currentState\\?: string" src/types/vtex.ts` returns 1 match
- `grep -E "lastState\\?: string" src/types/vtex.ts` returns 1 match
- `grep -E "currentChangeDate\\?: string" src/types/vtex.ts` returns 1 match
- `grep -E "lastChangeDate\\?: string" src/types/vtex.ts` returns 1 match
- `grep -E "domain\\?: string" src/types/vtex.ts` returns 1 match
- `grep -E "handle: string" src/types/vtex.ts` still returns 1 match (REQUIRED, no `?`)
- `npx tsc --noEmit` passes with zero errors
</acceptance_criteria>

---

### Task 1.2: Implement piiMasker.ts with full masking + tests

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/vtex.ts (VtexClientProfileData, VtexShippingAddress shapes)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/phases/02-core-library-modules/02-RESEARCH.md (Module 1: piiMasker.ts section, Pitfall 5)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/__tests__/store.test.ts (if exists — for vitest pattern reference)
</read_first>

<action>
Create `src/lib/piiMasker.ts` with five pure exported functions. Use `structuredClone` (Node 24 native) for deep cloning. Never mutate inputs.

**Exact function signatures and behaviour (must match exactly):**

```typescript
// src/lib/piiMasker.ts
// Pure PII masking utilities applied server-side at ingestion time (SEC-03).
// Never display-time masking — raw payloads stored on records must already be sanitized.

/**
 * "diego.cione@vtex.com" -> "d***@vtex.com"
 * Empty/null/undefined -> ""
 * Missing "@" or "@" at index 0 -> "***"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return '***';
  return `${email[0]}***${email.slice(atIdx)}`;
}

/**
 * "123.456.789-09" -> "***-09"
 * "12.345.678/0001-90" -> "***-90"
 * Strips all non-digits before extracting the last 2 digits.
 * Empty/null/undefined -> ""
 * Less than 4 digits after cleaning -> "***"
 */
export function maskDocument(doc: string | null | undefined): string {
  if (!doc) return '';
  const cleaned = doc.replace(/\D/g, '');
  if (cleaned.length < 4) return '***';
  return `***-${cleaned.slice(-2)}`;
}

/**
 * Always returns the literal string "(**) *****-****" for any non-empty input.
 * Empty/null/undefined -> "".
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return '(**) *****-****';
}

/**
 * Mask a VtexShippingAddress-like object IN PLACE on a clone (caller must clone first).
 * Mutates: street -> first 4 chars + "***"; receiverName -> first word + " ***".
 * Other fields (postalCode, city, state, country, neighborhood, complement) untouched.
 * Pure with respect to the original argument when used via maskOrderPayload (which clones).
 */
export function maskAddress(address: Record<string, unknown> | null | undefined): void {
  if (!address || typeof address !== 'object') return;
  if (typeof address['street'] === 'string') {
    address['street'] = `${(address['street'] as string).slice(0, 4)}***`;
  }
  if (typeof address['receiverName'] === 'string') {
    const first = (address['receiverName'] as string).split(' ')[0] ?? '';
    address['receiverName'] = `${first} ***`;
  }
}

/**
 * Deep-clone the payload (structuredClone) and mask PII fields:
 *   clientProfileData.email     -> maskEmail
 *   clientProfileData.document  -> maskDocument
 *   clientProfileData.phone     -> maskPhone
 *   shippingData.address.street -> first 4 chars + "***"
 *   shippingData.address.receiverName -> first word + " ***"
 * The original `payload` is NEVER mutated. Returns the masked clone.
 * Non-object inputs (null, undefined, primitives) are returned unchanged.
 */
export function maskOrderPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = structuredClone(payload) as Record<string, unknown>;

  const profile = clone['clientProfileData'];
  if (profile && typeof profile === 'object') {
    const p = profile as Record<string, unknown>;
    if (typeof p['email'] === 'string') p['email'] = maskEmail(p['email']);
    if (typeof p['document'] === 'string') p['document'] = maskDocument(p['document']);
    if (typeof p['phone'] === 'string') p['phone'] = maskPhone(p['phone']);
  }

  const shipping = clone['shippingData'];
  if (shipping && typeof shipping === 'object') {
    const addr = (shipping as Record<string, unknown>)['address'];
    if (addr && typeof addr === 'object') {
      maskAddress(addr as Record<string, unknown>);
    }
  }

  return clone;
}
```

Then create `src/lib/__tests__/piiMasker.test.ts` with the following test groups (all must be present and passing):

1. `describe('maskEmail')`:
   - `it('masks diego.cione@vtex.com to d***@vtex.com')`
   - `it('returns empty string for null')`
   - `it('returns empty string for undefined')`
   - `it('returns empty string for empty string')`
   - `it('returns *** when @ is at index 0')` — input `'@vtex.com'` -> `'***'`
   - `it('returns *** when no @ is present')` — input `'noatsign'` -> `'***'`

2. `describe('maskDocument')`:
   - `it('masks CPF 123.456.789-09 to ***-09')`
   - `it('masks CNPJ 12.345.678/0001-90 to ***-90')`
   - `it('strips non-digits and uses last 2 digits')` — input `'987'` (3 digits) -> `'***'`
   - `it('returns empty string for null/undefined/empty')`
   - `it('returns *** for fewer than 4 digits')` — input `'12'` -> `'***'`

3. `describe('maskPhone')`:
   - `it('returns the literal placeholder for any non-empty phone')` — input `'+55 11 91234-5678'` -> `'(**) *****-****'`
   - `it('returns empty string for null/undefined/empty')`

4. `describe('maskOrderPayload')`:
   - `it('masks email and document inside clientProfileData')` — assert masked values contain `'***'` and original is unchanged
   - `it('masks phone inside clientProfileData to placeholder')`
   - `it('masks shippingData.address.street to first 4 chars + ***')` — input street `'Avenida Paulista 1000'` -> `'Aven***'`
   - `it('masks shippingData.address.receiverName to first word + ***')` — input `'Diego Cione'` -> `'Diego ***'`
   - `it('does NOT mutate the original payload')` — clone original via JSON snapshot, run mask, deep-equal compare original snapshot to original
   - `it('returns null/undefined/primitives unchanged')`
   - `it('leaves non-PII fields unchanged')` — orderId, items, totals all preserved

Use `import { describe, it, expect } from 'vitest'`. Globals are enabled in vitest.config.ts so `describe/it/expect` would also work without import — but include explicit imports for clarity.
</action>

<acceptance_criteria>
- File `src/lib/piiMasker.ts` exists
- `grep -c "^export function" src/lib/piiMasker.ts` returns at least 5 (maskEmail, maskDocument, maskPhone, maskAddress, maskOrderPayload)
- `grep -E "structuredClone\\(" src/lib/piiMasker.ts` returns at least 1 match
- File `src/lib/__tests__/piiMasker.test.ts` exists
- `grep -E "describe\\(['\"]maskEmail['\"]" src/lib/__tests__/piiMasker.test.ts` returns 1 match
- `grep -E "describe\\(['\"]maskDocument['\"]" src/lib/__tests__/piiMasker.test.ts` returns 1 match
- `grep -E "describe\\(['\"]maskPhone['\"]" src/lib/__tests__/piiMasker.test.ts` returns 1 match
- `grep -E "describe\\(['\"]maskOrderPayload['\"]" src/lib/__tests__/piiMasker.test.ts` returns 1 match
- `npx vitest run src/lib/__tests__/piiMasker.test.ts --reporter=verbose` passes (exit code 0) with at least 18 passing tests
- `npx tsc --noEmit` passes with zero errors
</acceptance_criteria>

---

### Task 1.3: Implement deduplicator.ts with store-backed idempotency + tests

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/store.ts (hasProcessedKey, markProcessedKey, __resetStoreForTests)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/phases/02-core-library-modules/02-RESEARCH.md (Module 2: deduplicator.ts section, Pitfall about state vs currentState)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/vtex.ts (updated VtexFeedItem from Task 1.1)
</read_first>

<action>
Create `src/lib/deduplicator.ts` with the following exact contract. The module delegates persistence to the existing store — it does NOT introduce its own Set/Map.

```typescript
// src/lib/deduplicator.ts
// Idempotency-key construction and lookup, backed by store.processedKeys.
// PITFALL S5 (research): NEVER deduplicate on orderId alone — VTEX legitimately re-delivers
// events for the same order in different states. Use eventId when present, else
// orderId+state+timestamp composite.

import { hasProcessedKey, markProcessedKey } from '@/lib/store';

export interface DeduplicatorInput {
  eventId?: string | null;
  orderId?: string | null;
  /** From VtexFeedItem.currentState (preferred) or hook payload currentState/state */
  state?: string | null;
  /** From VtexFeedItem.currentChangeDate (preferred) or hook payload timestamp */
  timestamp?: string | null;
}

/**
 * Build an idempotency key for an event.
 * Priority: eventId (if non-empty) → composite of orderId + state + timestamp.
 * Format:
 *   eventId present: "eventId:{value}"
 *   composite:       "composite:{orderId|unknown}:{state|unknown}:{timestamp|unknown}"
 */
export function buildDeduplicationKey(input: DeduplicatorInput): string {
  if (input.eventId && input.eventId.length > 0) {
    return `eventId:${input.eventId}`;
  }
  const orderId = input.orderId ?? 'unknown';
  const state = input.state ?? 'unknown';
  const ts = input.timestamp ?? 'unknown';
  return `composite:${orderId}:${state}:${ts}`;
}

/** True iff the key has previously been marked processed in this process. */
export function isDuplicate(input: DeduplicatorInput): boolean {
  return hasProcessedKey(buildDeduplicationKey(input));
}

/** Record the key as processed. Subsequent isDuplicate() calls return true. */
export function markProcessed(input: DeduplicatorInput): void {
  markProcessedKey(buildDeduplicationKey(input));
}
```

Then create `src/lib/__tests__/deduplicator.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildDeduplicationKey,
  isDuplicate,
  markProcessed,
} from '@/lib/deduplicator';
import { __resetStoreForTests } from '@/lib/store';

beforeEach(() => {
  __resetStoreForTests();
});

describe('buildDeduplicationKey', () => {
  it('uses eventId when present and non-empty', () => {
    expect(buildDeduplicationKey({ eventId: 'evt-123' })).toBe('eventId:evt-123');
  });

  it('falls back to composite when eventId is undefined', () => {
    expect(
      buildDeduplicationKey({ orderId: 'o-1', state: 'ready-for-handling', timestamp: '2026-04-28T00:00:00Z' }),
    ).toBe('composite:o-1:ready-for-handling:2026-04-28T00:00:00Z');
  });

  it('falls back to composite when eventId is empty string', () => {
    expect(
      buildDeduplicationKey({ eventId: '', orderId: 'o-1', state: 'x', timestamp: 't' }),
    ).toBe('composite:o-1:x:t');
  });

  it('falls back to composite when eventId is null', () => {
    expect(
      buildDeduplicationKey({ eventId: null, orderId: 'o-1', state: 'x', timestamp: 't' }),
    ).toBe('composite:o-1:x:t');
  });

  it('uses unknown placeholders for missing composite parts', () => {
    expect(buildDeduplicationKey({})).toBe('composite:unknown:unknown:unknown');
  });

  it('different states for the same orderId produce DIFFERENT keys (PITFALL S5)', () => {
    const a = buildDeduplicationKey({ orderId: 'o-1', state: 'payment-approved', timestamp: 't1' });
    const b = buildDeduplicationKey({ orderId: 'o-1', state: 'ready-for-handling', timestamp: 't2' });
    expect(a).not.toBe(b);
  });
});

describe('isDuplicate / markProcessed', () => {
  it('returns false before markProcessed has been called', () => {
    expect(isDuplicate({ eventId: 'evt-1' })).toBe(false);
  });

  it('returns true after markProcessed has been called for the same input', () => {
    markProcessed({ eventId: 'evt-1' });
    expect(isDuplicate({ eventId: 'evt-1' })).toBe(true);
  });

  it('does not mark unrelated events as duplicate', () => {
    markProcessed({ eventId: 'evt-1' });
    expect(isDuplicate({ eventId: 'evt-2' })).toBe(false);
  });

  it('treats composite-key inputs with same orderId+state+timestamp as duplicates', () => {
    markProcessed({ orderId: 'o-1', state: 's', timestamp: 't' });
    expect(isDuplicate({ orderId: 'o-1', state: 's', timestamp: 't' })).toBe(true);
  });

  it('treats composite-key inputs with same orderId but different state as non-duplicate', () => {
    markProcessed({ orderId: 'o-1', state: 'payment-approved', timestamp: 't1' });
    expect(isDuplicate({ orderId: 'o-1', state: 'ready-for-handling', timestamp: 't2' })).toBe(false);
  });

  it('store reset clears all processed keys', () => {
    markProcessed({ eventId: 'evt-1' });
    __resetStoreForTests();
    expect(isDuplicate({ eventId: 'evt-1' })).toBe(false);
  });
});
```
</action>

<acceptance_criteria>
- File `src/lib/deduplicator.ts` exists
- `grep -E "^export function buildDeduplicationKey" src/lib/deduplicator.ts` returns 1 match
- `grep -E "^export function isDuplicate" src/lib/deduplicator.ts` returns 1 match
- `grep -E "^export function markProcessed" src/lib/deduplicator.ts` returns 1 match
- `grep -E "^export interface DeduplicatorInput" src/lib/deduplicator.ts` returns 1 match
- `grep -E "from ['\"]@/lib/store['\"]" src/lib/deduplicator.ts` returns 1 match
- File `src/lib/__tests__/deduplicator.test.ts` exists
- `grep -E "__resetStoreForTests" src/lib/__tests__/deduplicator.test.ts` returns at least 2 matches (import + reset call)
- `npx vitest run src/lib/__tests__/deduplicator.test.ts --reporter=verbose` passes (exit code 0) with at least 11 passing tests
- `npx tsc --noEmit` passes with zero errors
</acceptance_criteria>

---

## Verification

### Must-Haves

- [ ] `src/types/vtex.ts` extended with `currentState`, `lastState`, `currentChangeDate`, `lastChangeDate`, `domain` (all optional)
- [ ] `src/lib/piiMasker.ts` exports maskEmail, maskDocument, maskPhone, maskAddress, maskOrderPayload
- [ ] `maskEmail('diego.cione@vtex.com')` returns exactly `'d***@vtex.com'` (verified by test)
- [ ] `maskDocument('123.456.789-09')` returns exactly `'***-09'` (verified by test)
- [ ] `maskOrderPayload` does NOT mutate input (verified by test)
- [ ] `src/lib/deduplicator.ts` exports buildDeduplicationKey, isDuplicate, markProcessed, DeduplicatorInput
- [ ] `buildDeduplicationKey` returns `eventId:{x}` when eventId non-empty, else composite
- [ ] Two events for the same orderId in different states produce different dedup keys (PITFALL S5)
- [ ] Both test files pass: `npx vitest run src/lib/__tests__/piiMasker.test.ts src/lib/__tests__/deduplicator.test.ts --reporter=verbose`
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No production code outside `__tests__/` imports `__resetStoreForTests`
