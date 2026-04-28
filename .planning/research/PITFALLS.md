# Pitfalls Research: VTEX OMS ERP Demo Console

**Domain:** VTEX OMS ERP integration / Next.js Vercel demo app
**Researched:** 2026-04-28
**Confidence:** HIGH (VTEX API behavior from official docs patterns + known Vercel serverless constraints)

---

## Critical Pitfalls (Must Address)

These will break the demo or corrupt integration state if not addressed.

---

### C1: Committing Feed Handles Before Processing Completes

**What goes wrong:** The feed handle commit (`commitFeedItems`) is called immediately after retrieving feed items, before Get Order, ERP acceptance, or Start Handling finish. If any downstream step fails, the event is permanently lost from the feed queue. VTEX will never re-deliver it.

**Why it happens:** Developers conflate "received the event" with "processed the event." The commit is the acknowledgment signal to VTEX that the item can be removed from the queue.

**Consequences:** Silent order loss. The order never appears in the ERP inbox. No retry is possible from the feed. The only recovery is to re-trigger the order state change in VTEX admin, which is not always possible in a demo session.

**Warning signs:**
- Feed polling returns items but orders appear in the inbox only intermittently
- Retrying the poll returns an empty feed even though orders were not fully processed
- Timeline shows "Event received" but no subsequent steps

**Prevention:** Commit feed handles only after the full pipeline succeeds (Get Order → ERP accept → Start Handling). If auto-commit is off, never commit. If auto-commit is on, commit only on success. On failure, leave the handle uncommitted so the next poll re-delivers it. Structure the commit as the final step in the pipeline, after all writes to the in-memory store.

**Phase:** Feed polling implementation (phase implementing `POST /api/vtex/feed/poll`)

---

### C2: Calling Start Handling Without Confirming ERP Acceptance First

**What goes wrong:** Start Handling is called regardless of ERP simulation result, or is called concurrently with the ERP simulation rather than sequentially after it. VTEX OMS records the order as "handling started" even though the ERP rejected it. The order state in VTEX is now inconsistent with what the demo app shows.

**Why it happens:** Async/await mistakes — `Promise.all([erpSimulate(), startHandling()])` instead of sequential execution. Or a missing guard on ERP result before calling start handling.

**Consequences:** VTEX order moves to handling state permanently. Cannot be undone without VTEX admin intervention. The demo shows "ERP FAILED" in the inbox but the VTEX order is stuck in handling — which confuses the viewer.

**Warning signs:**
- Start Handling status shows SUCCESS even when ERP simulation is set to fail
- VTEX admin shows order in "Handling" state after a failed ERP simulation in the demo

**Prevention:** Enforce strict sequential execution with explicit guards:
```typescript
const erpResult = await simulateErp(order);
if (erpResult.status !== 'SUCCESS') {
  // do NOT call startHandling here
  return { erpStatus: 'ERP_REJECTED', startHandlingStatus: 'NOT_STARTED' };
}
const shResult = await startHandling(orderId);
```
Add unit tests that verify Start Handling is never called when ERP fails.

**Phase:** ERP simulator + Start Handling endpoint (core pipeline phase)

---

### C3: Calling Start Handling Twice on the Same Order

**What goes wrong:** A second poll or hook delivery triggers reprocessing of an order that already reached START_HANDLING_SUCCESS. The app calls Start Handling again. VTEX returns a 4xx error (order already in handling) and the demo breaks mid-session.

**Why it happens:** Deduplication only checks for duplicate feed events by eventId/orderId+state, but does not check the existing ERP record's `startHandlingStatus` before retrying the full pipeline.

**Consequences:** VTEX returns a conflict error. The timeline shows a spurious START_HANDLING_ERROR after a previous SUCCESS. Demo viewer is confused about the order's true state.

**Warning signs:**
- Timeline for an order shows both START_HANDLING_SUCCESS and START_HANDLING_ERROR
- VTEX returns 409 or 400 on Start Handling call

**Prevention:** Before calling Start Handling, always check the existing record:
```typescript
const existing = store.getOrder(orderId);
if (existing?.startHandlingStatus === 'SUCCESS') {
  // skip — already handled, do not call again
  return existing;
}
```
This guard belongs in both the automatic pipeline and the manual retry endpoint. The manual retry should only be available when `startHandlingStatus` is NOT 'SUCCESS'.

