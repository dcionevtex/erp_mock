# Features Research: VTEX OMS ERP Demo Console

**Domain:** ERP integration middleware dashboard / demo tool
**Researched:** 2026-04-28
**Confidence:** HIGH (primary source: detailed project spec in claude.md; domain knowledge of ERP middleware dashboards and technical demo UX)

---

## Table Stakes

Must-have features. Missing any of these and the demo fails to prove its core value or leaves the demo operator unable to recover from common issues.

### Orders Inbox Core

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Unified order list (Feed + Hook in same table) | The demo's central claim is "one inbox, two sources" — if they're split, the point is lost | Low | Single in-memory store keyed by orderId |
| Status column with color-coded badges | ERP operators scan by status first; monochrome status is invisible in demos | Low | 7 statuses: RECEIVED, PROCESSING, ERP_ACCEPTED, START_HANDLING_SUCCESS, START_HANDLING_ERROR, ERROR, DUPLICATE_IGNORED |
| Source badge (FEED / HOOK) | The demo shows two integration patterns — the source must be unmistakably visible | Low | Pill badge on each row, filterable |
| Start Handling status column | This is the critical handoff signal to VTEX OMS; it must be independently visible from overall ERP status | Low | NOT_STARTED / SUCCESS / ERROR — separate from erpStatus |
| Newest-first sort by default | Every operations inbox defaults to newest-first; audience expects it | Low | Default sort on receivedAt desc |
| Filter by source (ALL / FEED / HOOK) | Demo operator needs to isolate which integration mode produced results | Low | Three-state toggle, not a dropdown |
| Filter by ERP status | Allows demo operator to show "look — these failed, these succeeded" narrative | Low | Multi-select or quick-filter buttons |
| Search by orderId | Audience will call out a specific orderId; the demo operator must find it instantly | Low | Client-side substring match |
| Expandable accordion per order row | All the detail is needed but must not crush the inbox view | Medium | One row open at a time is acceptable for MVP |
| Received timestamp on each row | Ops dashboards always show when an event arrived | Low | ISO datetime, localized |
| Attempt counter on each row | Shows retry behavior without opening the accordion | Low | Integer column |
| Error message preview on row (truncated) | Errors need to be visible at a glance so demo operator can say "and here's what failure looks like" | Low | 60-char truncation + full text in accordion |

### Accordion Order Detail

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ERP Summary tab/section (orderId, customer, totals, status) | First thing an ERP operator asks about | Low | Always expanded by default when accordion opens |
| Order Items section (SKU, qty, price) | Line items are the core of any ERP order record | Low | Table with unit price + total |
| Shipping Details section (SLA, address masked) | Fulfillment teams need this; also shows PII masking in action | Low | Mask street/number, show city/state/country |
| Payment Details section (method, installments, value) | Finance teams need this during demos with retailers | Low | Payment system name + installment summary |
| ERP Normalized Payload section (pretty JSON) | Shows what the integration would actually send to a real ERP | Medium | Syntax-highlighted, collapsible |
| Raw VTEX Order Payload section (pretty JSON, collapsed by default) | Technical audience wants to see the source data; non-technical audience should not be overwhelmed | Medium | Collapsed by default — critical for demo clarity |
| Processing Timeline section | The single most powerful demo moment: every step of the handoff made visible | Medium | Ordered list of timestamped events with SUCCESS/ERROR/INFO badges |
| Accordion action buttons | Allows demo operator to trigger scenarios live | Low-Medium | See Actions section below |

### Processing Timeline Steps (Table Stakes Content)

Each timeline entry must exist or the demo is incomplete:

- Event received (Feed or Hook)
- VTEX Get Order — requested
- VTEX Get Order — SUCCESS or ERROR
- ERP payload normalized
- ERP simulation — started
- ERP simulation — SUCCESS or ERROR
- VTEX Start Handling — requested (only if ERP succeeded)
- VTEX Start Handling — SUCCESS or ERROR
- Feed item committed (Feed mode only, if auto-commit enabled)
- Any error with message

