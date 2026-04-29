# Requirements: VTEX OMS to ERP Demo Console

**Defined:** 2026-04-28
**Core Value:** Show the complete end-to-end operational handoff from VTEX OMS to a simulated ERP — Feed or Hook → Get Order → ERP Acceptance → Start Handling — with every step visible in the UI.

---

## v1 Requirements

### Configuration (CONFIG)

- [ ] **CONFIG-01**: User can configure VTEX account name, environment, app key, and app token via a UI config panel
- [ ] **CONFIG-02**: User can select integration mode (Feed or Hook) from the config panel
- [ ] **CONFIG-03**: User can toggle auto-commit of feed item handles on/off
- [ ] **CONFIG-04**: User can toggle simulate-ERP-failure mode on/off from the config panel
- [x] **CONFIG-05**: App token is masked/hidden in the UI after being saved — never displayed in plain text
- [x] **CONFIG-06**: App reads VTEX credentials from server-side environment variables when deployed to Vercel

### Hook Integration (HOOK)

- [ ] **HOOK-01**: App exposes `POST /api/vtex/hook` endpoint to receive VTEX order event notifications
- [ ] **HOOK-02**: Hook endpoint extracts `orderId` from the notification payload (handles multiple payload shapes)
- [ ] **HOOK-03**: Hook endpoint validates payload shape and returns HTTP 200 immediately (does not block on pipeline)
- [ ] **HOOK-04**: Hook endpoint supports optional demo-level shared secret validation via `x-demo-hook-secret` header
- [ ] **HOOK-05**: Hook endpoint URL is displayed in the UI dashboard for easy copy during demo setup

### Feed Integration (FEED)

- [ ] **FEED-01**: User can trigger a manual VTEX Feed poll by clicking "Poll Feed Now" in the UI
- [ ] **FEED-02**: App calls VTEX Feed API, reads available feed items, and processes each valid event through the pipeline
- [ ] **FEED-03**: App deduplicates Feed events idempotently by `eventId` (falling back to `orderId+state+timestamp` if no `eventId`)
- [ ] **FEED-04**: App commits feed item handle after successful full pipeline completion when auto-commit is enabled
- [ ] **FEED-05**: Duplicate events are stored as `DUPLICATE_IGNORED` and visible in the technical event log

### Processing Pipeline (PIPE)

- [ ] **PIPE-01**: App calls VTEX Get Order API for each received `orderId` after event receipt
- [x] **PIPE-02**: App normalizes the full VTEX order response into a typed `ErpOrderPayload` structure
- [x] **PIPE-03**: App simulates ERP acceptance (returns SUCCESS by default; returns FAILURE when simulate-failure toggle is on)
- [ ] **PIPE-04**: App calls VTEX Start Handling automatically after ERP simulation returns SUCCESS
- [ ] **PIPE-05**: App does NOT call VTEX Start Handling when ERP simulation returns FAILURE
- [ ] **PIPE-06**: App does NOT call VTEX Start Handling when Get Order API call fails
- [ ] **PIPE-07**: App does NOT call VTEX Start Handling a second time for an order already in `START_HANDLING_SUCCESS` status (guard against duplicate calls)
- [ ] **PIPE-08**: Each pipeline step (event received, Get Order, normalize, ERP simulate, Start Handling) is recorded with timestamp and status in the order processing timeline

### ERP Orders Inbox (INBOX)

- [ ] **INBOX-01**: Dashboard shows a unified ERP Orders Inbox displaying orders received from both Feed and Hook sources
- [ ] **INBOX-02**: Inbox table shows columns: ERP status, orderId, sequence, VTEX status, source (FEED/HOOK), customer name, masked email, total value, item count, shipping SLA, payment summary, Start Handling status, received date, last attempt date, attempt count, error message
- [ ] **INBOX-03**: Inbox sorts by received date descending by default (newest orders at top)
- [ ] **INBOX-04**: User can filter inbox by source (ALL / FEED / HOOK)
- [ ] **INBOX-05**: User can filter inbox by ERP status (RECEIVED / PROCESSING / ERP_ACCEPTED / START_HANDLING_SUCCESS / START_HANDLING_ERROR / ERROR / DUPLICATE_IGNORED / MANUALLY_RESOLVED)
- [ ] **INBOX-06**: User can search inbox by orderId, sequence number, customer name, or SKU name

