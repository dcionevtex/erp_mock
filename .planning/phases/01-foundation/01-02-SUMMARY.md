---
phase: 01-foundation
plan: 02
subsystem: types
tags: [typescript, types, vtex, erp, strict-mode]

# Dependency graph
requires:
  - phase: 01-foundation-plan-01
    provides: Next.js scaffold with TypeScript strict mode and Vitest configured

provides:
  - Shared TypeScript type surface at @/types (src/types/index.ts barrel)
  - ERP domain types: ErpStatus, StartHandlingStatus, IntegrationSource, TimelineStatus, ErpOrderRecord, ErpOrderPayload, ErpTimelineEntry, ErpSimulationResult, PipelineStepName, EventLogEntry, AppConfig, AppConfigPublic
  - VTEX wire-format types: VtexOrder, VtexFeedItem, VtexHookPayload, VtexOrderItem, VtexClientProfileData, VtexShippingData, VtexPaymentData, VtexStartHandlingResponse, VtexApiErrorShape
  - Compile-time SEC-04 guard via @ts-expect-error ensuring appToken never on public types
  - 11 smoke tests confirming every key type constructs and assigns correctly

affects: [02-vtex-client, 03-erp-simulator, 04-store, 05-api-routes, 06-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - All VTEX wire-format fields optional (?:) to defend against partial responses (PITFALL S4)
    - VtexFeedItem.handle is required (not optional) per PITFALL M4 commit-vs-eventId distinction
    - AppConfigPublic never includes appToken — SEC-04 type-level guard via @ts-expect-error
    - Barrel export pattern: src/types/index.ts re-exports all domain types for single import surface

key-files:
  created:
    - src/types/erp.ts
    - src/types/vtex.ts
    - src/types/index.ts
    - src/types/__tests__/types.test.ts
  modified: []

key-decisions:
  - "All VTEX fields typed as optional (?:) except VtexFeedItem.handle — defends PITFALL S4 (partial orders crash normalizer)"
  - "appToken excluded from all exported types; AppConfigPublic uses intersection type with appTokenConfigured boolean instead"
  - "PipelineStepName union covers all 15 pipeline steps from CLAUDE.MD §14.7 plus string fallback on ErpTimelineEntry"
  - "ErpOrderRecord.erpPayload typed as ErpOrderPayload (not unknown) to enable downstream type-safe access"

patterns-established:
  - "Optional VTEX fields: every VTEX wire-format field is optional unless API contract guarantees presence"
  - "Type barrel: all types imported from @/types, never from sub-paths"
  - "SEC-04 guard: @ts-expect-error on cfg.appToken asserts the field does not exist at compile time"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-04-28
---

# Phase 1 Plan 2: Shared TypeScript Types Summary

**Complete ERP and VTEX wire-format type surface (30+ types) exported from @/types barrel with strict-mode compile, 11 smoke tests, and compile-time SEC-04 guard preventing appToken exposure**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-28T14:46:26Z
- **Completed:** 2026-04-28T14:48:30Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Defined all ERP domain types matching CLAUDE.MD §12 and §15 exactly (status enums, ErpOrderRecord, ErpOrderPayload, ErpTimelineEntry, AppConfig, AppConfigPublic)
- Defined complete VTEX wire-format types with all fields optional (except VtexFeedItem.handle) per PITFALL S4 defense
- Created @/types barrel and 11-test smoke suite confirming every type compiles under strict mode and can be constructed at runtime
- Established SEC-04 @ts-expect-error compile guard that will fail the build if appToken is ever accidentally added to AppConfigPublic

## Task Commits

Each task was committed atomically:

1. **Task 2.1: ERP domain types** - `8596c91` (feat)
2. **Task 2.2: VTEX wire-format types** - `7f70d0b` (feat)
3. **Task 2.3: Barrel + smoke test** - `868c64f` (feat)

**Plan metadata:** (docs commit — recorded below)

## Files Created/Modified
- `src/types/erp.ts` — ErpStatus, StartHandlingStatus, IntegrationSource, TimelineStatus, PipelineStepName, ErpTimelineEntry, ErpOrderItem, ErpOrderCustomer, ErpOrderPayload, ErpSimulationResult, ErpOrderRecord, EventLogEntry, IntegrationMode, AppConfig, AppConfigPublic
- `src/types/vtex.ts` — VtexClientProfileData, VtexShippingAddress, VtexLogisticsInfo, VtexShippingData, VtexOrderItem, VtexPaymentTransaction, VtexPaymentData, VtexTotal, VtexOrder, VtexFeedItem, VtexHookPayload, VtexStartHandlingResponse, VtexApiErrorShape
- `src/types/index.ts` — Barrel re-exporting all types from erp.ts and vtex.ts
- `src/types/__tests__/types.test.ts` — 11 compile + runtime smoke tests; @ts-expect-error SEC-04 guard

## Decisions Made
- All VTEX fields typed as optional (?:) except VtexFeedItem.handle — defends PITFALL S4 (partial orders crash normalizer)
- appToken excluded from all exported types; AppConfigPublic uses intersection type with appTokenConfigured boolean instead
- PipelineStepName union covers all 15 pipeline steps from CLAUDE.MD §14.7 plus string fallback on ErpTimelineEntry
- ErpOrderRecord.erpPayload typed as ErpOrderPayload (not unknown) to enable downstream type-safe access

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared types available at @/types — Plan 03 (in-memory store + env config) can import ErpOrderRecord, AppConfig, AppConfigPublic immediately
- Plan 04 (vtexClient.ts) can import VtexOrder, VtexFeedItem, VtexHookPayload, VtexStartHandlingResponse
- TSC strict mode passes with zero errors, 12 tests pass (11 new + 1 from Plan 1)

---
*Phase: 01-foundation*
*Completed: 2026-04-28*