**Phase:** In-memory store + Start Handling guard (core pipeline phase)

---

### C4: In-Memory Store Lost on Every Serverless Cold Start

**What goes wrong:** Vercel deploys Next.js API routes as separate serverless function instances. Each instance has its own memory. When a function instance is recycled (cold start, scale-out, re-deployment), all in-memory orders vanish. During a demo, a page refresh or a second poll can hit a different function instance with an empty store.

**Why it happens:** Module-level singletons (`let store = []`) work during local `next dev` because there is one persistent process. On Vercel, there is no guarantee that successive requests hit the same instance.

**Consequences:** Orders visible in the inbox disappear on page refresh. A poll on one instance shows results; the UI hitting another instance shows an empty list. Demo falls apart in front of a customer.

**Warning signs:**
- Orders visible after one poll disappear on next page refresh in production (Vercel)
- Logs show "store is empty" on GET /api/erp/orders despite a previous successful poll
- Works perfectly in `next dev` but breaks on deployed Vercel URL

**Prevention (for MVP demo):**
1. Document the limitation explicitly in the README and demo script.
2. Use Vercel's free-tier KV or a module-level Map that is initialized once and document its behavior.
3. Accept the limitation for MVP — in-memory is explicitly chosen — but tell the demo operator "all demo state lives in one browser session, reload carefully."
4. Add a prominent UI warning: "IN-MEMORY MODE — State resets on cold start."
5. Consider using a single `globalThis`-attached store to slightly improve instance cache persistence (not guaranteed but helps in Vercel's warm instance window).

For production path: structure the store behind an interface so Vercel KV or Upstash Redis can replace it without changing any pipeline code.

**Phase:** In-memory store design (earliest infrastructure phase)

---

### C5: VTEX Feed Lock — Only One Consumer at a Time

**What goes wrong:** VTEX Feed enforces a single concurrent consumer. If two poll requests arrive simultaneously (user double-clicks "Poll Feed Now", or a previous poll is still in flight), VTEX returns a lock error (typically 403 or a feed-specific error payload). The second request either throws an unhandled error or silently returns empty.

**Why it happens:** No concurrency guard on the poll endpoint. VTEX Feed is designed for a single long-running consumer process, not for ad-hoc HTTP triggers.

**Consequences:** Error visible to the demo viewer at an inopportune moment. May leave the feed in a partially committed state if the lock error arrives mid-process.

**Warning signs:**
- VTEX returns `{"error": "Feed locked by another consumer"}` or similar on the second poll
- Double-clicking "Poll Feed Now" shows an error in the event log

**Prevention:**
1. Disable the "Poll Feed Now" button in the UI while a poll is in flight (show a spinner, disable the button).
2. Use a server-side in-progress flag (`let pollInProgress = false`) with a timeout guard so the lock releases even if the request crashes.
3. Handle the VTEX feed lock response gracefully: surface it as an info message ("Feed already being polled, try again in a moment") rather than an error.

**Phase:** Feed polling + UI (feed phase)

---

### C6: Missing orderId Extraction from Hook Payload — Silent Drop

**What goes wrong:** The VTEX Hook payload shape is not a guaranteed stable contract. VTEX has delivered hook payloads where `orderId` is at `body.orderId`, at the root level, nested under `order.orderId`, or under `data.orderId` depending on the hook type and version. If the extraction code only checks one path and the payload arrives in a different shape, `orderId` is undefined. The app either throws or silently stores a record with no orderId.

**Why it happens:** VTEX Hook documentation shows one payload shape, but VTEX may send different shapes for different event types (order status change, invoice, delivery, etc.). Developers test with one payload and assume it covers all cases.

**Consequences:** Hook receives the event (returns 200), but no order appears in the inbox. The demo shows the hook endpoint working, but the inbox stays empty. Silent failure.

**Warning signs:**
- Hook event log shows "received" but inbox shows nothing
- orderId field in the stored record is `undefined` or empty string
- TypeScript `as any` cast hides the undefined at runtime

**Prevention:**
```typescript
function extractOrderId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  return (
    (typeof b['orderId'] === 'string' ? b['orderId'] : null) ||
    (typeof b['OrderId'] === 'string' ? b['OrderId'] : null) ||
    (b['order'] && typeof (b['order'] as any)['orderId'] === 'string'
      ? (b['order'] as any)['orderId']
      : null) ||
    null
  );
}
```
Log the full raw payload to the event log whenever extraction fails, so the demo operator can see exactly what VTEX sent.

**Phase:** Hook endpoint implementation

---

### C7: PII Exposure via Raw Payload in UI

**What goes wrong:** The "Raw VTEX Order Payload" accordion section displays the full VTEX order JSON without any masking. A VTEX sandbox or production account contains real customer emails, CPF (Brazilian tax ID), phone numbers, and full shipping addresses. Demo sessions recorded on screen or conducted in front of multiple people expose real PII.

**Why it happens:** Masking is applied to the ERP normalized payload fields but the raw payload viewer is treated as a "debug" view and left unmasked "for completeness."

**Consequences:** Regulatory exposure (LGPD for Brazilian accounts, GDPR for EU accounts). Risk of recording real customer data in screenshots or screen recordings shared externally.

**Warning signs:**
- Raw VTEX payload viewer shows full email addresses, CPF numbers, phone numbers
- No masking on `clientProfileData.email`, `clientProfileData.document`, `shippingData.address`

**Prevention:**
1. Apply PII masking to the raw payload before storing it in `vtexOrderRaw` — mask at ingestion time, not at display time. This prevents any downstream leak.
2. Mask: email → `jo***@***.com`, document → `***.***.***-**`, phone → `(**) *****-****`, address street → first 4 chars + `***`.
3. Document the masking clearly in SECURITY.md: "Raw payload stored in-memory is already masked."
4. Add a test: raw payload stored after normalization must not contain unmasked email or document values.

**Phase:** ERP normalization + PII masking (early pipeline phase)

---

### C8: VTEX 429 Rate Limiting During Feed Poll Causing Partial Processing

**What goes wrong:** A feed poll retrieves 10+ events. For each event, the app calls Get Order. If requests are issued in tight parallel (`Promise.all`), VTEX returns 429 on requests beyond the rate limit threshold. Some orders process successfully, others fail with 429. The feed handles for the successful orders get committed; the handles for the failed ones do not. On the next poll, only the uncommitted handles are returned — which is correct — but the app now tries to process them again. If rate limiting is not handled with backoff, the loop continues.

**Why it happens:** `Promise.all(events.map(e => processOrder(e)))` with no concurrency limit.

**Consequences:** Some orders stuck in ERROR state. Repeated failed polls during a demo session. If "auto commit" is on and the commit happens before Get Order, those events are lost.

**Warning signs:**
- Event log shows mix of SUCCESS and 429 errors on the same poll
- Orders with 429 keep reappearing on subsequent polls
- Timeline shows "Get Order: 429 Too Many Requests"

**Prevention:**
1. Process feed events sequentially, not in parallel, for the demo: `for (const event of events) { await processEvent(event); }`. For MVP demo with small event counts this is acceptable.
2. Detect 429 responses explicitly and surface them as a distinct status (not generic ERROR).
3. Add a small delay between Get Order calls if processing multiple events: `await delay(200)`.
4. Do NOT call `Promise.all` for VTEX API calls across multiple orders in this demo context.

**Phase:** Feed polling implementation

---

## Significant Pitfalls (Should Address)

These degrade demo quality or reliability without fully breaking it.

---

### S1: VTEX Feed Returns Empty Array — Not an Error

**What goes wrong:** VTEX Feed returns `{"events": []}` or an empty array when there are no pending events. The app treats this as an error condition, shows a red error in the event log, and the demo operator has to explain "that's actually fine, there are just no new orders."

**Why it happens:** Response parsing throws when array is empty, or the UI shows an error banner for any non-content response.

**Warning signs:**
- Event log shows "ERROR: No events found" when the feed is legitimately empty
- Demo viewer sees red status indicators during idle periods

**Prevention:**
- Treat empty feed response as a success with an info message: "Feed polled — 0 new events."
- Distinguish INFO (empty poll), WARNING (partial failure), and ERROR (API unreachable) in the event log.
- The "Poll Feed Now" button should show a green checkmark with "0 events" on empty, not a red error.

**Phase:** Feed polling + event log UI

---

### S2: VTEX App Token Leaked via Client-Side Rendering or API Route Response

**What goes wrong:** The configuration panel allows entering VTEX App Key and App Token. If the token is stored in React state and the config endpoint returns the full config object (including the token) for display, it gets included in the HTTP response body and logged in browser DevTools. If Next.js renders the config server-side and passes it as props, the token appears in `__NEXT_DATA__` in the page source.

**Why it happens:** Convenience — returning the full config object to display what was saved, without stripping sensitive fields.

**Warning signs:**
- `window.__NEXT_DATA__` in browser console contains `appToken`
- Network tab shows config API response with token visible
- Token appears in React state in React DevTools

**Prevention:**
1. The config API GET response must never include the token. Return `{ appToken: "***configured***" }` if set, `null` if not.
2. The config API POST/PUT accepts the token for saving but the response only confirms `{ saved: true }`.
3. Store the token only in server-side env vars or in-memory server state (not accessible from client routes).
4. Add a test: GET /api/config response must not contain the literal token value.

**Phase:** Configuration panel + API (infrastructure phase)

---

### S3: Hook Endpoint Returns 200 Before Background Processing — But Crashes Mid-Pipeline

**What goes wrong:** The hook endpoint returns 200 immediately (correct — VTEX requires a fast response). But the background pipeline (Get Order → ERP → Start Handling) is not awaited within the request handler. If the Next.js serverless function instance is recycled after the 200 response is sent, the background work is killed mid-execution. The order never reaches START_HANDLING_SUCCESS.

**Why it happens:** Treating Next.js API routes like a Node.js server where you can `res.end()` and continue running. Vercel terminates the function after the response completes.

**Warning signs:**
- Hook event log shows "received" but timeline for that order stops at "Get Order requested" with no further steps
- Happens intermittently, not consistently (depends on whether Vercel recycles the instance)

**Prevention:** In Next.js API routes on Vercel, the function stays alive until the response is sent. The correct pattern is: await the full pipeline, then return 200. Do NOT use fire-and-forget. Since VTEX tolerates a few seconds of response time on hook delivery, await the pipeline fully:

```typescript
export async function POST(req: Request) {
  const body = await req.json();
  const result = await processHookEvent(body); // full pipeline, awaited
  return Response.json({ received: true, orderId: result.orderId });
}
```

If the pipeline takes too long and Vercel's 10s limit is a concern, document this as a known limitation and recommend moving to a queue-based approach in production.

**Phase:** Hook endpoint implementation

---

### S4: TypeScript `unknown` on VTEX API Responses — Runtime Crashes on Missing Fields

**What goes wrong:** The VTEX Get Order response is typed as `unknown` (correct) but then accessed with unsafe property access: `(order as any).clientProfileData.email`. If VTEX returns an order where `clientProfileData` is null (which happens with marketplace orders, B2B orders, or partial order states), the app throws `Cannot read properties of null` and the order record gets stuck with no useful error message.

**Why it happens:** Optional chaining (`?.`) is not used consistently. The developer tests with one normal B2C order and assumes all fields are always present.

**Warning signs:**
- App crashes with `TypeError: Cannot read properties of null` in the normalization step
- Only happens with certain order types (B2B, marketplace, click-collect)
- TypeScript compiles fine but runtime explodes

**Prevention:**
1. Use optional chaining everywhere in the normalizer: `order?.clientProfileData?.email ?? ''`
2. Type the VTEX order response with all optional fields: every field on `VtexOrder` should be `?: T` unless the VTEX API spec explicitly guarantees it is always present.
3. Wrap the entire normalization in a try/catch that captures the raw payload alongside the error so the demo operator can inspect what came in.
4. Add tests for partial orders: normalizer should return a valid (partial) ERP payload even when most VTEX fields are absent.

**Phase:** VTEX client + ERP normalizer (core pipeline phase)

---

### S5: Deduplication Key Too Narrow — Missing Legitimate Re-Deliveries

**What goes wrong:** Deduplication uses `orderId` as the sole key. VTEX legitimately re-delivers feed events for the same orderId when the order changes state (e.g., first delivery is `payment-approved`, second delivery is `ready-for-handling`). Deduplicating on orderId alone causes the `ready-for-handling` event — the one that should trigger Start Handling — to be silently dropped as a duplicate.

**Why it happens:** Oversimplified deduplication. "Same orderId = duplicate" is wrong for VTEX Feed where an order progresses through multiple states each generating a new event.

**Warning signs:**
- Orders received via Feed from `payment-approved` state are deduplicated
- A later `ready-for-handling` event for the same order is ignored
- Start Handling is never called for orders that arrived in an earlier state

**Prevention:**
- Deduplicate on `eventId` (VTEX provides a unique ID per feed event) when present.
- Fall back to `orderId + state` composite key when eventId is absent.
- Do NOT deduplicate on `orderId` alone.
- The `DUPLICATE_IGNORED` status should only be set when `orderId + state` was already processed, not just orderId.
- Keep a per-order state history so the same state for the same order is the actual dedup unit.

**Phase:** In-memory store + deduplication logic

---

### S6: VTEX 401/403 Errors — Indistinguishable from Configuration Problems

**What goes wrong:** A 401 or 403 from VTEX can mean: wrong app key, wrong app token, key lacks the necessary policy, key is for the wrong account, or the account name in the URL is wrong. All four surface as the same HTTP status. The app shows "Authentication error" but the demo operator cannot tell which of the four is the cause.

**Why it happens:** Error handling distinguishes between status codes but not between root causes within the same status code.

**Warning signs:**
- All VTEX API calls fail with 401 after configuration change
- No additional diagnostic information in the error message
- Demo operator has to guess whether the account name or the credentials are wrong

**Prevention:**
1. When a 401/403 occurs, log the full VTEX error response body (which often contains a message field) to the event log.
2. Surface a diagnostic hint: "Check that the App Key matches the VTEX account name and has the OMS read/write policy."
3. Add a "Test Connection" button in the config panel that calls a simple VTEX endpoint (e.g., Get Feed Configuration) and shows a clear pass/fail with the raw error if it fails.
4. Common VTEX auth error patterns to detect: `{"error": "Forbidden"}` (key exists, wrong permissions), `{"error": "Unauthorized"}` (key doesn't exist or token mismatch).

**Phase:** VTEX client + configuration panel

---

### S7: Feed Configuration Not Set — Cryptic Error on First Poll

**What goes wrong:** VTEX Feed requires a feed configuration to be set before items can be retrieved. A fresh VTEX account has no feed configuration. Calling "Poll Feed Now" without first configuring the feed returns a VTEX error that looks like an API failure. The demo operator sees an error and does not know they need to set up the feed first.

**Why it happens:** The demo skips the feed setup step, assuming it was done in VTEX admin beforehand.

**Warning signs:**
- First "Poll Feed Now" always returns an error
- VTEX returns 400 with "Feed not configured" or similar message
- Demo operator is confused because credentials look correct

**Prevention:**
1. Document the VTEX Feed setup steps prominently in VTEX_SETUP.md and in the UI's demo instructions panel.
2. On a feed poll error that matches a "not configured" pattern, surface a specific message: "VTEX Feed is not configured for this account. See Setup Guide."
3. Optionally implement `GET /api/vtex/feed/config` to check feed configuration status and show it in the UI before the first poll.

**Phase:** Feed polling + documentation phase

---

### S8: Hook URL Not Configured in VTEX — Events Never Arrive

**What goes wrong:** The demo uses Hook mode. The user clicks around the UI expecting orders to arrive, but nothing happens. The Hook endpoint is correctly implemented, but the VTEX account was never configured to send Hook notifications to the demo app's URL.

**Why it happens:** The Hook configuration step (calling VTEX Hook API to register the endpoint) is a one-time setup that happens outside the app. Demo operators forget to do it or don't know they need to.

**Warning signs:**
- Hook event log is completely empty despite orders being placed in VTEX
- No incoming requests to `/api/vtex/hook` in Vercel function logs

**Prevention:**
1. Show the hook URL prominently in the UI: `https://[your-app].vercel.app/api/vtex/hook`
2. Include the exact VTEX API call to register the hook in VTEX_SETUP.md with a working curl example.
3. Add a "Hook Setup Status" indicator in the UI that shows whether VTEX has been configured (even if only as a manual checklist item).
4. Consider adding a "Send Test Hook" button that sends a synthetic payload to the local hook endpoint to verify the pipeline works independently of VTEX hook configuration.

**Phase:** Hook endpoint + documentation phase

---

### S9: VTEX Environment Mismatch — `vtexcommercestable` vs `myvtex.com`

**What goes wrong:** The app defaults to `vtexcommercestable.com.br` as the environment. Some VTEX accounts are on `myvtex.com` (newer infrastructure). Using the wrong domain causes all API calls to fail with 404 or connection errors, but the error message doesn't point to the domain as the cause.

**Why it happens:** The environment field in configuration is treated as freeform text. Operators enter the wrong domain or use the old format for a new account.

**Warning signs:**
- All API calls fail with "ENOTFOUND" or 404 despite correct credentials
- The configured account exists but requests go to the wrong host

**Prevention:**
1. Document both environment formats in the config panel tooltip: `{account}.vtexcommercestable.com.br` vs `{account}.myvtex.com`
2. Add a dropdown with common VTEX environments (stable, beta, myvtex) rather than a freeform field.
3. Validate that the environment field looks like a valid hostname before saving.
4. The "Test Connection" button (from S6) also validates the constructed URL.

**Phase:** Configuration panel

---

## Minor Pitfalls (Nice to Address)

These cause friction or confusion but do not break the demo.

---

### M1: Demo Overwhelm — Too Much Information Visible at Once

**What goes wrong:** The accordion order detail has 8 sections, all expanded by default. The timeline shows 10+ steps. The raw VTEX payload section contains 200+ lines of JSON. During a demo, the viewer's attention scatters across too much data and the integration story is lost.

**Warning signs:** Demo viewers ask "what am I looking at?" or focus on raw JSON rather than the integration flow.

**Prevention:**
1. Collapse the Raw VTEX Payload section by default (already specified in claude.md — enforce this).
2. Show the Processing Timeline as the hero section of the accordion, not buried at the bottom.
3. Consider a "Demo Mode" toggle that hides the technical sections (raw payload, event log) and shows only the business-facing sections (summary, items, payment, timeline).
4. The event log should be a secondary/debug tab, not visible on the primary dashboard.

**Phase:** UI implementation

---

### M2: Accordion Actions Are Too Powerful for a Casual Viewer

**What goes wrong:** "Reprocess order," "Retry Get Order," "Simulate ERP failure" buttons are visible in the accordion during a demo. A viewer accidentally clicks one and the demo state changes unexpectedly (an order re-enters PROCESSING state mid-demo).

**Warning signs:** Demo operator nervously hovers near the keyboard to undo accidental clicks during demos.

**Prevention:**
1. Add a confirmation dialog for destructive actions (reprocess, simulate failure).
2. Group "advanced" actions (reprocess, retry) behind a collapsible "Advanced Actions" section.
3. Disable "Reprocess" if the order is currently PROCESSING.

**Phase:** UI implementation

---

### M3: Serverless Function Timeout on Large Feed Polls

**What goes wrong:** A feed poll retrieves 50 events. Processing each sequentially takes 2–5 seconds each (Get Order → ERP → Start Handling). Total time exceeds Vercel's 10-second default function timeout (or 60s on Pro plans). The request times out, returns 504, and the in-flight state is unknown.

**Warning signs:**
- `POST /api/vtex/feed/poll` returns 504 on large event batches
- Some orders appear in the inbox (processed before timeout), others are missing
- Feed handles are partially committed

**Prevention:**
1. Cap the number of events processed per poll to a configurable maximum (default: 5 for demo).
2. Document this limit in the UI: "Poll Feed Now (max 5 events per poll)."
3. Return a partial result response if the timeout is approaching (set a timer and stop processing after 8 seconds).
4. For MVP, the manual poll button is acceptable — document the batch size limit clearly.

**Phase:** Feed polling implementation

---

### M4: VTEX Feed eventId Field Name Inconsistency

**What goes wrong:** VTEX Feed event items use `handle` (not `eventId`) as the identifier for committing. The event object may have an `id` or `eventId` field for deduplication, but the commit API requires `handle`. Mixing these up causes either failed commits (passing the wrong field to the commit call) or incorrect deduplication (using the handle as the dedup key when it changes between deliveries).

**Warning signs:**
- Feed commit calls fail with "invalid handle" errors
- Duplicate events appear in the inbox despite deduplication code existing
- TypeScript shows `handle` as undefined when accessing the wrong field

**Prevention:**
1. Define a typed `FeedEvent` interface with both `handle: string` (for commit) and optional `eventId`/`id` (for deduplication) as distinct fields.
2. Never use `handle` as the deduplication key — handles can change.
3. Always pass `handle` (not `id`) to `commitFeedItems`.

**Phase:** VTEX client + Feed polling

---

### M5: TypeScript Strict Mode Disabled — Masking Integration Type Errors

**What goes wrong:** The project is created with `strict: false` in tsconfig. VTEX API response types use `any` casts throughout. Type errors that would catch missing field access, incorrect payload shapes, and undefined orderId values are silently accepted by the compiler.

**Warning signs:**
- `tsconfig.json` has `"strict": false`
- VTEX client types use `any` or `unknown` without narrowing
- No TypeScript errors on `order.clientProfileData.email` even when `clientProfileData` could be null

**Prevention:**
1. Enable `strict: true` in tsconfig from project creation.
2. Type all VTEX API responses with proper optional fields (`?:`) rather than `any`.
3. Use Zod or type guards for Hook payload parsing rather than type assertions.

**Phase:** Project scaffolding (day one)

---

### M6: Missing Content-Type Header on VTEX API Calls

**What goes wrong:** VTEX API calls that include a JSON body (Start Handling, Feed commit) are sent without `Content-Type: application/json`. VTEX returns 400 or 415. This is especially easy to miss on Start Handling since it may have an empty body or a minimal body.

**Warning signs:**
- Start Handling returns 400 or 415 despite correct credentials and orderId
- Feed commit returns 400

**Prevention:**
Always set both headers on every outbound VTEX call, even when the body is empty or `{}`:
```typescript
headers: {
  'X-VTEX-API-AppKey': appKey,
  'X-VTEX-API-AppToken': appToken,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}
```
Centralize this in the VTEX client so it cannot be forgotten per-endpoint.

**Phase:** VTEX client implementation

---

### M7: PII Masking Applied Only in Normalizer, Not in Event Log

**What goes wrong:** The ERP normalizer correctly masks email and document before storing `erpPayload`. But the technical event log stores raw incoming payloads from the hook (for debugging). The raw hook body contains unmasked customer data. During a demo where the event log is shown as a "see what arrived" feature, PII is visible.

**Warning signs:**
- Event log "raw payload" section shows unmasked customer email or CPF
- ERP inbox shows masked data but event log shows real data

**Prevention:**
1. Apply PII masking at the point of storage for ALL stored payloads, including event log entries.
2. Create a single `maskOrderPayload(payload: unknown): unknown` utility that deep-clones and masks known PII fields.
3. This utility is used in the normalizer AND in the hook/feed event log storage.
4. Add a test: event log stored payload must not contain unmasked email.

**Phase:** PII masking utility + event log implementation

---

## Phase-Specific Summary

| Phase | Pitfalls to Address |
|-------|---------------------|
| Project scaffolding | M5 (strict TypeScript) |
| VTEX client module | M6 (headers), S4 (optional chaining), S9 (environment), M4 (field naming) |
| In-memory store | C4 (cold start), C3 (double Start Handling guard), S5 (dedup key) |
| ERP normalizer + PII | C7 (PII in raw payload), M7 (PII in event log) |
| Hook endpoint | C6 (orderId extraction), S3 (background processing), S8 (setup docs) |
| Feed polling | C1 (commit timing), C5 (feed lock), C8 (rate limiting), S1 (empty response), S7 (not configured), M3 (timeout), M4 (handle vs id) |
| Start Handling endpoint | C2 (call without ERP accept), C3 (double call guard) |
| Configuration panel | S2 (token leak), S6 (auth diagnostics), S9 (environment) |
| UI implementation | M1 (overwhelm), M2 (accidental actions), S8 (hook URL display) |
| Documentation | S7 (feed setup), S8 (hook setup), C4 (in-memory warning) |

---

**Confidence notes:**
- VTEX Feed commit-before-process (C1), Feed lock (C5), and Start Handling state machine (C2, C3) are HIGH confidence — these are the most common VTEX OMS integration mistakes documented across partners and community.
- Vercel in-memory state loss (C4) and background processing kill (S3) are HIGH confidence — fundamental Vercel serverless constraints.
- Hook payload shape variations (C6) and VTEX environment mismatch (S9) are MEDIUM-HIGH confidence — observed across VTEX integrations but specifics depend on VTEX API version in use at build time.
- All other pitfalls are MEDIUM confidence — standard patterns for TypeScript + Next.js integrations that apply to this domain.
