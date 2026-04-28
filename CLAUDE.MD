# CLAUDE.md

## Project: VTEX OMS to ERP Demo Console

You are Claude Code acting as a senior full-stack engineer and solution architect.

Build an MVP web application that simulates an external ERP integration with VTEX OMS.

The app must be simple, efficient, demo-friendly, and deployable to GitHub and Vercel.

Official VTEX reference:
https://developers.vtex.com/docs/guides/erp-integration-set-up-order-integration

---

## 1. Business Context

When an order is placed in VTEX, the order must be integrated with an external ERP.

VTEX supports order integration patterns using:
- Feed
- Hook

This MVP simulates the external ERP side of the integration.

The demo app must:
1. Receive or consume VTEX order events.
2. Call VTEX Get Order API.
3. Load full order information.
4. Normalize the order into a simplified ERP payload.
5. Simulate ERP acceptance.
6. Call VTEX Start Handling.
7. Display the order in an ERP-style order inbox.

The main demo objective is to show the end-to-end operational handoff:

```text
VTEX OMS
  → Feed or Hook
  → Demo ERP Integration App
  → VTEX Get Order
  → ERP Order Acceptance
  → VTEX Start Handling
  → ERP Orders Inbox
```

---

## 2. Architecture Principle

Use pragmatic composability.

- VTEX remains the source of truth for OMS and order orchestration.
- The Vercel app acts only as middleware and a simulated ERP.
- Avoid unnecessary microservices for the MVP.
- Make each integration step visible in the UI.
- Prioritize low TCO, fast deployment, and demo clarity.
- Keep the app modular enough to evolve into a production-grade integration later.

---

## 3. Recommended Stack

Use:

- Next.js latest stable version
- TypeScript
- Vercel-compatible serverless API routes
- Tailwind CSS or a simple clean UI
- In-memory storage for MVP
- No database required for MVP
- Basic test setup

Important:
- In-memory storage is acceptable for the demo.
- Clearly document that in-memory storage is not production-safe.
- Structure the code so persistence can be replaced later with Vercel KV, Supabase, PostgreSQL, DynamoDB, or another durable store.

---

## 4. MVP Scope

The MVP must include:

- VTEX credential configuration
- Hook endpoint
- Manual Feed polling
- VTEX Get Order API client
- ERP payload normalizer
- Simulated ERP order acceptance
- Mandatory VTEX Start Handling after successful ERP acceptance
- Unified ERP Orders Inbox
- Accordion-based order detail view
- Start Handling status and retry action
- Basic processing timeline
- Basic error handling
- PII masking
- README and SDD documentation
- Basic tests

---

## 5. Non-Goals for MVP

Do not implement these in the MVP unless they are trivial and do not delay the core flow:

- Persistent database
- Vercel Cron background polling
- Retry queue with exponential backoff
- Dead-letter queue
- Multi-tenant configuration
- User authentication
- RBAC
- Advanced audit log
- Advanced observability platform
- Real outbound ERP API integration
- CI/CD pipeline
- Complex feed configuration editor
- Docker support

These belong in the v0 improvement backlog.

---

## 6. Required User Flow

### Hook Mode

```text
VTEX sends order event
  → POST /api/vtex/hook
  → App extracts orderId
  → App calls VTEX Get Order
  → App normalizes order into ERP payload
  → App simulates ERP acceptance
  → App calls VTEX Start Handling
  → Order appears in ERP Orders Inbox
```

### Feed Mode

```text
User clicks "Poll Feed Now"
  → POST /api/vtex/feed/poll
  → App retrieves feed items from VTEX
  → App extracts orderId from each event
  → App deduplicates events
  → App calls VTEX Get Order
  → App normalizes order into ERP payload
  → App simulates ERP acceptance
  → App calls VTEX Start Handling
  → App commits feed item when configured
  → Order appears in ERP Orders Inbox
```

---

