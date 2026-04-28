---
phase: 01-foundation
plan: 03
subsystem: config
tags: [vitest, typescript, environment, in-memory-store, security]

# Dependency graph
requires:
  - phase: 01-foundation/01-02
    provides: "ErpOrderRecord, EventLogEntry, AppConfig, AppConfigPublic, IntegrationMode types from @/types"

provides:
  - "globalThis-guarded in-memory store with typed CRUD on ErpOrderRecord (persistence seam)"
  - ".env.example committed at project root with all required env vars and safe placeholders"
  - "src/lib/constants.ts with VTEX endpoint paths, buildVtexBaseUrl, and status value arrays"
  - "src/lib/config.ts — getServerConfig(), getPublicConfig(), maskToken(), getMissingCredentials(), isHookSecretValid()"
  - "47 Vitest tests passing (store CRUD, event log, dedup keys, config overrides, token masking, SEC-04 guards)"

affects:
  - "Phase 2 vtexClient (imports VTEX_API_PATHS, VTEX_REQUIRED_HEADERS, getServerConfig)"
  - "Phase 2 erpSimulator (imports store CRUD functions)"
  - "Phase 4 config API (uses getPublicConfig, setConfigOverrides)"
  - "All API routes (must use Node runtime, not Edge, to share store state)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "globalThis singleton guard for Next.js Fast Refresh compatibility"
    - "ServerAppConfig internal type (never exported) for SEC-04 token containment"
    - "appTokenConfigured boolean in public config instead of raw token"
    - "Persistence seam: all store mutations through typed function interface for future KV/DB swap"

key-files:
  created:
    - ".env.example"
    - "src/lib/constants.ts"
    - "src/lib/config.ts"
    - "src/lib/store.ts"
    - "src/lib/__tests__/store.test.ts"
    - "src/lib/__tests__/config.test.ts"
  modified:
    - ".gitignore (added !.env.example exception)"

key-decisions:
  - "globalThis guard for store singletons: prevents Fast Refresh from resetting Map/Set/Array on each save"
  - "ServerAppConfig is an internal-only type (not exported) — only getPublicConfig() crosses the server/client boundary"
  - "not.toContain check uses '\"appToken\":' (JSON key literal) to avoid false match on 'appTokenConfigured'"
  - "Event log capped at 1000 entries, processed-key set at 5000 — prevents unbounded memory growth in long demo sessions"
  - "gitignore exception !.env.example required because .env* rule also matched the example file"

patterns-established:
  - "Token containment: VTEX_APP_TOKEN read ONLY in getServerConfig(); never in other modules"
  - "Public surface: getPublicConfig() is the only safe serialization boundary for config data"
  - "Store as seam: replace function bodies (not callers) when moving from Map to Vercel KV"

requirements-completed: [CONFIG-05, CONFIG-06, SEC-04, SEC-05]

# Metrics
duration: 4min
completed: 2026-04-28
---

# Phase 1 Plan 3: In-Memory Store, Constants, Env Config, and .env.example Summary

**globalThis-guarded in-memory store + token-masking config reader + typed VTEX constants, all SEC-04-compliant, with 47 passing tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-28T14:51:18Z
- **Completed:** 2026-04-28T14:55:33Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments

- Persistence seam established: typed CRUD on ErpOrderRecord via Map with globalThis guard, event log cap, dedup key set, and config overrides
- SEC-04 invariants enforced: appToken read only in getServerConfig(), never logged, getPublicConfig() strips it and returns boolean appTokenConfigured instead
- .env.example committed with all required env vars (VTEX_ACCOUNT, VTEX_ENVIRONMENT, VTEX_APP_KEY, VTEX_APP_TOKEN, DEMO_HOOK_SECRET, AUTO_COMMIT_FEED, SIMULATE_ERP_FAILURE, NEXT_PUBLIC_APP_URL) and safe placeholder values
- 47 Vitest tests passing across store CRUD, event log, dedup keys, config reads, maskToken, and SEC-04 JSON serialization guards

