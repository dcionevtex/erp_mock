---
phase: 2
plan: 2
subsystem: core-library-modules
tags: [vtex-client, hook-parser, http, dependency-injection, security, testing]
dependency_graph:
  requires:
    - "02-01 (piiMasker, deduplicator, store, types)"
    - "src/lib/constants.ts (VTEX_API_PATHS, buildVtexBaseUrl, VTEX_REQUIRED_HEADERS)"
    - "src/types/vtex.ts (VtexOrder, VtexFeedItem, VtexApiErrorShape, VtexHookPayload)"
  provides:
    - "createVtexClient factory — injectable fetcher for testable VTEX HTTP calls"
    - "VtexApiError class — typed error with status/url, never exposes appToken"
    - "VtexClient interface — getOrder, getFeedItems, commitFeedItems, startHandling"
    - "extractOrderId — pure function covering all 6 VTEX hook payload shapes"
  affects:
    - "02-03 (erpSimulator will consume VtexOrder from getOrder)"
    - "02-04 (orderProcessor will inject VtexClient as dependency)"
    - "Phase 3 API routes (hook + feed endpoints use extractOrderId + createVtexClient)"
tech_stack:
  added: []
  patterns:
    - "Factory function with injectable fetcher (createVtexClient) — vi.fn() in tests, globalThis.fetch in production"
    - "VtexApiError class — typed error, no credentials in message, safe for logging"
    - "Defensive feed response normalization — handles raw array and { events: [] } wrapper"
    - "204 No Content short-circuit — returns undefined without JSON.parse attempt"
key_files:
  created:
    - src/lib/vtexClient.ts
    - src/lib/__tests__/vtexClient.test.ts
    - src/lib/hookParser.ts
    - src/lib/__tests__/hookParser.test.ts
  modified: []
decisions:
  - "Injectable fetcher (VtexFetcher param) preferred over vi.stubGlobal — avoids global state mutation in tests"
  - "VtexApiError message contains only status + url — appToken never appears in error messages (SEC-04)"
  - "getFeedItems handles both raw-array and { events: [] } shapes defensively — VTEX docs ambiguous on response shape"
  - "commitFeedItems([]) short-circuits before any HTTP call — VTEX may return 400 on empty handles body"
  - "startHandling sends body '{}' with Content-Type: application/json even when empty (PITFALL M6)"
  - "extractOrderId iterates 6 candidate paths in priority order — orderId > OrderId > order.* > data.*"
metrics:
  duration: "2 min 27 sec"
  completed_date: "2026-04-29"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
  tests_added: 36
  tests_total: 103
---

# Phase 2 Plan 2: VTEX Client and Hook Payload Parser Summary

**One-liner:** Injectable VTEX HTTP client factory (createVtexClient + VtexFetcher) with VtexApiError class and extractOrderId covering all six hook payload shapes.

## What Was Built

### Task 2.1 — vtexClient.ts + vtexClient.test.ts

`src/lib/vtexClient.ts` implements the full VTEX HTTP client as a pure factory function. The key architectural decision is accepting an optional `fetcher: VtexFetcher` parameter that defaults to `globalThis.fetch.bind(globalThis)` — this means tests inject `vi.fn()` mocks directly, bypassing `vi.stubGlobal('fetch', ...)` entirely.

Exports:
- `createVtexClient(config, fetcher?)` — factory returning `VtexClient`
- `VtexApiError` — typed error class with `status`, `statusText`, `body`, `url` properties; message never includes credentials
- `VtexClientConfig` — interface with account/environment/appKey/appToken
- `VtexFetcher` — type alias for the injectable fetch function shape
- `VtexClient` — interface with four methods: `getOrder`, `getFeedItems`, `commitFeedItems`, `startHandling`

Security constraints enforced:
- Zero calls to `process.env` or `getServerConfig()` — config is a parameter
- `VtexApiError` message: `"VTEX API error {status} on {url}"` — token unreachable from error surface
- appToken flows only into headers map, which is not preserved after `fetch()` resolves

`src/lib/__tests__/vtexClient.test.ts` covers 23 test cases across 5 `describe` groups:
1. `getOrder` — URL, headers, Accept/Content-Type, 200 body, 404/401/429 errors, URL-encoding
2. `startHandling` — empty body `{}`, Content-Type on empty, correct path, 204, 200, 4xx error
3. `getFeedItems` — default maxLot=10, custom maxLot, raw array, wrapped `{events:[]}`, empty `{}`
4. `commitFeedItems` — empty handles = zero HTTP calls, non-empty POSTs `{handles}`
5. `VtexApiError safety` — toString() contains no token, all 4 properties accessible

### Task 2.2 — hookParser.ts + hookParser.test.ts

`src/lib/hookParser.ts` is a tiny pure module with a single export `extractOrderId(payload)`. It addresses PITFALL C6: VTEX hook payloads deliver `orderId` at different paths depending on event type and VTEX version.

The function checks 6 candidate paths in priority order:
1. `payload.orderId`
2. `payload.OrderId` (capitalized variant)
3. `payload.order?.orderId`
4. `payload.order?.OrderId`
5. `payload.data?.orderId`
6. `payload.data?.OrderId`

Returns the first non-empty string found, or `undefined`. Handles `null`, `undefined`, empty strings, and non-string values safely.

`src/lib/__tests__/hookParser.test.ts` covers 13 test cases including all 6 payload shapes, priority ordering, edge cases (null/undefined/empty/non-string), and a realistic VTEX hook envelope with `State`, `Domain`, `LastState` fields.

## Verification Results

- All 23 vtexClient tests pass
- All 13 hookParser tests pass
- Full suite: 103/103 tests pass (6 test files)
- `npx tsc --noEmit`: zero errors
- No `process.env` or `getServerConfig` calls in vtexClient.ts
- No `vi.stubGlobal` in vtexClient.test.ts

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