### Accordion Order Detail (DETAIL)

- [ ] **DETAIL-01**: Each order row in the inbox can be expanded via an accordion to show full order detail
- [ ] **DETAIL-02**: Accordion ERP Summary section shows: orderId, sequence, customer (masked), totals, payment summary, logistics summary, current ERP status, Start Handling status
- [ ] **DETAIL-03**: Accordion Order Items section shows: skuId, productId, product name, quantity, unit price, selling price, line total
- [ ] **DETAIL-04**: Accordion Shipping Details section shows: selected SLA, courier/carrier, delivery estimate, masked shipping address
- [ ] **DETAIL-05**: Accordion Payment Details section shows: payment system name, installments, value, transaction status
- [ ] **DETAIL-06**: Accordion ERP Normalized Payload section shows the `ErpOrderPayload` as formatted/syntax-highlighted JSON
- [ ] **DETAIL-07**: Accordion Raw VTEX Order Payload section shows the full raw VTEX Get Order response as formatted JSON (collapsed by default)
- [ ] **DETAIL-08**: Accordion Processing Timeline section shows all pipeline steps with timestamp, step name, status (SUCCESS/ERROR/INFO/SKIPPED), and message
- [ ] **DETAIL-09**: Accordion Actions section provides: Reprocess order, Retry Get Order, Retry Start Handling, Copy ERP payload, Copy VTEX raw payload, Mark as manually resolved, Simulate ERP failure, Simulate ERP success

### Error Handling (ERR)

- [ ] **ERR-01**: App shows a clear UI message when VTEX credentials are missing or not configured
- [ ] **ERR-02**: App handles VTEX API 401/403 errors and records them in the order timeline and inbox status
- [ ] **ERR-03**: App handles VTEX API 404 (order not found) and records it in the order timeline
- [ ] **ERR-04**: App handles VTEX API 429 (rate limiting) and records it in the order timeline
- [ ] **ERR-05**: App handles malformed Hook payloads with a validation error response and technical event log entry
- [ ] **ERR-06**: All errors appear in three places: ERP Orders Inbox status column, order accordion timeline, and technical event log

### Security & PII (SEC)

- [x] **SEC-01**: Customer email address is masked in all UI views (e.g., `d***@vtex.com`)
- [x] **SEC-02**: Customer document number (CPF/CNPJ) is masked in all UI views
- [x] **SEC-03**: PII masking is applied server-side at normalization time — raw VTEX payloads stored in the record do NOT contain unmasked PII
- [x] **SEC-04**: VTEX app token is never written to server logs
- [x] **SEC-05**: `.env.example` file is committed with all required environment variable names and safe placeholder values

### API Endpoints (API)

- [ ] **API-01**: `POST /api/vtex/hook` — receives VTEX order event, runs full pipeline, returns 200
- [ ] **API-02**: `POST /api/vtex/feed/poll` — triggers manual Feed poll, processes all available items, returns summary
- [ ] **API-03**: `POST /api/vtex/orders/[orderId]/start-handling` — calls VTEX Start Handling for a specific order, updates record
- [ ] **API-04**: `GET /api/erp/orders` — returns paginated/filtered list of all `ErpOrderRecord` objects from the store
- [ ] **API-05**: `GET /api/erp/orders/[orderId]` — returns a single `ErpOrderRecord` with full detail
- [ ] **API-06**: `POST /api/erp/orders/[orderId]/reprocess` — re-runs the full pipeline for an existing order
- [ ] **API-07**: `POST /api/erp/orders/[orderId]/retry-start-handling` — retries Start Handling for an order in error state

### Tests (TEST)