### Integration Monitoring

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Technical Event Log (secondary/debug view) | Technical audience wants to see raw events; essential for troubleshooting live demos | Medium | List of raw events with timestamps, separate from orders inbox |
| Duplicate event visibility | VTEX Feed delivers duplicates; showing them as DUPLICATE_IGNORED proves the deduplication works | Low | Mark in both orders list and event log |
| Error visibility in three places (inbox status, timeline, event log) | Demo operator needs to recover from errors at a glance; errors buried in one place get missed | Low | Consistent error propagation across all views |
| Retry Start Handling button (in accordion) | Start Handling failures happen in real integrations; showing manual recovery is essential | Low | POST /api/vtex/orders/:orderId/retry-start-handling |
| Reprocess Order button (in accordion) | Live demos need recovery without page refresh | Low | POST /api/erp/orders/:orderId/reprocess |

### Configuration Panel

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| VTEX account name field | Required to construct API URLs | Low | Text input |
| VTEX App Key field | Required auth header | Low | Text input, not masked (key is not secret) |
| VTEX App Token field | Required auth header | Low | Password input — masked after save, never displayed again |
| VTEX environment selector | Demos run on vtexcommercestable or vtexcommercebeta | Low | Default vtexcommercestable.com.br |
| Integration mode toggle (FEED / HOOK) | Core demo selector — which pattern are we showing today? | Low | Prominent, not buried |
| Auto-commit feed toggle | Feed items must be committed; option to show manual vs auto behavior | Low | On/off toggle |
| Simulate ERP failure toggle | Allows demo operator to show the failure path without code changes | Low | On/off toggle — critical differentiator |

### PII Masking

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Customer email masked in list and accordion | Demo accounts may use real customer data from a test store | Low | Show a****@domain.com |
| Customer document masked | CPF/CNPJ must not appear in full in any UI surface | Low | Show ***.***.***-** |
| Shipping address partially masked | Street + number masked; city, state, country visible | Low | Mask happens in ERP normalizer, not in UI layer |

### VTEX-Specific Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Start Handling status visible and distinct | This is the VTEX-specific handoff that non-VTEX ERPs don't have; it's the core of the demo narrative | Low | Column + badge + timeline step |
| Hook endpoint URL display | Demo operator needs to copy-paste this into VTEX admin during setup | Low | Display with one-click copy button |
| Poll Feed Now button | Manual trigger for Feed mode during a live demo (no cron needed) | Low | Prominent button, shows last poll timestamp |
| Feed source on each order row | Proves to audience that Feed-sourced orders are being processed | Low | FEED badge already covers this |
| ready-for-handling state preference in Feed processing | VTEX-specific: Feed delivers all states; only ready-for-handling should trigger the full flow | Low | Filter in feed poll handler, document in UI |

---

## Differentiators

Features that elevate the demo from "it works" to "I want this." None are required for the core flow, but they significantly increase the persuasiveness of the demo session.

### Demo Operator Experience

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Simulate ERP failure toggle (per-order, in accordion) | Allows toggling failure/success for a specific order mid-demo without affecting global state | Low | "Simulate ERP failure" + "Simulate ERP success" buttons in accordion actions already in spec |
| Mark as Manually Resolved action | Shows ERP exception management workflow; resolves stuck orders in demo without clearing them from view | Low | Sets status to MANUALLY_RESOLVED; keeps order in list with resolved badge |
| Copy ERP Payload button | Technical audience asks "what does the payload look like?" — one click answers that | Low | Copies JSON to clipboard with toast confirmation |
| Copy Raw VTEX Payload button | Shows the before/after of normalization | Low | Same as above |
| Last poll timestamp display | Shows when Feed was last polled — reassures audience the system is live | Low | Small text under Poll Feed Now button |
| Integration mode badge in page header | Instantly visible which mode the demo is running in | Low | Pill in header: "Mode: FEED" or "Mode: HOOK" |
| Demo instructions panel | Guides the demo operator through the flow without switching tabs | Low | Collapsible sidebar or modal with step-by-step script |
| Hook endpoint URL with copy button | One-click copy avoids typos during live configuration in VTEX admin | Low | Already in spec; make it prominent |

