---
phase: 02-core-library-modules
plan: 04
subsystem: api
tags: [pipeline, orchestration, order-processing, guards, vtex, erp, pii-masking, vitest]

# Dependency graph
requires:
  - phase: 02-core-library-modules-plan-01
    provides: maskOrderPayload, maskEmail, maskDocument — PII masking applied to vtexOrderRaw (SEC-03)
  - phase: 02-core-library-modules-plan-02
    provides: VtexClient interface, VtexApiError — injected via ProcessOrderDeps
  - phase: 02-core-library-modules-plan-03
    provides: normalizeOrder, simulateErpAcceptance — core pipeline steps
provides:
  - processOrder async function — full pipeline orchestration (Get Order → normalize → ERP simulate → Start Handling)
  - ProcessOrderDeps interface — injectable dependency contract for vtexClient and config
  - All three Start Handling guards (PIPE-05, PIPE-06, PIPE-07) in a single authoritative module
  - 26-test Vitest suite verifying all guard scenarios and happy path (TEST-06)
affects:
  - phase: 03-api-routes — Hook and Feed poll routes will call processOrder with injected deps
  - phase: 04-configuration — Config passed as ProcessOrderDeps.config at call sites

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dependency injection via ProcessOrderDeps interface — vtexClient and config injected at call site
    - Guard-first pipeline: PIPE-07 (idempotency) → PIPE-06 (network) → PIPE-05 (business) before any side effects
    - Re-fetch pattern: getOrderByOrderId called again after async getOrder to prevent stale record overwrite
    - Injected mock pattern: makeMockVtexClient factory with vi.fn() overrides — no vi.stubGlobal needed

key-files:
  created:
    - src/lib/orderProcessor.ts
    - src/lib/__tests__/orderProcessor.test.ts
  modified: []

key-decisions:
  - "processOrder never calls getServerConfig() — config injected via ProcessOrderDeps.config at the API route call site"
  - "Re-fetch record after getOrder call to prevent overwriting concurrent mutations with stale spread"
  - "PIPE-07 guard writes SKIPPED status on START_HANDLING_REQUESTED step — preserves full timeline for UI display"
  - "maskOrderPayload called on vtexOrder before upsertOrder — vtexOrderRaw is always PII-safe in the store (SEC-03)"

patterns-established:
  - "Pipeline guard ordering: idempotency (PIPE-07) → network failure (PIPE-06) → business failure (PIPE-05)"
  - "Timeline entry on every step including SKIPPED variants — full audit trail for accordion UI"

requirements-completed: [PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08, TEST-06]

# Metrics
duration: 8min
completed: 2026-04-28
---

# Phase 2 Plan 4: Order Processor with Pipeline Orchestration and Guards Summary

**Full pipeline orchestration module with three Start Handling guards, nine timestamped timeline steps, PII-masked raw storage, and 26-test Vitest suite covering all guard scenarios**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-28T04:37:00Z
- **Completed:** 2026-04-28T04:45:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented `orderProcessor.ts` with complete Get Order → normalize → ERP simulate → Start Handling pipeline
- Enforced all three Start Handling guards (PIPE-07 idempotency, PIPE-06 network failure, PIPE-05 ERP failure) in one authoritative module
- Applied `maskOrderPayload` to `vtexOrderRaw` before store write — vtexOrderRaw is always PII-safe (SEC-03)
- Wrote 26-test suite with injected mock VtexClient covering every guard, happy path, error path, and no-op scenario

## Task Commits

Each task was committed atomically:

1. **Task 4.1: Implement orderProcessor.ts** - `c59c866` (feat)
2. **Task 4.2: Write orderProcessor test suite** - `abc9c15` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/orderProcessor.ts` — Full pipeline orchestration, ProcessOrderDeps interface, three guards
- `src/lib/__tests__/orderProcessor.test.ts` — 26 tests across 6 describe blocks (TEST-06)

## Decisions Made

- `processOrder` never calls `getServerConfig()` — config is passed as `ProcessOrderDeps.config` at the API route call site (Phase 3 responsibility)
- Re-fetch record with `getOrderByOrderId` after the async `getOrder` call to avoid overwriting concurrent mutations with a stale record spread
- PIPE-07 guard writes `SKIPPED` status on `START_HANDLING_REQUESTED` step — preserves complete timeline visibility for accordion UI
- `maskOrderPayload` applied to `vtexOrder` before `upsertOrder` so `vtexOrderRaw` is always PII-safe at rest (SEC-03)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `processOrder` is ready for Phase 3 API routes to call with real `createVtexClient(config)` + config from `getServerConfig()`
- Hook route (`POST /api/vtex/hook`) and Feed poll route (`POST /api/vtex/feed/poll`) are the immediate consumers
- All 169 tests green across 10 test files; TypeScript passes with zero errors

---
*Phase: 02-core-library-modules*
*Completed: 2026-04-28*