- [x] **TEST-01**: Unit tests for VTEX order normalization (maps required fields, handles optional/missing fields)
- [x] **TEST-02**: Unit tests for event deduplication (deduplicates by eventId, falls back to composite key, allows non-duplicates)
- [ ] **TEST-03**: Unit tests for Hook payload parsing (extracts orderId from multiple payload shapes)
- [x] **TEST-04**: Unit tests for ERP simulator (returns SUCCESS by default, returns FAILURE in simulate-failure mode)
- [x] **TEST-05**: Unit tests for PII masking utility (masks email, masks document, leaves non-PII fields unchanged)
- [ ] **TEST-06**: Unit tests for Start Handling guards (called after ERP success; not called after ERP failure; not called after Get Order failure; not called twice for same order)

### Documentation (DOCS)

- [ ] **DOCS-01**: `README.md` covers project purpose, architecture summary, local setup, env vars, VTEX setup, Feed/Hook usage, demo script, troubleshooting, and production hardening
- [ ] **DOCS-02**: `docs/SDD.md` covers problem statement, actors, architecture diagram (Mermaid), sequence diagrams (Feed, Hook, Get Order, Start Handling), data model, error strategy, idempotency, security model, deployment model, and v0 backlog
- [ ] **DOCS-03**: `docs/API.md` documents all endpoints with request/response shapes and error codes
- [ ] **DOCS-04**: `docs/DEPLOYMENT.md` covers Vercel deployment steps, environment variable configuration, and cold-start limitations
- [ ] **DOCS-05**: `docs/SECURITY.md` covers security model, PII masking strategy, credential handling, and production hardening recommendations
- [ ] **DOCS-06**: `docs/VTEX_SETUP.md` covers how to configure a VTEX Feed and register a Hook pointing at the app's endpoint

---

## v2 Requirements

Deferred to post-MVP. Not in current roadmap.

### Persistence
- Persistent storage using Vercel KV, Supabase, PostgreSQL, or DynamoDB
- Survives cold starts and multi-instance deployments

### Background Automation
- Vercel Cron background Feed polling (no manual button required)
- Retry queue with exponential backoff
- Dead-letter queue for permanently failed orders

### Multi-Tenancy & Auth
- Per-account multi-tenant configuration
- OAuth or admin authentication
- Role-based access control (RBAC)

### Observability
- Advanced audit log with structured logs and correlation IDs
- Observability platform integration (Datadog, New Relic, etc.)
- Export payload to JSON/CSV

### Integration
- Real outbound ERP API integration (replace simulator with actual ERP endpoint)
- Order status mapping configuration UI
- Feed configuration editor