## 7. VTEX API Requirements

Create a VTEX client module:

```text
src/lib/vtexClient.ts
```

It must support:

```ts
getOrder(orderId: string)
getFeedItems()
commitFeedItems(handles: string[])
startHandling(orderId: string)
```

Optional if feasible:

```ts
getFeedConfiguration()
updateFeedConfiguration(config)
```

Use these headers:

```text
X-VTEX-API-AppKey: {appKey}
X-VTEX-API-AppToken: {appToken}
Accept: application/json
Content-Type: application/json
```

Build the Get Order URL using:

```text
https://{account}.{environment}/api/oms/pvt/orders/{orderId}
```

Default environment:

```text
vtexcommercestable.com.br
```

For Feed and Start Handling endpoints:
- Follow the official VTEX API documentation.
- Keep endpoint paths configurable in a constants file in case VTEX versioning differs.
- Document endpoint assumptions clearly.

---

## 8. Mandatory Start Handling Requirement

Start Handling is mandatory for the MVP.

After the app successfully:

1. Receives an order event from Feed or Hook
2. Calls VTEX Get Order API
3. Normalizes the order into the simulated ERP payload
4. Simulates successful ERP acceptance

The app must call VTEX Start Handling for that order.

Create endpoint:

```text
POST /api/vtex/orders/:orderId/start-handling
```

The endpoint must:

- Use configured VTEX account, environment, app key, and app token
- Call the VTEX OMS Start Handling API
- Update the ERP order timeline
- Mark Start Handling as SUCCESS or ERROR
- Show the result in the ERP Orders accordion

Processing rules:

- Start Handling must only be called after simulated ERP processing returns SUCCESS.
- If ERP simulation fails, do not call Start Handling.
- If Get Order fails, do not call Start Handling.
- If Start Handling fails, keep the ERP order status as START_HANDLING_ERROR or ERROR.
- The user must be able to retry Start Handling manually from the order accordion.

---

## 9. Configuration UI

Create a minimal configuration panel.

Fields:

- VTEX account name
- VTEX environment
  - Default: `vtexcommercestable.com.br`
- VTEX App Key
- VTEX App Token
- Integration mode:
  - FEED
  - HOOK
- Auto commit feed item:
  - On/off
- Simulate ERP failure:
  - On/off

Important:

- Do not expose the app token in the UI after saving.
- Do not log the app token.
- Prefer server-side environment variables for deployed Vercel environments.
- For MVP, configuration can use in-memory or local demo state.
- Clearly document that production must use encrypted server-side storage.

---

## 10. Hook Endpoint

Expose:

```text
POST /api/vtex/hook
```

The endpoint must:

- Accept a VTEX order notification payload.
- Validate payload shape as much as possible.
- Extract:
  - orderId
  - status/state
  - event id if present
  - timestamp if present
- Store the received event in the technical event log.
- Deduplicate the event.
- Call VTEX Get Order API.
- Normalize the order into ERP payload.
- Simulate ERP acceptance.
- Call VTEX Start Handling if ERP acceptance succeeds.
- Store the final result in the ERP Orders list.
- Return 200 quickly with JSON response.

Optional demo security:

- Support shared secret validation through a header:

```text
x-demo-hook-secret
```

Document that this is demo-level security only.

---

## 11. Feed Consumer Mode

Expose:

```text
POST /api/vtex/feed/poll
```

The endpoint must:

- Call VTEX Retrieve Feed Items API.
- Read events from the feed queue.
- Handle duplicate events idempotently.
- For each valid event:
  - Extract orderId.
  - Prefer processing orders in `ready-for-handling` state.
  - Call VTEX Get Order API.
  - Normalize the order into ERP payload.
  - Simulate ERP acceptance.
  - Call VTEX Start Handling after ERP success.
  - If configured, commit feed item using the event handle.
  - Update the ERP Orders list.
  - Update the processing timeline.

