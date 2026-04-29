# API Reference — VTEX OMS to ERP Demo Console

All endpoints are Next.js App Router route handlers (`src/app/api/`). All responses are JSON. All routes run on the Node.js runtime.

Base URL (local): `http://localhost:3000`  
Base URL (Vercel): `https://<your-vercel-url>`

---

## Table of Contents

1. [POST /api/vtex/hook](#post-apivtexhook)
2. [POST /api/vtex/feed/poll](#post-apivtexfeedpoll)
3. [POST /api/vtex/orders/[orderId]/start-handling](#post-apivtexordersorderidstart-handling)
4. [GET /api/erp/orders](#get-apierporders)
5. [GET /api/erp/orders/[orderId]](#get-apierpordersorderid)
6. [POST /api/erp/orders/[orderId]/reprocess](#post-apierpordersorderidreprocess)
7. [POST /api/erp/orders/[orderId]/retry-start-handling](#post-apierpordersorderidretry-start-handling)
8. [POST /api/erp/orders/[orderId]/resolve](#post-apierpordersorderidresolve)
9. [GET /api/config](#get-apiconfig)
10. [POST /api/config](#post-apiconfig)
11. [GET /api/erp/events](#get-apierpevents)

---

## POST /api/vtex/hook

Receives a VTEX order event notification. Runs the full processing pipeline synchronously: Get Order → normalize → ERP simulate → Start Handling.

### Request

**Headers:**

| Header | Required | Description |
|---|---|---|
| `Content-Type` | Yes | `application/json` |
| `x-demo-hook-secret` | Conditional | Required if `DEMO_HOOK_SECRET` is configured |

**Body:** VTEX order notification payload. The app accepts multiple payload shapes:

```json
{ "orderId": "1234567890-01", "state": "ready-for-handling" }
```

```json
{ "OrderId": "1234567890-01", "domain": "Marketplace" }
```

```json
{ "order": { "orderId": "1234567890-01" } }
```

```json
{ "data": { "orderId": "1234567890-01" } }
```

The app tries several extraction paths and returns `400` if no `orderId` can be found.

### Success Response

**Status:** `200 OK`

```json
{
  "received": true,
  "orderId": "1234567890-01"
}
```

If credentials are missing, the event is stored but the pipeline does not run:

```json
{
  "received": true,
  "orderId": "1234567890-01",
  "warning": "credentials_missing"
}
```

### Error Responses

| Status | Error | Cause |
|---|---|---|
| `400` | `{"error": "Invalid JSON body"}` | Request body is not valid JSON |
| `400` | `{"error": "Cannot extract orderId from payload"}` | No orderId found in any expected payload path |
| `403` | `{"error": "Forbidden"}` | `x-demo-hook-secret` header missing or incorrect |

---

## POST /api/vtex/feed/poll

Retrieves pending events from the VTEX Feed queue and processes each one. Processes up to 5 events per invocation (`FEED_POLL_MAX_EVENTS`). A module-level lock prevents concurrent poll invocations on the same server instance.

### Request

**Body:** None required. No query parameters.

### Success Response

**Status:** `200 OK`

```json
{
  "processed": 3,
  "duplicates": 1,
  "errors": 0,
  "total": 4
}
```

| Field | Description |
|---|---|
| `processed` | Number of events that completed the pipeline (including partial failures) |
| `duplicates` | Number of events ignored due to deduplication |
| `errors` | Number of events where `processOrder` threw an unexpected exception |
| `total` | Total feed items returned by VTEX Feed API |

If the feed queue is empty:

```json
{
  "processed": 0,
  "duplicates": 0,
  "errors": 0,
  "total": 0
}
```

### Error Responses

| Status | Error | Cause |
|---|---|---|
| `401` | `{"error": "VTEX credentials not configured", "missing": ["account", "appToken"]}` | One or more required credentials are missing |
| `409` | `{"error": "Feed poll already in progress", "code": "POLL_LOCKED"}` | Another poll is in progress on this server instance |
| `502` | `{"error": "Failed to retrieve feed items", "message": "..."}` | VTEX Feed API call failed |

---

## POST /api/vtex/orders/[orderId]/start-handling

Manually triggers VTEX Start Handling for a specific order. This is used for the "Retry Start Handling" action in the UI. It does NOT re-run the full pipeline — it only calls the VTEX Start Handling API.

### Request

**Path parameter:** `orderId` — the VTEX orderId

**Body:** None required.

### Success Response

**Status:** `200 OK`

```json
{
  "ok": true,
  "orderId": "1234567890-01"
}
```

### Error Responses

| Status | Error | Cause |
|---|---|---|
| `401` | `{"error": "VTEX credentials not configured", "missing": [...]}` | Missing credentials |
| `404` | `{"error": "Order not found in ERP store"}` | orderId not in the in-memory store |
| `502` | `{"error": "Start Handling failed", "message": "..."}` | VTEX API call failed |

---

## GET /api/erp/orders

Returns all orders in the ERP Orders Inbox, sorted newest-first by default. Supports filtering, searching, and sorting via query parameters.

### Query Parameters

| Parameter | Values | Description |
|---|---|---|
| `source` | `FEED`, `HOOK`, `ALL` (default) | Filter by integration source |
| `status` | Any `ErpStatus` value, or `ALL` (default) | Filter by ERP processing status |
| `search` | Free text | Search across orderId, sequence, customerName, SKU names |
| `sort` | `receivedAt_desc` (default), `receivedAt_asc` | Sort order |

**ErpStatus values:** `RECEIVED`, `PROCESSING`, `ERP_ACCEPTED`, `START_HANDLING_SUCCESS`, `START_HANDLING_ERROR`, `ERROR`, `DUPLICATE_IGNORED`, `MANUALLY_RESOLVED`

### Example Request

```
GET /api/erp/orders?source=FEED&status=START_HANDLING_SUCCESS&search=1234
```

### Success Response

**Status:** `200 OK`

```json
{
  "orders": [
    {
      "id": "1234567890-01",
      "orderId": "1234567890-01",
      "sequence": "1001",
      "source": "FEED",
      "vtexStatus": "ready-for-handling",
      "erpStatus": "START_HANDLING_SUCCESS",
      "startHandlingStatus": "SUCCESS",
      "customerName": "John Doe",
      "customerEmailMasked": "j***@example.com",
      "totalValue": 9900,
      "itemCount": 2,
      "paymentSummary": "Visa",
      "shippingSummary": "Normal",
      "receivedAt": "2026-04-29T12:00:00.000Z",
      "lastAttemptAt": "2026-04-29T12:00:05.000Z",
      "attempts": 1,
      "errorMessage": null,
      "timeline": [...]
    }
  ],
  "total": 1
}
```

Note: `vtexOrderRaw` and `erpPayload` are included in the response for the list endpoint. For large lists, consider using the single-order endpoint to retrieve payloads on demand.

---

## GET /api/erp/orders/[orderId]

Returns a single order record by orderId (VTEX orderId, not the app-internal `id`).

### Path Parameter

`orderId` — the VTEX orderId

### Success Response

**Status:** `200 OK`

```json
{
  "order": {
    "id": "1234567890-01",
    "orderId": "1234567890-01",
    "erpPayload": { ... },
    "vtexOrderRaw": { ... },
    "timeline": [
      {
        "timestamp": "2026-04-29T12:00:00.000Z",
        "step": "EVENT_RECEIVED",
        "status": "INFO",
        "message": "Hook event received for orderId: 1234567890-01"
      },
      {
        "timestamp": "2026-04-29T12:00:01.000Z",
        "step": "GET_ORDER_SUCCESS",
        "status": "SUCCESS",
        "message": "Get Order succeeded for orderId: 1234567890-01"
      }
    ]
  }
}
```

### Error Responses

| Status | Error | Cause |
|---|---|---|
| `404` | `{"error": "Order not found"}` | No order with that orderId in the store |

---

## POST /api/erp/orders/[orderId]/reprocess

Re-runs the full pipeline for an existing order. Resets the order's `erpStatus` to `RECEIVED` and `startHandlingStatus` to `NOT_STARTED`, then runs: Get Order → normalize → ERP simulate → Start Handling.

Use this action when an order has `ERROR` status and you want to retry after fixing the underlying issue (e.g., credentials updated, VTEX order state corrected).

### Path Parameter

`orderId` — the VTEX orderId

### Request Body

None required.

### Success Response

**Status:** `200 OK`

```json
{
  "ok": true,
  "orderId": "1234567890-01"
}
```

### Error Responses

| Status | Error | Cause |
|---|---|---|
| `401` | `{"error": "VTEX credentials not configured", "missing": [...]}` | Missing credentials |
| `404` | `{"error": "Order not found"}` | orderId not in the store |

---

## POST /api/erp/orders/[orderId]/retry-start-handling

Retries VTEX Start Handling for an order that has `startHandlingStatus === 'ERROR'` or `startHandlingStatus === 'NOT_STARTED'`. Does NOT re-run Get Order or ERP simulation.

Use this when: the order has ERP_ACCEPTED or START_HANDLING_ERROR status, and you want to try calling Start Handling again without reprocessing the entire pipeline.

### Path Parameter

`orderId` — the VTEX orderId

### Request Body

None required.

### Success Response

**Status:** `200 OK`

```json
{
  "ok": true,
  "orderId": "1234567890-01"
}
```

### Error Responses

| Status | Error | Cause |
|---|---|---|
| `401` | `{"error": "VTEX credentials not configured", "missing": [...]}` | Missing credentials |
| `404` | `{"error": "Order not found"}` | orderId not in the store |
| `409` | `{"error": "Order already successfully handled"}` | `startHandlingStatus === 'SUCCESS'` |

---

## POST /api/erp/orders/[orderId]/resolve

Marks an order as `MANUALLY_RESOLVED`. This is a terminal status — the order will no longer appear in the active queue filters but remains in the inbox.

Use this to dismiss orders that cannot be automatically processed (e.g., cancelled in VTEX before Start Handling, test orders).

### Path Parameter

`orderId` — the VTEX orderId

### Request Body

None required.

### Success Response

**Status:** `200 OK`

```json
{
  "ok": true,
  "orderId": "1234567890-01"
}
```

### Error Responses

| Status | Error | Cause |
|---|---|---|
| `404` | `{"error": "Order not found"}` | orderId not in the store |

---

## GET /api/config

Returns the current public-safe configuration. Never includes the App Token value — only a boolean indicating whether it is configured.

### Success Response

**Status:** `200 OK`

```json
{
  "config": {
    "account": "mystore",
    "environment": "vtexcommercestable.com.br",
    "appKey": "vtexappkey-mystore-XXXXXX",
    "appTokenConfigured": true,
    "integrationMode": "HOOK",
    "autoCommitFeed": false,
    "simulateErpFailure": false
  }
}
```

Note: `appToken` is never in this response. The `appTokenConfigured` boolean tells the UI whether a token has been set.

---

## POST /api/config

Updates runtime configuration overrides. Settings persist in memory until the server restarts. Env variables take precedence as defaults; these overrides layer on top.

The App Token and App Key, if provided, are stored in server-only memory and never returned to clients.

### Request Body

All fields are optional. Omit fields you do not want to change.

```json
{
  "account": "mystore",
  "environment": "vtexcommercestable.com.br",
  "appKey": "vtexappkey-mystore-XXXXXX",
  "appToken": "your-app-token",
  "integrationMode": "FEED",
  "autoCommitFeed": true,
  "simulateErpFailure": false
}
```

| Field | Type | Description |
|---|---|---|
| `account` | `string` | VTEX account name |
| `environment` | `string` | VTEX environment hostname |
| `appKey` | `string` | VTEX App Key (stored server-side only) |
| `appToken` | `string` | VTEX App Token (stored server-side only, never returned) |
| `integrationMode` | `"FEED" \| "HOOK"` | Active integration mode |
| `autoCommitFeed` | `boolean` | Auto-commit feed handles after processing |
| `simulateErpFailure` | `boolean` | Make all ERP simulations fail |

### Success Response

**Status:** `200 OK`

```json
{
  "ok": true,
  "config": {
    "account": "mystore",
    "environment": "vtexcommercestable.com.br",
    "appKey": "vtexappkey-mystore-XXXXXX",
    "appTokenConfigured": true,
    "integrationMode": "FEED",
    "autoCommitFeed": true,
    "simulateErpFailure": false
  }
}
```

### Error Responses

| Status | Error | Cause |
|---|---|---|
| `400` | `{"error": "Invalid JSON body"}` | Request body is not valid JSON |

---

## GET /api/erp/events

Returns the technical event log. Entries are sorted newest-first. Capped at the most recent 1,000 entries. This is the debug/observability view — separate from per-order timelines.

### Success Response

**Status:** `200 OK`

```json
{
  "events": [
    {
      "timestamp": "2026-04-29T12:00:00.000Z",
      "source": "HOOK",
      "level": "INFO",
      "message": "Hook received orderId: 1234567890-01",
      "orderId": "1234567890-01"
    },
    {
      "timestamp": "2026-04-29T11:59:50.000Z",
      "source": "FEED",
      "level": "ERROR",
      "message": "getFeedItems failed: VTEX API error 401 on https://mystore.vtexcommercestable.com.br/api/orders/feed"
    }
  ],
  "total": 2
}
```

| Field | Description |
|---|---|
| `source` | `FEED`, `HOOK`, or `SYSTEM` |
| `level` | `INFO`, `WARN`, or `ERROR` |
| `message` | Human-readable event description (never includes app token) |
| `orderId` | Present when the event is related to a specific order |
| `payload` | Optional — PII-masked event payload |

---

## Common Error Format

All error responses follow this shape:

```json
{
  "error": "Human-readable error message",
  "message": "Optional technical detail",
  "missing": ["field1", "field2"]
}
```

## HTTP Status Codes Used

| Code | Meaning |
|---|---|
| `200` | Success |
| `400` | Bad request (invalid JSON, missing orderId) |
| `401` | Credentials missing or invalid |
| `403` | Forbidden (invalid hook secret) |
| `404` | Resource not found |
| `409` | Conflict (poll locked, order already handled) |
| `502` | Bad gateway (upstream VTEX API failure) |