### Order Inbox Enhancements

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sort by column click (receivedAt, status, value) | Audience asks "can you sort by value?" — showing it works builds confidence | Low | Client-side sort on in-memory data |
| Order count summary bar ("12 orders — 10 success, 1 error, 1 duplicate") | Gives instant operational health view without reading rows | Low | Computed from in-memory store |
| Search by customer name | Audience often asks to find "John's order" | Low | Client-side filter on customerName |
| Search by SKU name | Buyers/merchandisers ask "show me all orders with this product" | Low | Filter on items array |
| Clear all / reset demo button | Allows demo operator to start fresh without restarting the server | Low | Clears in-memory store — must be prominent and require confirm |
| Relative timestamps ("2 minutes ago") | More natural reading than ISO strings in a demo context | Low | Use a library like date-fns/formatRelative |
| Sticky table header | Inbox stays readable when 10+ orders are visible | Low | CSS position: sticky |

### Timeline Enhancements

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Step duration display in timeline ("Get Order: 340ms") | Shows real API latency — makes the integration feel live and measurable | Low | Timestamp delta between steps |
| Expandable error detail in timeline | Technical audience wants to see the full error object, not just "ERROR" | Low | Collapsible within each timeline entry |
| Visual step connector (vertical line) | Standard timeline UI pattern — makes the flow readable at a glance | Low | CSS only |

### Technical Event Log Enhancements

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Filter event log by orderId | When an order errors, jump to all events for that order | Low | Client-side filter |
| Filter event log by event type | Show only hook events, or only feed events | Low | Dropdown |
| Clear event log button | Keeps the debug view clean between demo scenarios | Low | Clears log list only, not orders |
| Duplicate event entries visible in log | Proves deduplication to technical audience without opening an order | Low | DUPLICATE_IGNORED entries in log |

### VTEX-Specific Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Start Handling call visible in timeline with HTTP status | Shows the exact VTEX API call and response — proves it's real | Low | Already part of timeline; make the HTTP status prominent |
| Feed vs Hook flow diagram in demo instructions panel | Visual explanation of why there are two modes | Low | Static SVG or ASCII diagram |
| VTEX OMS status (vtexStatus) visible in accordion | Shows the VTEX-side state, not just the ERP-side state — useful when audiences ask "what's happening in VTEX right now?" | Low | Read from vtexOrderRaw.status |
| Feed commit confirmation in timeline | Shows the Feed acknowledgment step that prevents re-delivery — VTEX-specific concept | Low | "Feed item committed: handle abc123" in timeline |

---

## Anti-Features

Things to explicitly NOT build. These hurt demo clarity, add complexity with no demo payoff, or mislead the audience about what the integration does.

### Clarity Killers

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time auto-refresh / WebSocket live updates | Adds invisible complexity; can cause confusing mid-sentence UI updates during a demo; breaks the "I caused this action" demo narrative | Use explicit "Poll Feed Now" button and manual actions; let the demo operator control pacing |
| Auto-clear old orders after N minutes | Demo operator loses order history mid-session; can't reference an earlier scenario | Keep all orders for the session lifetime; add a manual "Clear All" with confirm |
| Paginated order list | Pagination adds navigation friction during demos; the audience can't see all orders at once | Show all orders (in-memory MVP won't have more than 20-30 anyway); add virtual scroll only if needed |
| Multiple simultaneous open accordions | When two accordions are open, the demo loses focus and the audience doesn't know where to look | One accordion open at a time — clicking a second row closes the first |
| Real ERP API integration (even optional) | Adds credential management, network dependency, and failure modes unrelated to the VTEX integration story | Keep ERP simulated; the story is VTEX → ERP handoff, not ERP internals |
| Order editing / manual order creation UI | This is a receive-only integration; editing orders would misrepresent the ERP integration pattern | No edit capability at all; all orders come from VTEX |
| Order deletion from inbox | Deleting processed orders hides the integration history; demo operator needs all orders for narrative continuity | Only MANUALLY_RESOLVED status; no hard delete |
| User authentication / login screen | A login screen before a demo wastes time and implies production complexity that doesn't exist yet | No auth; demo tool assumption per spec |
| Dark mode toggle | Zero demo value; adds CSS maintenance surface | One clean light theme only |
| Multi-language / i18n | Zero demo value for VTEX Latin America audience; adds string management overhead | English only for MVP |
| Notification toasts for every background event | If Feed is polling in background (future cron), constant toasts during a demo are distracting | Toasts only for explicit user-triggered actions (poll, retry, copy) |
| Complex feed configuration editor | Feed configuration is an account-level VTEX setting; editing it from this app adds complexity and risk | Link to VTEX admin for feed config; basic config panel only |
| Retry queue / exponential backoff visible in UI | Retry queues are an implementation detail; showing queue depth during a demo confuses non-technical buyers | Manual retry button is sufficient; no queue visualization |
| Performance metrics / throughput charts | This is a single-account demo tool; throughput charts imply scale claims the demo can't support | Processing timeline with step durations is sufficient |
| Export to CSV / Excel | Not relevant to the integration story; adds surface area for a v0 feature | Copy payload buttons cover the technical export need |
| Audit trail with user attribution | No users, no sessions, no auth — audit trail is meaningless | Processing timeline per order is the audit equivalent |

