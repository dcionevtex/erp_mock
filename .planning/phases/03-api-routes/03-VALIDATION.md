---
phase: 3
slug: api-routes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (unit tests) + manual curl for route integration |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose && npx tsc --noEmit` |
| **Estimated runtime** | ~6 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose` (must stay 169+ tests green)
- **After every plan wave:** Run `npx vitest run --reporter=verbose && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green; key routes manually curl-tested
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 3-01-01 | 01 | 1 | HOOK-01..05, API-01, ERR-05 | manual curl + tsc | `npx tsc --noEmit` | ⬜ pending |
| 3-01-02 | 01 | 1 | FEED-01..05, API-02 | manual curl + tsc | `npx tsc --noEmit` | ⬜ pending |
| 3-02-01 | 02 | 2 | API-03 | manual curl + tsc | `npx tsc --noEmit` | ⬜ pending |
| 3-02-02 | 02 | 2 | API-04, API-05 | manual curl + tsc | `npx tsc --noEmit` | ⬜ pending |
| 3-02-03 | 02 | 2 | API-06, API-07 | manual curl + tsc | `npx tsc --noEmit` | ⬜ pending |
| 3-02-04 | 02 | 2 | ERR-02..06, SEC-04 | grep + tsc | `grep -rE "console\.(log|info|warn|error).*appToken" src/app/` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No new test files needed — route handlers cannot be unit-tested without a running Next.js server. The underlying pipeline is already covered by Phase 2's 169 tests. Route correctness is verified via:
1. `npx tsc --noEmit` (type-level correctness of all route files)
2. `npm run build` (Next.js route compilation)
3. Manual curl tests during execution (see Manual-Only Verifications)

*Existing infrastructure covers all phase requirements at the unit level.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hook returns 200 on valid event | HOOK-01, API-01 | Requires running Next.js server | `npm run dev` → `curl -X POST http://localhost:3000/api/vtex/hook -H "Content-Type: application/json" -d '{"orderId":"test-123"}'` → expect `{"ok":true}` |
| Feed poll returns summary | FEED-01, API-02 | Requires running server + VTEX creds | Start server, set env vars, click "Poll Feed Now" or POST /api/vtex/feed/poll |
| GET /api/erp/orders returns list | API-04 | Requires running server with data | `curl http://localhost:3000/api/erp/orders` → expect `{"orders":[],"total":0}` |
| ERR-02: 401 recorded in timeline | ERR-02 | Requires live VTEX call | Send hook with valid format but invalid creds → order should show ERROR status |
| SEC-04: token not in server logs | SEC-04 | Runtime behavior | Observe terminal output during hook processing — appToken must never appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] `npx tsc --noEmit` passes after all routes created
- [ ] `npm run build` exits 0
- [ ] Manual curl tests documented and runnable
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
