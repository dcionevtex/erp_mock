---
phase: 02-core-library-modules
plan: 03
subsystem: api
tags: [vtex, erp, normalization, pii-masking, vitest, typescript]

# Dependency graph
requires:
  - phase: 02-core-library-modules plan 01
    provides: maskEmail, maskDocument from piiMasker.ts

provides:
  - normalizeOrder pure function mapping VtexOrder to ErpOrderPayload with PII masking
  - simulateErpAcceptance config-injected function returning ErpSimulationResult
  - 28-test vitest suite covering normalization, PII masking, items, logistics/payment, and ERP simulation

affects:
  - Phase 3 API routes (hook, feed/poll, pipeline)
  - Any module that calls normalizeOrder or simulateErpAcceptance

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Config-injected parameter pattern for simulateErpAcceptance (no getServerConfig call, testable with plain object)
    - PII masking at normalization time — ErpOrderPayload always contains pre-masked customer fields
    - Optional chaining on all VtexOrder field accesses (PITFALL S4 defense)

key-files:
  created:
    - src/lib/erpSimulator.ts
    - src/lib/__tests__/erpSimulator.test.ts
  modified: []

key-decisions:
  - "normalizeOrder is a pure function: no side effects, no store imports, no HTTP"
  - "simulateErpAcceptance accepts config as parameter — never calls getServerConfig() — enables direct test injection"
  - "PII masking applied inside normalizeOrder so ErpOrderPayload always carries masked values (SEC-01, SEC-02, SEC-03)"
  - "item.total computed as quantity * sellingPrice only when both are non-null numbers, else undefined"
  - "marketplace set to literal 'MARKETPLACE' when marketplaceOrderId is non-empty, else undefined"

patterns-established:
  - "Config injection: testable functions accept config param rather than reading env/store"
  - "Null-safe field access: all VtexOrder accesses use optional chaining (?.) per PITFALL S4"

requirements-completed:
  - PIPE-02
  - PIPE-03
  - TEST-01
  - TEST-04

# Metrics
duration: 6min
completed: 2026-04-28
---

# Phase 2 Plan 3: ERP Simulator and Order Normalizer Summary

**Pure VtexOrder-to-ErpOrderPayload normalizer with PII masking at normalization time, config-injected ERP simulator, and 28-test vitest suite**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-28T04:31:10Z
- **Completed:** 2026-04-28T04:37:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented `normalizeOrder` pure function mapping VtexOrder to ErpOrderPayload with full optional chaining, PII masking at normalization time (SEC-01/SEC-02/SEC-03), item.total computation, and marketplace detection
- Implemented `simulateErpAcceptance` with config-injected parameter pattern — returns SUCCESS by default, FAILURE when `simulateErpFailure: true`
- Created 28-test vitest suite across 5 describe groups covering all contract truths in the plan: required fields, PII masking, items, logistics/payment, and ERP simulation paths

## Task Commits

Each task was committed atomically:

1. **Task 3.1: Implement erpSimulator.ts** - `f640183` (feat)
2. **Task 3.2: Write erpSimulator test suite** - `928d5f0` (feat)

**Plan metadata:** _(docs commit below)_

## Files Created/Modified

- `src/lib/erpSimulator.ts` - Pure normalizeOrder + config-injected simulateErpAcceptance
- `src/lib/__tests__/erpSimulator.test.ts` - 28 tests across 5 groups, no mocks needed

## Decisions Made

- `normalizeOrder` is a pure function with no side effects or store dependencies — enables testing without any setup
- `simulateErpAcceptance` accepts config as a `Pick<AppConfig, 'simulateErpFailure'>` parameter — never calls `getServerConfig()` — enables direct injection in tests with `{ simulateErpFailure: true }`
- PII masking applied at normalization time inside `normalizeOrder` so all downstream code receives pre-masked `ErpOrderPayload`
- item.total uses strict null check (`item.quantity != null && item.sellingPrice != null`) to handle 0-quantity edge cases correctly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `normalizeOrder` and `simulateErpAcceptance` are ready for import by Phase 3 API route handlers (hook, feed/poll pipeline)
- Both functions are fully typed and test-verified
- Full Wave 3 suite (131 tests) passes with zero TypeScript errors

---
*Phase: 02-core-library-modules*
*Completed: 2026-04-28*