The UI must have a button:

```text
Poll Feed Now
```

---

## 12. Simulated ERP Processing

Create module:

```text
src/lib/erpSimulator.ts
```

It must transform a VTEX order into a simplified ERP order object.

ERP payload fields:

```ts
type ErpOrderPayload = {
  externalOrderId: string;
  orderId: string;
  sequence?: string;
  status?: string;
  creationDate?: string;
  customer?: {
    name?: string;
    emailMasked?: string;
    documentMasked?: string;
  };
  items: Array<{
    skuId?: string;
    productId?: string;
    name?: string;
    quantity?: number;
    price?: number;
    sellingPrice?: number;
    total?: number;
  }>;
  totals?: unknown;
  paymentSummary?: string;
  shippingSummary?: string;
  logisticsInfo?: unknown;
  marketplace?: string;
  rawSource?: "VTEX";
};
```

ERP simulation must:

- Return SUCCESS by default.
- Support a simulated failure mode from the UI.
- Store processing steps in the timeline.

---

## 13. ERP Orders Inbox

The main screen must be a unified ERP Orders Inbox.

It must show all orders received from both sources:

- FEED
- HOOK

The ERP Orders Inbox is the primary business-facing view.

The technical event log is secondary.

### ERP Orders List Columns

Show:

- ERP processing status
- VTEX orderId
- VTEX sequence
- VTEX order status/state
- Source:
  - FEED
  - HOOK
- Customer name
- Customer email masked
- Total order value
- Number of items
- Shipping SLA / delivery method
- Payment method summary
- Start Handling status
- Received date/time
- Last processing attempt date/time
- Number of attempts
- Error message, if any

### List Behavior

The list must:

- Show newest orders at the top.
- Filter by source:
  - ALL
  - FEED
  - HOOK
- Filter by status:
  - RECEIVED
  - PROCESSING
  - ERP_ACCEPTED
  - START_HANDLING_SUCCESS
  - START_HANDLING_ERROR
  - ERROR
  - DUPLICATE_IGNORED
  - MANUALLY_RESOLVED
- Search by:
  - orderId
  - sequence
  - customer name
  - SKU name
- Sort by receivedAt descending by default.

---

## 14. Accordion Order Detail

Each order row must be expandable using an accordion.

When expanded, show:

### 1. ERP Summary

- orderId
- sequence
- customer
- totals
- payment
- logistics
- current ERP status
- Start Handling status

### 2. Order Items

- skuId
- productId
- product name
- quantity
- unit price
- selling price
- total item value

### 3. Shipping Details

- selected SLA
- courier/carrier if available
- delivery estimate if available
- masked shipping address

### 4. Payment Details

- payment system name
- installments
- value
- transaction status if available

### 5. ERP Normalized Payload

- Pretty JSON viewer

### 6. Raw VTEX Order Payload

- Pretty JSON viewer
- Collapsed by default

### 7. Processing Timeline

Timeline steps:

- Event received
- VTEX Get Order requested
- VTEX Get Order success/error
- ERP payload normalized
- ERP simulation started
- ERP simulation success/error
- VTEX Start Handling requested
- VTEX Start Handling success/error
- Feed item committed, if applicable
- Error, if applicable

### 8. Actions

Add actions:

- Reprocess order
- Retry Get Order
- Retry Start Handling
- Copy ERP payload
- Copy VTEX raw payload
- Mark as manually resolved
- Simulate ERP failure
- Simulate ERP success

---

## 15. Data Model

Create a normalized internal object:

