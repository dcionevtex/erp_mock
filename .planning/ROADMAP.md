# Roadmap: VTEX OMS to ERP Demo Console

**Milestone:** v1 MVP
**Total phases:** 5
**Requirements covered:** 69/69

---

## Overview

Greenfield Next.js app that simulates the full VTEX OMS-to-ERP handoff. The build follows a hard critical path: project scaffold and types first, then the processing pipeline library, then API routes wired to that library, then the UI dashboard consuming the API, and finally the documentation suite. Each phase delivers a coherent, independently verifiable capability.

---

## Phases

- [x] **Phase 1: Foundation** - Project scaffold, TypeScript types, in-memory store, and environment configuration (completed 2026-04-28)
- [x] **Phase 2: Core Library Modules** - Processing pipeline, normalization, deduplication, ERP simulator, PII masking, and unit tests (completed 2026-04-29)
- [x] **Phase 3: API Routes** - All Next.js API endpoints wired to the library, Hook/Feed integration, and server-side security (completed 2026-04-29)
- [x] **Phase 4: UI Dashboard** - Config panel, ERP Orders Inbox, accordion order detail, and client-side error states (completed 2026-04-29)
- [x] **Phase 5: Documentation** - README and full documentation suite (SDD, API, DEPLOYMENT, SECURITY, VTEX_SETUP) (completed 2026-04-29)

---

## Phase Details

### Phase 1: Foundation
**Goal**: A deployable Next.js + TypeScript skeleton exists with all shared types, the in-memory store, and verified environment variable wiring — no business logic yet, but every subsequent phase can build on it without rework.
**Depends on**: Nothing (first phase)
**Requirements**: CONFIG-05, CONFIG-06, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. `npm run dev` starts without errors and the app loads on localhost
  2. All shared TypeScript types (`VtexOrder`, `ErpOrderPayload`, `ErpOrderRecord`, pipeline step types) are defined and importable across the project
  3. The in-memory store module exists and exposes typed CRUD operations for `ErpOrderRecord`
  4. App reads VTEX credentials from environment variables at runtime; `.env.example` is committed with all required variable names
  5. VTEX app token is never printed to server-side console logs in any code path
**Plans**: TBD

### Phase 2: Core Library Modules
**Goal**: The complete processing pipeline — Get Order, normalize, ERP simulate, Start Handling guards, deduplication, and PII masking — is implemented as pure, tested library functions independent of any HTTP layer.
**Depends on**: Phase 1
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08, SEC-01, SEC-02, SEC-03, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. All six unit test suites pass (`npm test`): normalization, deduplication, Hook payload parsing, ERP simulator, PII masking, Start Handling guards
  2. The normalizer maps a full VTEX order response to a typed `ErpOrderPayload` with customer email and document masked at normalization time
  3. The ERP simulator returns SUCCESS by default and FAILURE when the simulate-failure flag is set
  4. Start Handling is never called after ERP failure, after Get Order failure, or for an order already in `START_HANDLING_SUCCESS` status — enforced by guard logic with test coverage
  5. Each pipeline step records a timestamped entry (step name, status, message) on the `ErpOrderRecord` processing timeline
**Plans**: TBD

### Phase 3: API Routes
**Goal**: All seven Next.js API routes exist, accept real HTTP requests, run the full pipeline, and return correct responses — the app can process a VTEX order end-to-end without touching the UI.
**Depends on**: Phase 2
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, API-01, API-02, API-03, API-04, API-05, API-06, API-07, ERR-02, ERR-03, ERR-04, ERR-05, ERR-06, SEC-04
**Success Criteria** (what must be TRUE):
  1. `POST /api/vtex/hook` receives a VTEX order event, extracts `orderId`, runs the full pipeline, and returns HTTP 200 immediately — verifiable with curl or Postman
  2. `POST /api/vtex/feed/poll` calls the VTEX Feed API, processes all available items through the pipeline, deduplicates repeats, and returns a summary of processed/skipped counts
  3. All seven API endpoints (`/hook`, `/feed/poll`, `/orders/[orderId]/start-handling`, `/erp/orders`, `/erp/orders/[orderId]`, `/erp/orders/[orderId]/reprocess`, `/erp/orders/[orderId]/retry-start-handling`) respond correctly to well-formed requests
  4. VTEX API errors (401, 403, 404, 429) and malformed Hook payloads are caught, recorded on the order timeline and inbox status, and returned as structured error responses — not unhandled exceptions
  5. VTEX app token never appears in any server log line during normal or error operation
**Plans**: TBD