## Task Commits

1. **Task 3.1: .env.example and constants.ts** — `1391ad4` (feat)
2. **Task 3.2: config.ts env reader** — `fafab31` (feat)
3. **Task 3.3: store.ts in-memory store** — `cce0589` (feat)
4. **Task 3.4: Vitest tests** — `6b6358f` (test)

## Files Created/Modified

- `.env.example` — All required env var names with safe placeholder values and inline comments (SEC-05, CONFIG-06)
- `.gitignore` — Added `!.env.example` exception so the template is tracked
- `src/lib/constants.ts` — VTEX_DEFAULT_ENVIRONMENT, buildVtexBaseUrl(), VTEX_API_PATHS, VTEX_REQUIRED_HEADERS, status value arrays
- `src/lib/config.ts` — getServerConfig() (token-inclusive, server-only), getPublicConfig() (token-stripped), maskToken(), getMissingCredentials(), isHookSecretValid()
- `src/lib/store.ts` — globalThis-guarded in-memory store with full typed CRUD on ErpOrderRecord, event log, dedup keys, config overrides, and test helpers
- `src/lib/__tests__/store.test.ts` — 28 tests: order CRUD, newest-first sort, event log cap, dedup key bound, config overrides
- `src/lib/__tests__/config.test.ts` — 19 tests: env reading, boolean flags, token masking, missing credentials, hook secret, SEC-04 JSON guards

## Decisions Made

- globalThis singleton guard chosen over module-level variables to survive Next.js Fast Refresh reloads in dev
- ServerAppConfig is internal-only (not exported): ensures the raw appToken never crosses module boundaries by accident
- not.toContain check updated to `'"appToken":'` (JSON key with colon) because `"appTokenConfigured"` contains `"appToken"` as a substring — the original plan test would have always failed against a correct implementation
- Event log capped at 1000, processed-key set at 5000 to prevent unbounded memory in long demo sessions
- gitignore exception `!.env.example` added since the existing `.env*` rule matched the example file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed config.test.ts SEC-04 guard test — appToken substring conflict**
- **Found during:** Task 3.4 (Vitest tests)
- **Issue:** Plan's EXACT test content used `expect(json).not.toContain('appToken')` which always fails because the JSON output contains `"appTokenConfigured"` (a field that SHOULD be present). The test intent (token value and raw appToken key never exposed) was correct; the assertion string was wrong.
- **Fix:** Changed check to `expect(json).not.toContain('"appToken":')` — matches the raw JSON key `"appToken":` which would appear if the token field leaked, without matching `"appTokenConfigured"`
- **Files modified:** src/lib/__tests__/config.test.ts
- **Verification:** All 47 tests pass; SEC-04 invariant still enforced
- **Committed in:** 6b6358f (Task 3.4 commit)

**2. [Rule 3 - Blocking] Added .gitignore exception for .env.example**
- **Found during:** Task 3.1 (.env.example creation)
- **Issue:** Existing `.env*` gitignore rule matched `.env.example`, which the plan explicitly requires to be committed (SEC-05)
- **Fix:** Added `!.env.example` exception line to .gitignore
- **Files modified:** .gitignore
- **Verification:** `git add .env.example` succeeded; file is tracked
- **Committed in:** 1391ad4 (Task 3.1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes essential for correctness and trackability. No scope creep.

## Issues Encountered

None beyond the two deviations documented above.

## Next Phase Readiness

- Phase 2 vtexClient can import `VTEX_API_PATHS`, `VTEX_REQUIRED_HEADERS`, `buildVtexBaseUrl` from `src/lib/constants.ts` and `getServerConfig` from `src/lib/config.ts`
- Phase 2 erpSimulator and pipeline can import store CRUD functions from `src/lib/store.ts`
- Phase 4 config API can call `getPublicConfig()` and `setConfigOverrides()` directly
- All API routes that import from store.ts must use Node.js runtime (not Edge) — documented in store.ts header

---
*Phase: 01-foundation*
*Completed: 2026-04-28*