```ts
type IntegrationSource = "FEED" | "HOOK";

type TimelineStatus = "SUCCESS" | "ERROR" | "INFO" | "SKIPPED";

type ErpStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "ERP_ACCEPTED"
  | "START_HANDLING_SUCCESS"
  | "START_HANDLING_ERROR"
  | "ERROR"
  | "DUPLICATE_IGNORED"
  | "MANUALLY_RESOLVED";

type StartHandlingStatus =
  | "NOT_STARTED"
  | "SUCCESS"
  | "ERROR";

type ErpOrderRecord = {
  id: string;
  orderId: string;
  sequence?: string;
  source: IntegrationSource;
  vtexStatus?: string;
  erpStatus: ErpStatus;
  startHandlingStatus: StartHandlingStatus;
  customerName?: string;
  customerEmailMasked?: string;
  totalValue?: number;
  itemCount?: number;
  paymentSummary?: string;
  shippingSummary?: string;
  receivedAt: string;
  lastAttemptAt?: string;
  attempts: number;
  errorMessage?: string;
  vtexOrderRaw?: unknown;
  erpPayload?: unknown;
  startHandlingResponse?: unknown;
  timeline: Array<{
    timestamp: string;
    step: string;
    status: TimelineStatus;
    message?: string;
  }>;
};
```

---

## 16. API Requirements

Implement these MVP endpoints:

```text
POST /api/vtex/hook
POST /api/vtex/feed/poll
POST /api/vtex/orders/:orderId/start-handling
GET  /api/erp/orders
GET  /api/erp/orders/:orderId
POST /api/erp/orders/:orderId/reprocess
POST /api/erp/orders/:orderId/retry-start-handling
```

Optional if simple:

```text
POST /api/erp/orders/:orderId/resolve
POST /api/vtex/feed/commit
```

The UI must consume these endpoints instead of reading internal logs directly.

---

## 17. Idempotency Requirements

VTEX Feed can deliver duplicate events.

The app must:

- Deduplicate by eventId when available.
- Fall back to `orderId + state + timestamp` if eventId is not present.
- Avoid processing the same event twice.
- Show duplicate events as ignored in the technical event log.
- Avoid calling Start Handling twice for the same successfully handled order unless the user explicitly retries.

---

## 18. Error Handling Requirements

Handle:

- Missing VTEX credentials
- Invalid VTEX app key/token
- VTEX 401/403
- VTEX 404 order not found
- VTEX 429 rate limiting
- Empty Feed response
- Malformed Hook payload
- Duplicate event ignored
- ERP simulated failure
- Start Handling failure
- Feed commit failure

Errors must appear in:

1. ERP Orders Inbox status
2. Accordion timeline
3. Technical event log

---

## 19. Security Requirements

- Never commit secrets.
- Add `.env.example`.
- Use server-side environment variables for VTEX credentials when deployed.
- Mask PII in UI.
- Do not log app token.
- Do not log full customer document.
- Do not expose full customer document in the UI.
- Add basic request validation.
- Add optional hook secret.
- Add CORS restrictions where appropriate.
- Document production hardening recommendations.

---

## 20. Required Files and Documentation

Generate:

```text
README.md
/docs/SDD.md
/docs/API.md
/docs/DEPLOYMENT.md
/docs/SECURITY.md
/docs/VTEX_SETUP.md
.env.example
```

### README.md Must Include

- Project purpose
- Architecture summary
- Local setup
- Environment variables
- VTEX setup instructions
- Feed mode usage
- Hook mode usage
- Demo script
- Troubleshooting
- Production hardening recommendations

### SDD.md Must Include

- Problem statement
- Business context
- MVP scope
- Non-goals
- Actors:
  - VTEX OMS
  - Feed consumer
  - Hook receiver
  - Simulated ERP
  - Demo operator
- Architecture diagram in Mermaid
- Sequence diagrams in Mermaid:
  - Feed flow
  - Hook flow
  - Get Order flow
  - Start Handling flow
- API design
- Data model
- Error handling strategy
- Idempotency strategy
- Security model
- Observability/logging
- Deployment model on Vercel
- Limitations
- v0 improvement backlog

---

## 21. Environment Variables

Create `.env.example` with:

