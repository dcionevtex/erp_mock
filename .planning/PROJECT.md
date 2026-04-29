# VTEX OMS to ERP Demo Console

## What This Is

A Next.js + TypeScript web application that simulates an external ERP integration with VTEX OMS. The app acts as middleware and a simulated ERP: it receives VTEX order events via Feed or Hook, fetches full order details, normalizes the data into an ERP payload, simulates ERP acceptance, and calls VTEX Start Handling — all visible in a business-friendly orders inbox. Designed to be deployed to Vercel and used as a sales/technical demo for the VTEX ERP integration pattern.

## Core Value

Show the complete end-to-end operational handoff from VTEX OMS to a simulated ERP — Feed or Hook → Get Order → ERP Acceptance → Start Handling — with every step visible in the UI.

## Requirements

### Validated

- ✓ App token never exposed in public config shape (`AppConfigPublic` type-level guard) — Validated in Phase 1: Foundation
- ✓ Env vars read server-side via `getServerConfig()` — Validated in Phase 1: Foundation
- ✓ In-memory store with `globalThis` guard, typed CRUD for `ErpOrderRecord` — Validated in Phase 1: Foundation
- ✓ `.env.example` committed with all 8 required env var names — Validated in Phase 1: Foundation
- ✓ Shared TypeScript types: `ErpOrderRecord`, `ErpOrderPayload`, `VtexOrder`, all enums — Validated in Phase 1: Foundation

### Active

- [ ] User can configure VTEX account, app key, app token, environment, and integration mode
- [ ] App exposes POST /api/vtex/hook to receive VTEX order events
- [ ] App can manually poll VTEX Feed via "Poll Feed Now" button
- [ ] App calls VTEX Get Order API for each received orderId
- [ ] App normalizes VTEX order into a simplified ERP payload
- [ ] App simulates ERP acceptance (success by default, failure configurable)
- [ ] App calls VTEX Start Handling automatically after ERP acceptance succeeds
- [ ] App does NOT call Start Handling when ERP simulation fails
- [ ] App does NOT call Start Handling when Get Order fails
- [ ] App deduplicates Feed events idempotently
- [ ] App shows unified ERP Orders Inbox with orders from both Feed and Hook
- [ ] Each order row is expandable (accordion) with summary, items, shipping, payment, ERP payload, raw VTEX payload, and processing timeline
- [ ] User can retry Start Handling manually from the order accordion
- [ ] User can reprocess, retry, copy payloads, and mark orders as resolved from accordion actions
- [ ] App masks PII (email, document) in the UI
- [ ] App includes technical event log as a secondary/debug view
- [ ] App handles all error scenarios with visible feedback
- [ ] README and documentation suite (SDD, API, DEPLOYMENT, SECURITY, VTEX_SETUP) are complete
- [ ] Basic tests cover normalization, deduplication, hook parsing, ERP simulator, PII masking, Start Handling guards

### Out of Scope

- Persistent database (in-memory is sufficient for demo; adds complexity)
- Vercel Cron background polling (manual poll sufficient for MVP)
- Retry queue with exponential backoff (out of scope for demo)
- Dead-letter queue (v0 backlog)
- Multi-tenant configuration (single-account demo)
- User authentication / RBAC (demo tool, no auth needed)
- Advanced audit log / observability platform (console logging sufficient)
- Real outbound ERP API integration (simulated only for MVP)
- CI/CD pipeline on GitHub Actions (v0 backlog)
- Docker support (Vercel deployment only for MVP)
- Complex feed configuration editor (basic config panel sufficient)

## Context

- VTEX supports two order integration patterns: Feed (polling) and Hook (push). This app implements both.
- The official reference: https://developers.vtex.com/docs/guides/erp-integration-set-up-order-integration
- VTEX Feed can deliver duplicate events — idempotency by eventId (falling back to orderId+state+timestamp) is required.
- Start Handling is a mandatory VTEX OMS API call that must happen after ERP acceptance — it signals to VTEX that the order has been picked up.
- The app is greenfield — no existing codebase.
- Target audience: VTEX solutions engineers and partners running demo sessions.
- The app must be deployable to Vercel with environment variable configuration for VTEX credentials.
- In-memory storage is explicitly acceptable for MVP; the code structure must allow easy replacement with Vercel KV, Supabase, or similar later.

## Constraints

- **Tech Stack**: Next.js (latest stable) + TypeScript + Tailwind CSS + serverless API routes — already decided in spec
- **Storage**: In-memory only for MVP — no database provisioning
- **Deployment**: Vercel-compatible — no Docker, no custom servers
- **Security**: Never log or expose VTEX app token; mask PII in UI; use server-side env vars for credentials
- **Demo clarity**: Every integration step must be visible in the UI — this is a demo tool first
- **Timeline**: MVP — prioritize completeness of the core flow over polish

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| In-memory store over database | Zero setup cost, sufficient for demo sessions | — Pending |
| Next.js API routes over separate backend | Single deployable unit, Vercel-native | — Pending |
| Feed + Hook both supported | Covers both VTEX integration patterns | — Pending |
| Start Handling mandatory post-ERP-accept | Core OMS handoff requirement per VTEX spec | — Pending |
| Accordion UI for order detail | Shows all data layers without overwhelming the inbox view | — Pending |
| PII masking in UI | Demo environments may use real VTEX accounts | — Pending |

---
- ✓ `piiMasker.ts` — maskEmail, maskDocument, maskOrderPayload (PII at normalization time) — Validated in Phase 2: Core Library Modules
- ✓ `deduplicator.ts` — eventId-based dedup with orderId+state+timestamp fallback — Validated in Phase 2: Core Library Modules
- ✓ `vtexClient.ts` — injectable factory, getOrder/getFeedItems/commitFeedItems/startHandling — Validated in Phase 2: Core Library Modules
- ✓ `hookParser.ts` — extractOrderId from 6 VTEX payload shapes — Validated in Phase 2: Core Library Modules
- ✓ `erpSimulator.ts` — normalizeOrder + simulateErpAcceptance (SUCCESS/FAILURE modes) — Validated in Phase 2: Core Library Modules
- ✓ `orderProcessor.ts` — full pipeline with all 3 Start Handling guards — Validated in Phase 2: Core Library Modules

*Last updated: 2026-04-29 after Phase 2: Core Library Modules complete*