### VTEX-Specific Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Showing the full VTEX App Token in the UI | Security risk even in demo environments; trains bad habits | Mask after save; never display; use server-side env vars |
| Allowing Start Handling to be called without ERP acceptance | Misrepresents the mandatory VTEX integration contract | Guard in server logic, not just UI — the integration rule must be enforced in the API route |
| Skipping the ERP normalization step in the happy path display | The normalization step is why the integration exists; skipping it in the UI makes the demo miss its point | Always show ERP payload tab in accordion, always show normalization step in timeline |
| Combining vtexStatus and erpStatus into one column | These are different concepts (VTEX's view vs ERP's view) — merging them confuses the VTEX OMS status change story | Keep as separate columns/fields throughout |
| Auto-calling Start Handling on page load or on every poll even if already handled | Would cause duplicate Start Handling calls and VTEX API errors | Idempotency guard: only call if NOT already in SUCCESS state |

---

## Feature Complexity Notes

Estimates assume Next.js + Tailwind + in-memory store baseline already in place.

| Feature Category | Complexity | Primary Reason |
|-----------------|------------|----------------|
| Orders inbox table with columns | Low | Static table layout, in-memory data |
| Client-side filter + search | Low | Array.filter on in-memory store |
| Client-side sort | Low | Array.sort on in-memory store |
| Status + source badge styling | Low | Tailwind variants per status value |
| Accordion with 8 sections | Medium | Tab/section navigation within accordion; JSON viewers |
| Pretty JSON viewer (ERP + Raw VTEX payload) | Low-Medium | react-json-view or simple pre/code block with syntax highlight |
| Processing timeline with step badges | Medium | Ordered list component; step-duration calculation |
| Technical event log view | Low-Medium | Secondary list view; filter by orderId/type |
| Configuration panel | Low | Form with localStorage or env var fallback |
| PII masking (email, document, address) | Low | String transform in normalizer; applied at ingestion |
| Start Handling retry button | Low | Single API call; status update in store |
| Reprocess order button | Low | Re-runs pipeline for existing orderId |
| Copy payload to clipboard | Low | navigator.clipboard.writeText + toast |
| Mark as resolved | Low | Status update in store |
| Demo instructions panel | Low | Static content; collapsible |
| Clear all / reset demo | Low | In-memory store.clear() + confirm dialog |
| Order count summary bar | Low | Computed from store in one pass |
| Relative timestamps | Low | date-fns formatRelative |
| Hook endpoint URL display with copy | Low | Read from NEXT_PUBLIC_APP_URL env var |
| Poll Feed Now button with last-poll display | Low | Button + API call + timestamp state |

---

## Dependencies Between Features