```env
VTEX_ACCOUNT=
VTEX_ENVIRONMENT=vtexcommercestable.com.br
VTEX_APP_KEY=
VTEX_APP_TOKEN=
DEMO_HOOK_SECRET=
AUTO_COMMIT_FEED=false
SIMULATE_ERP_FAILURE=false
```

Optional:

```env
NEXT_PUBLIC_APP_URL=
```

---

## 22. UI Requirements Summary

Create a clean dashboard with:

1. Configuration panel
2. Integration mode selector:
   - Feed
   - Hook
3. Hook endpoint URL display
4. Poll Feed Now button
5. ERP Orders Inbox as the primary view
6. Accordion order detail
7. Start Handling status column
8. Technical event log as secondary/debug view
9. Error panel
10. Demo instructions panel

The UI must be simple and business-friendly.

---

## 23. Tests

Add basic tests for:

- VTEX order normalization
- Event deduplication
- Hook payload parsing
- ERP simulator success/failure
- PII masking
- Start Handling rule:
  - called after ERP success
  - not called after ERP failure
  - not called after Get Order failure

---

## 24. v0 Improvement Backlog

After the MVP, propose these improvements:

1. Persistent storage using Vercel KV, Supabase, Postgres, or DynamoDB
2. Background scheduled polling using Vercel Cron
3. Retry queue with exponential backoff
4. Dead-letter queue
5. Per-account multi-tenant configuration
6. OAuth or proper admin authentication
7. Role-based access control
8. Audit log
9. Webhook signature validation or stronger gateway security
10. Observability with structured logs and correlation IDs
11. Integration with real ERP endpoint
12. Order status mapping configuration
13. Feed configuration editor
14. Automated Start Handling rules
15. Export payload to JSON/CSV
16. Mock VTEX mode for demos without a live VTEX account
17. Demo seed data
18. Docker support
19. CI pipeline on GitHub Actions
20. API rate limit protection

---

## 25. Implementation Instructions

Work in this order:

1. Create docs and SDD.
2. Implement shared types.
3. Implement VTEX client.
4. Implement ERP simulator.
5. Implement in-memory store.
6. Implement Hook endpoint.
7. Implement Feed polling endpoint.
8. Implement Start Handling endpoint.
9. Implement ERP Orders API.
10. Implement UI dashboard.
11. Implement accordion order details.
12. Add tests.
13. Verify local build.

Prioritize readable code over clever abstractions.

Make all demo flows visible in the UI.

Add comments only where they explain integration decisions.

---

## 26. Acceptance Criteria

The MVP is complete when:

- The app starts locally with `npm run dev`.
- The app builds with `npm run build`.
- The user can configure VTEX account, app key, and app token.
- The app exposes a Hook endpoint.
- The app can manually poll VTEX Feed.
- The app can call VTEX Get Order API.
- The app can normalize the VTEX order into an ERP payload.
- The app can simulate ERP acceptance.
- The app automatically calls VTEX Start Handling after ERP success.
- The app does not call Start Handling when ERP simulation fails.
- The app does not call Start Handling when Get Order fails.
- The Start Handling result appears in the order timeline.
- The user can manually retry Start Handling from the accordion.
- The dashboard includes a unified ERP Orders Inbox.
- Orders from both Feed and Hook appear in the same list.
- Each order row can be expanded using an accordion.
- Expanding an order shows:
  - summary
  - items
  - payment
  - shipping
  - ERP payload
  - raw VTEX payload
  - processing timeline
- The app handles duplicate feed events.
- The app masks sensitive customer data in the UI.
- The technical event log remains available as a debugging view.
- The app includes complete documentation.

---

## 27. Final Output Expected from Claude Code

At the end, provide a concise summary:

- What was built
- How to run locally
- How to deploy to Vercel
- How to configure VTEX Feed
- How to configure VTEX Hook
- How Start Handling works
- Known limitations
- Recommended next improvements
