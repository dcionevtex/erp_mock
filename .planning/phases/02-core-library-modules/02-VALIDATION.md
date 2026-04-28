---
phase: 2
slug: core-library-modules
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npx vitest run src/lib/__tests__/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/__tests__/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 2-01-01 | 01 | 1 | SEC-01, SEC-02, SEC-03 | unit | `npx vitest run src/lib/__tests__/piiMasker.test.ts` | ⬜ pending |
| 2-01-02 | 01 | 1 | FEED-03 (dedup logic) | unit | `npx vitest run src/lib/__tests__/deduplicator.test.ts` | ⬜ pending |
| 2-02-01 | 02 | 2 | PIPE-01 | unit | `npx vitest run src/lib/__tests__/vtexClient.test.ts` | ⬜ pending |
| 2-02-02 | 02 | 2 | PIPE-01 (Feed/commit) | unit | `npx vitest run src/lib/__tests__/vtexClient.test.ts` | ⬜ pending |
| 2-03-01 | 03 | 3 | PIPE-02, PIPE-03 | unit | `npx vitest run src/lib/__tests__/erpSimulator.test.ts` | ⬜ pending |
| 2-04-01 | 04 | 4 | PIPE-04..08 | unit | `npx vitest run src/lib/__tests__/orderProcessor.test.ts` | ⬜ pending |
| 2-04-02 | 04 | 4 | PIPE-04..08 (timeline) | unit | `npx vitest run src/lib/__tests__/orderProcessor.test.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/piiMasker.test.ts` — stubs for SEC-01, SEC-02, SEC-03
- [ ] `src/lib/__tests__/deduplicator.test.ts` — stubs for FEED-03
- [ ] `src/lib/__tests__/vtexClient.test.ts` — stubs for PIPE-01 (uses vi.fn() mock fetcher)
- [ ] `src/lib/__tests__/erpSimulator.test.ts` — stubs for PIPE-02, PIPE-03
- [ ] `src/lib/__tests__/orderProcessor.test.ts` — stubs for PIPE-04..08, TEST-01..06

*Existing infrastructure (Vitest, store.test.ts, config.test.ts) covers the framework — only test files need creating.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VTEX Get Order with real credentials | PIPE-01 | Requires live VTEX account | Configure .env, call POST /api/vtex/hook with a real orderId after Phase 3 |

*All other Phase 2 behaviors have automated unit test verification via injected mocks.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