```
VTEX Configuration (account, key, token, mode)
  └── All API calls (Get Order, Start Handling, Feed poll)
      └── Feed Poll / Hook Receiver
          └── Event deduplication
              └── VTEX Get Order call
                  └── ERP Normalizer
                      └── ERP Simulator (success/failure mode)
                          └── Start Handling call
                              └── ErpOrderRecord created/updated in store
                                  └── Orders Inbox list (reads store)
                                      └── Accordion detail (reads same record)
                                          └── Processing Timeline (reads record.timeline)
                                          └── Action buttons (write back to store via API)
                                          └── JSON viewers (read record.erpPayload, record.vtexOrderRaw)

Simulate ERP Failure toggle
  └── ERP Simulator (controls return value)
      └── Start Handling call (only fires if ERP returns SUCCESS)

PII Masking
  └── ERP Normalizer (applied at normalization time, before storage)
      └── Orders Inbox columns (customerEmailMasked already masked in record)
      └── Accordion ERP Summary (reads masked fields from record)
      └── Accordion Shipping Details (masked address applied at normalization)

Technical Event Log
  └── Feeds from same pipeline events (parallel to ErpOrderRecord.timeline)
  └── Includes duplicate events that don't create order records

Demo Instructions Panel
  └── No dependencies — static content
  └── Reads current integration mode to show mode-specific instructions
```

### Strict Ordering Constraints

1. Configuration must exist before any VTEX API call is possible. The UI must block polling/hook processing with a clear "configure credentials first" message.
2. ERP normalization must happen before ERP simulation — the normalizer produces the input the simulator receives.
3. Start Handling must only fire after ERP simulation returns SUCCESS — this is a VTEX integration contract, not a UI choice.
4. PII masking must happen at normalization time (server-side), not at render time (client-side) — masking in the UI only would leave raw PII in the stored record.
5. Feed commit (if auto-commit enabled) should happen after Start Handling resolves — committing before Start Handling success means losing the event if Start Handling fails.

### Feature Pairs That Must Ship Together

| Feature A | Feature B | Reason |
|-----------|-----------|--------|
| ERP Normalized Payload (JSON viewer) | Raw VTEX Payload (JSON viewer) | Together they show the before/after of normalization — showing only one loses the demo narrative |
| Simulate ERP Failure toggle | Accordion timeline showing ERP_ERROR step | The failure toggle is meaningless if the timeline doesn't show what failed |
| Start Handling column in inbox | Start Handling section in accordion timeline | Inbox column shows status; timeline shows why — both needed for the demo story |
| Feed source badge on row | FEED filter in inbox | Source badge labels the row; filter lets the operator isolate Feed orders |
| Hook endpoint URL display | Copy button | A URL without a copy button causes typos during live demos in front of customers |
| Retry Start Handling button | Start Handling ERROR status visible | The retry button only makes sense if the error state is clearly visible |

---

## Notes on Demo-Friendliness Patterns

These are cross-cutting concerns that apply across all features, not a feature list on their own.

**Operator control over pacing.** The single most important demo UX principle: the demo operator, not the system, should cause visible changes. Avoid any background automation that triggers UI changes mid-sentence. Manual Poll Feed Now + Manual retry + Manual reprocess = the operator always initiates the story beat.

**Every integration step must be visible.** The audience can't trust what they can't see. If the Get Order call happened but there's no timeline entry, the demo is weaker. Every pipeline step must produce a timeline entry, including the boring ones (normalization, feed commit).

**Failure as a feature.** The ability to show the failure path (ERP failure toggle) and then recover from it (Retry Start Handling, Reprocess) is more persuasive than showing only the happy path. The error handling IS part of the demo, not a problem to hide.

**Collapse complexity by default.** Raw VTEX payload must be collapsed by default in the accordion. The audience is not always technical; show the ERP Summary first, show raw data on demand. This applies to JSON viewers generally — collapsed by default, expandable.

**Reduce setup friction.** Any credential error during live demo setup destroys momentum. The configuration panel must give clear, specific error messages ("App Key not set — configure credentials first") not generic HTTP errors.

**PII masking as a story beat.** Do not hide that masking is happening — surface it. The masked email `a****@domain.com` should be visually distinct from a missing value. This is a security story the audience should hear: "we mask PII even in the integration middleware."