### Phase 4: UI Dashboard
**Goal**: The browser UI delivers the full demo experience: a config panel to set credentials and mode, the ERP Orders Inbox with filtering and search, and the full accordion detail view for each order — all error states visible, all PII masked.
**Depends on**: Phase 3
**Requirements**: CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, INBOX-01, INBOX-02, INBOX-03, INBOX-04, INBOX-05, INBOX-06, DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, DETAIL-06, DETAIL-07, DETAIL-08, DETAIL-09, ERR-01
**Success Criteria** (what must be TRUE):
  1. User can open the config panel, enter VTEX account name, app key, app token, select environment, choose integration mode (Feed/Hook), toggle auto-commit and simulate-failure, save — and the app token field never shows the saved value in plain text
  2. The ERP Orders Inbox displays all received orders in a table with all required columns (ERP status, orderId, sequence, VTEX status, source, customer name, masked email, total, item count, SLA, payment summary, Start Handling status, dates, attempt count, error) sorted newest-first by default
  3. User can filter the inbox by source (ALL/FEED/HOOK), by ERP status, and search by orderId, sequence, customer name, or SKU name — results update without a page reload
  4. Clicking any order row expands an accordion showing all nine sections: ERP Summary, Order Items, Shipping Details, Payment Details, ERP Normalized Payload (syntax-highlighted JSON), Raw VTEX Payload (collapsed by default), Processing Timeline, and Actions
  5. All nine accordion action buttons (Reprocess, Retry Get Order, Retry Start Handling, Copy ERP payload, Copy VTEX raw payload, Mark as resolved, Simulate ERP failure, Simulate ERP success) are present and functional; a clear UI message appears when VTEX credentials are missing or not configured
**Plans**: TBD

### Phase 5: Documentation
**Goal**: The full documentation suite is written and accurate — a solutions engineer can pick up the project, deploy it to Vercel, configure a VTEX account, and run a live demo using only the docs.
**Depends on**: Phase 4
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06
**Success Criteria** (what must be TRUE):
  1. `README.md` covers project purpose, architecture, local setup, all environment variables, VTEX Feed and Hook setup, a step-by-step demo script, troubleshooting, and production hardening notes
  2. `docs/SDD.md` includes a Mermaid architecture diagram and sequence diagrams for the Feed flow, Hook flow, Get Order, and Start Handling — all matching the implemented behavior
  3. `docs/API.md` documents all seven endpoints with exact request/response shapes and error codes
  4. `docs/DEPLOYMENT.md`, `docs/SECURITY.md`, and `docs/VTEX_SETUP.md` are each complete standalone documents covering their respective topics
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete    | 2026-04-28 |
| 2. Core Library Modules | 4/4 | Complete    | 2026-04-29 |
| 3. API Routes | 2/2 | Complete    | 2026-04-29 |
| 4. UI Dashboard | 3/3 | Complete    | 2026-04-29 |
| 5. Documentation | 1/1 | Complete    | 2026-04-29 |

---

# Milestone: v2 — VTEX Demo Platform

**Goal:** Transform the single ERP mock into a multi-simulator platform. A launcher page at `/` presents all tools. Each simulator lives under its own route prefix with isolated state. Shared auth only.

**Status: Complete** — all work landed on `main`. Branch `feat/platform-shell` deleted (fully merged).

## Architecture

```
/                           → Launcher (tool picker + The Lab section)
/erp/*                      → ERP Simulator (migrated from /)
/payment-provider/*         → Payment Provider Simulator
/marketplace/*              → External Seller Simulator (Marketplace Protocol)
/login                      → Shared Google OAuth login (@vtex.com only)

Shared: Google OAuth, iron-session VTEX credentials
Isolated: all state, all routes, all components per tool
API routes: /api/erp/*, /api/vtex/*, /api/payment-provider/*, /api/marketplace/*
```

## Phases

- [x] **Phase 1 — Platform Shell** *(completed 2026-05-20)*
  Launcher page at `/`, ERP mock pages migrated to `/erp/*`, sidebar updated with back-to-platform link. No API or logic changes.

- [x] **Phase 2 — Payment Provider Protocol: Core** *(completed 2026-05-20)*
  All 6 PPP endpoints under `/api/payment-provider/*`. In-memory payment record store. Scenario toggles: approved / denied / pending / undefined.
  Endpoints: `GET /manifest`, `POST /payments`, `POST /payments/{id}/cancellations`, `POST /payments/{id}/settlements`, `POST /payments/{id}/refunds`, `GET /payments/{id}`

- [x] **Phase 3 — Payment Provider Protocol: Dashboard** *(completed 2026-05-20)*
  Educational UI at `/payment-provider`. Flow diagram (test suite progress), live call log, context panel with inline protocol docs, annotated request/response, scenario controls. Setup guide tab added.

- [x] **Phase 4 — External Seller Simulator (Marketplace Protocol)** *(completed 2026-05-21)*
  Four External Seller Fulfillment endpoints under `/api/marketplace/[account]/*`. Live call log at `/marketplace`. Test product callout with direct checkout link. Catalog tab (Coming Soon). Released as Beta.
  Endpoints: `POST /pvt/orderForms/simulation`, `POST /pvt/orders`, `POST /pvt/orders/{id}/fulfill`, `POST /pvt/orders/{id}/cancel`

- [x] **Phase 5 — Docs + Release Notes** *(completed 2026-05-21)*
  Release notes updated to v1.1.1. Launcher updated with The Lab section. Login page redesigned for multi-tool platform.

## Design Decisions

- PPP mock acts as the *provider* (receives calls from VTEX test suite), not the caller
- VTEX test suite points to `{APP_URL}/api/payment-provider` as base URL
- PPP educational layer is contextual — shown next to the live call, not in a separate docs tab
- Marketplace mock uses dynamic `[account]` route segment — same deployment handles any VTEX account
- External Seller endpoints follow the pattern from `vtex-apps/external-seller-example` (official reference)
- Order placement response must spread the full input body (preserves `selectedSla` and all logistics fields)