### DevOps
- CI/CD pipeline on GitHub Actions
- Docker support
- Mock VTEX mode for demos without a live VTEX account
- Demo seed data for offline demos

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persistent database for MVP | In-memory is sufficient for single-session demos; avoids setup complexity |
| User authentication / RBAC | Demo tool — single-operator use case |
| Real outbound ERP API | Simulated is the demo's point; real ERP adds external dependency |
| Advanced observability platform | Console logging sufficient for MVP |
| CI/CD pipeline | Not required for demo deployment |
| Docker support | Vercel deployment only for MVP |
| Webhook signature validation (beyond demo secret) | Production hardening — documented as recommendation, not implemented |
| Complex Feed configuration editor | Basic config panel sufficient for MVP |
| Auto-refresh / WebSockets | Creates mid-sentence UI changes during live demos (anti-feature); polling is correct |
| Multi-tenant configuration | Single VTEX account per demo session |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONFIG-01 | Phase 4 (UI Dashboard) | Pending |
| CONFIG-02 | Phase 4 (UI Dashboard) | Pending |
| CONFIG-03 | Phase 4 (UI Dashboard) | Pending |
| CONFIG-04 | Phase 4 (UI Dashboard) | Pending |
| CONFIG-05 | Phase 1 (Foundation) | Complete |
| CONFIG-06 | Phase 1 (Foundation) | Complete |
| HOOK-01 | Phase 3 (API Routes) | Pending |
| HOOK-02 | Phase 3 (API Routes) | Pending |
| HOOK-03 | Phase 3 (API Routes) | Pending |
| HOOK-04 | Phase 3 (API Routes) | Pending |
| HOOK-05 | Phase 3 (API Routes) | Pending |
| FEED-01 | Phase 3 (API Routes) | Pending |
| FEED-02 | Phase 3 (API Routes) | Pending |
| FEED-03 | Phase 3 (API Routes) | Pending |
| FEED-04 | Phase 3 (API Routes) | Pending |
| FEED-05 | Phase 3 (API Routes) | Pending |
| PIPE-01 | Phase 2 (Core Library Modules) | Pending |
| PIPE-02 | Phase 2 (Core Library Modules) | Complete |
| PIPE-03 | Phase 2 (Core Library Modules) | Complete |
| PIPE-04 | Phase 2 (Core Library Modules) | Pending |
| PIPE-05 | Phase 2 (Core Library Modules) | Pending |
| PIPE-06 | Phase 2 (Core Library Modules) | Pending |
| PIPE-07 | Phase 2 (Core Library Modules) | Pending |
| PIPE-08 | Phase 2 (Core Library Modules) | Pending |
| INBOX-01 | Phase 4 (UI Dashboard) | Pending |
| INBOX-02 | Phase 4 (UI Dashboard) | Pending |
| INBOX-03 | Phase 4 (UI Dashboard) | Pending |
| INBOX-04 | Phase 4 (UI Dashboard) | Pending |
| INBOX-05 | Phase 4 (UI Dashboard) | Pending |
| INBOX-06 | Phase 4 (UI Dashboard) | Pending |
| DETAIL-01 | Phase 4 (UI Dashboard) | Pending |
| DETAIL-02 | Phase 4 (UI Dashboard) | Pending |
| DETAIL-03 | Phase 4 (UI Dashboard) | Pending |
| DETAIL-04 | Phase 4 (UI Dashboard) | Pending |
| DETAIL-05 | Phase 4 (UI Dashboard) | Pending |
| DETAIL-06 | Phase 4 (UI Dashboard) | Pending |
| DETAIL-07 | Phase 4 (UI Dashboard) | Pending |
| DETAIL-08 | Phase 4 (UI Dashboard) | Pending |
| DETAIL-09 | Phase 4 (UI Dashboard) | Pending |
| ERR-01 | Phase 4 (UI Dashboard) | Pending |
| ERR-02 | Phase 3 (API Routes) | Pending |
| ERR-03 | Phase 3 (API Routes) | Pending |
| ERR-04 | Phase 3 (API Routes) | Pending |
| ERR-05 | Phase 3 (API Routes) | Pending |
| ERR-06 | Phase 3 (API Routes) | Pending |
| SEC-01 | Phase 2 (Core Library Modules) | Complete |
| SEC-02 | Phase 2 (Core Library Modules) | Complete |
| SEC-03 | Phase 2 (Core Library Modules) | Complete |
| SEC-04 | Phase 3 (API Routes) | Complete |
| SEC-05 | Phase 1 (Foundation) | Complete |
| API-01 | Phase 3 (API Routes) | Pending |
| API-02 | Phase 3 (API Routes) | Pending |
| API-03 | Phase 3 (API Routes) | Pending |
| API-04 | Phase 3 (API Routes) | Pending |
| API-05 | Phase 3 (API Routes) | Pending |
| API-06 | Phase 3 (API Routes) | Pending |
| API-07 | Phase 3 (API Routes) | Pending |
| TEST-01 | Phase 2 (Core Library Modules) | Complete |
| TEST-02 | Phase 2 (Core Library Modules) | Complete |
| TEST-03 | Phase 2 (Core Library Modules) | Pending |
| TEST-04 | Phase 2 (Core Library Modules) | Complete |
| TEST-05 | Phase 2 (Core Library Modules) | Complete |
| TEST-06 | Phase 2 (Core Library Modules) | Pending |
| DOCS-01 | Phase 5 (Documentation) | Pending |
| DOCS-02 | Phase 5 (Documentation) | Pending |
| DOCS-03 | Phase 5 (Documentation) | Pending |
| DOCS-04 | Phase 5 (Documentation) | Pending |
| DOCS-05 | Phase 5 (Documentation) | Pending |
| DOCS-06 | Phase 5 (Documentation) | Pending |

**Coverage:**
- v1 requirements: 69 total
- Mapped to phases: 69
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-28*
*Last updated: 2026-04-28 — traceability updated after roadmap creation*
