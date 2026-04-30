# Backlog

## UI / Design

- [x] `BL-001` **Apply VTEX brand guidelines to the frontend**
  Apply the official VTEX brand design system (colors, typography, spacing, components) across the entire dashboard UI to make the demo feel native to the VTEX ecosystem.

## Persistence

- [x] `BL-006` **Persist ERP Orders and Event Log across deployments / cold starts**
  Currently both the order inbox and the event log live in `globalThis` in-memory. Every Vercel cold start (new serverless instance) starts with an empty store — orders and events written by one invocation are invisible to the next.

  **Recommended solution: [Neon](https://neon.tech) (serverless Postgres) via Vercel Integration**

  Why Neon over the alternatives:
  | Option | Fit | Notes |
  |---|---|---|
  | **Neon (Vercel Postgres)** | ✅ Best | Free tier, 1-click Vercel integration, SQL for filter/sort/search, JSON columns for timeline & payload |
  | Upstash Redis / Vercel KV | OK | Good for simple key-value, but querying orders (filter by status, search by customer) gets ugly fast |
  | Supabase | OK | Also Postgres, great free tier, but requires a separate account and more setup steps |
  | PlanetScale (MySQL) | ❌ | No free tier anymore |

  **Implementation scope:**
  - Add Neon integration in Vercel dashboard → `DATABASE_URL` env var is injected automatically
  - Replace `src/lib/store.ts` in-memory Maps with Postgres queries using `@neondatabase/serverless` (no ORM needed for this data model)
  - Two tables: `erp_orders` (JSONB column for timeline + payload) and `event_log`
  - All existing API routes stay the same — only the store module changes
  - Add `DATABASE_URL=` to `.env.example`
  - Keep the in-memory store as a fallback when `DATABASE_URL` is not set (local dev with no DB)

## Order Details

- [ ] `BL-007` **Shipping label mockup in order accordion**
  Inside the order detail accordion, show a simulated shipping label preview that an ERP operator can use to see dispatch info at a glance and print. Label must include: From (VTEX account), To (customer name + masked contact), SLA/carrier, order fields, a real CODE128 barcode generated from the orderId, and a Print button that opens a print-ready 4×6in label in a new window.

## Invoice Flow

> **Context:** After Start Handling succeeds the ERP must send a fiscal invoice (nota fiscal) back to VTEX OMS to advance the order to `invoiced` status. Mandatory order sequence: `handling → [Send Invoice] → verifying-invoice → invoiced`. An order becomes **non-cancellable** the moment VTEX receives the invoice. Same App Key / App Token auth as all other OMS calls.
>
> References: [ERP order processing guide](https://developers.vtex.com/docs/guides/erp-integration-set-up-order-processing) · [Invoice & tracking guide](https://developers.vtex.com/docs/guides/external-marketplace-integration-invoice-tracking) · [Order flow](https://help.vtex.com/tracks/orders--2xkTisx4SXOWXQel8Jg8sa/4811ExCe3WrEiRMV3sy9n8)

- [x] `BL-008-A` **Data model — invoice fields on ErpOrderRecord**

  Extend the type layer so every subsequent task has a stable contract to build against.

  - Add `InvoiceStatus = 'NOT_SENT' | 'SUCCESS' | 'ERROR'` to `src/types/erp.ts`
  - Add to `ErpOrderRecord`:
    ```ts
    invoiceStatus: InvoiceStatus;       // default 'NOT_SENT'
    invoiceNumber?: string;             // generated NF number
    invoiceIssuedAt?: string;           // ISO timestamp
    invoiceTracking?: {
      courier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
    };
    ```
  - Add `INVOICE_REQUESTED`, `INVOICE_SUCCESS`, `INVOICE_ERROR` to `PipelineStepName`
  - Set `invoiceStatus: 'NOT_SENT'` as default in store upsert helpers
  - **No UI changes in this task**

- [x] `BL-008-B` **VTEX client — invoice & tracking methods**

  Add the three invoice-related VTEX API calls to `src/lib/vtexClient.ts` and extend `VTEX_API_PATHS` in `src/lib/constants.ts`.

  - Add to `VTEX_API_PATHS`:
    ```ts
    sendInvoice:          (orderId) => `/api/oms/pvt/orders/${orderId}/invoice`
    updateInvoiceTracking:(orderId, invoiceNumber) => `/api/oms/pvt/orders/${orderId}/invoice/${invoiceNumber}`
    ```
  - Add `sendInvoice(orderId, payload)` — `POST`, returns VTEX response or throws
  - Add `updateInvoiceTracking(orderId, invoiceNumber, tracking)` — `PATCH`
  - Invoice number generation helper: `NF-${orderId.replace(/\//g, '-')}-${Date.now()}` (strip slashes — known VTEX bug with `/` in invoiceNumber)
  - `invoiceValue` comes from `ErpOrderRecord.totalValue` (already in cents)
  - `items` array maps from `erpPayload.items` → `{ id: skuId, price, quantity }`

- [~] `BL-008-C` **Pipeline integration — auto-send invoice after Start Handling** *(cancelled — invoice is always a manual operator action to show the flow)*

- [x] `BL-008-D` **API endpoint — manual send & retry invoice**

  Expose manual invoice actions so the operator can trigger/retry from the UI without reprocessing the whole pipeline.

  - `POST /api/erp/orders/:orderId/send-invoice` — calls `vtexClient.sendInvoice()`, updates record, returns `{ ok, invoiceNumber }`
  - `POST /api/erp/orders/:orderId/update-tracking` — calls `vtexClient.updateInvoiceTracking()`, accepts `{ courier, trackingNumber, trackingUrl }` body
  - Guard `send-invoice`: reject with `409` if `invoiceStatus === 'SUCCESS'` (already invoiced)
  - Guard `send-invoice`: reject with `409` if `startHandlingStatus !== 'SUCCESS'` (Start Handling not done)
  - Both endpoints require credentials — return `401` if missing

- [x] `BL-008-E` **UI — invoice status in order row & accordion**

  Surface invoice status and details to the operator.

  - Add **Invoice Status** column to the orders table (after SH Status) using `StatusBadge`-style pill: `NOT_SENT` (gray) · `SUCCESS` (green) · `ERROR` (red)
  - Add **Invoice Details** card to the order accordion (between Payment Details and ERP Payload):
    - Invoice Number (mono)
    - Issued At (formatted date)
    - Courier / Tracking Number / Tracking URL (when present)
    - Invoice Status badge
  - Add action buttons to the accordion Actions bar:
    - **Send Invoice** — enabled when `startHandlingStatus === 'SUCCESS'` and `invoiceStatus !== 'SUCCESS'`
    - **Retry Invoice** — visible only when `invoiceStatus === 'ERROR'`
    - **Update Tracking** — enabled when `invoiceStatus === 'SUCCESS'`; opens a small inline form for courier + trackingNumber + trackingUrl

- [x] `BL-008-F` **Update tracking flow (post-invoice)**

  Two-step dispatch pattern: invoice first (without tracking), add tracking later once the carrier assigns a code.

  - Inline tracking form in the accordion (revealed by "Update Tracking" button):
    - Fields: Courier (text), Tracking Number (text), Tracking URL (text, optional)
    - Submit calls `POST /api/erp/orders/:orderId/update-tracking`
    - On success: update `invoiceTracking` fields on the record and show them in the Invoice Details card
  - Update shipping label (`ShippingLabel.tsx`) to show `trackingNumber` when available (currently shows orderId as barcode — optionally switch to trackingNumber if present)

## Order Lifecycle

- [x] `BL-009` **Cancelled orders — only Delete action available**
  Once a VTEX order reaches `CANCELLED` status it is terminal and irreversible. The UI must reflect this: when `erpStatus === 'CANCELLED'` the accordion Actions bar must show **only** the Delete button — all other actions (Reprocess, Retry Start Handling, Send Invoice, Update Tracking, Mark Resolved) must be hidden.
  *(Implemented in OrderRow.tsx `isCancelled` guard in the Actions bar.)*

- [ ] `BL-010` **Disable Cancel action after invoice is sent**
  VTEX does not accept order cancellations once a fiscal invoice has been received — the order advances to `verifying-invoice` and becomes non-cancellable. The UI must reflect this: when `invoiceStatus === 'SUCCESS'` the Cancel button in the accordion Actions bar must be disabled (greyed out) with a tooltip explaining the reason ("Order cannot be cancelled after invoice is sent"). The button should remain visible so the operator understands why cancellation is unavailable, but it must not be clickable.

---

## Feed Polling

- [ ] `BL-002` **Poll Feed modal with live status**
  When the user clicks "Poll Feed Now", open a modal showing real-time progress of the polling run — items found, each orderId being processed, ERP result, Start Handling result, and a final summary (processed / skipped / errors). Modal closes manually or auto-closes on success.

## Hook & Feed Configuration

- [ ] `BL-011` **In-app Hook and Feed configuration editor**

  Allow operators to read and write their VTEX Hook and Feed configurations directly from the dashboard, using the credentials already saved for their account.

  ### Hook Configuration

  VTEX endpoints (use saved account + environment):
  ```
  GET  https://{account}.{environment}/api/orders/hook/config
  POST https://{account}.{environment}/api/orders/hook/config
  ```

  **Server-side proxy routes** (so credentials never go to the browser):
  - `GET  /api/vtex/config/hook` — fetches current hook config from VTEX, returns JSON
  - `POST /api/vtex/config/hook` — sends updated config to VTEX, returns VTEX response

  **UI panel** inside the Config tab (or a new "Integration Setup" tab):
  - "Load Current Hook Config" button → calls GET proxy → populates a textarea / JSON editor
  - Editable JSON textarea (pre-populated with current config)
  - "Save Hook Config" button → calls POST proxy with edited payload
  - Response area shows VTEX API response (success or error message)
  - Typical hook payload shape:
    ```json
    {
      "filter": {
        "type": "FromWorkflow",
        "status": ["order-completed", "on-order-completed"]
      },
      "hook": {
        "headers": { "key": "value" },
        "url": "https://your-app.vercel.app/api/vtex/hook?account=myaccount"
      }
    }
    ```

  ### Feed Configuration

  VTEX endpoints:
  ```
  GET  https://{account}.{environment}/api/orders/feed/config
  POST https://{account}.{environment}/api/orders/feed/config
  ```

  **Server-side proxy routes**:
  - `GET  /api/vtex/config/feed` — fetches current feed config from VTEX
  - `POST /api/vtex/config/feed` — saves updated feed config to VTEX

  **UI panel** (same tab/section as hook config):
  - Same pattern: Load → Edit JSON → Save → Show response
  - Typical feed payload shape:
    ```json
    {
      "filter": {
        "type": "FromWorkflow",
        "status": ["order-completed"]
      },
      "queue": {
        "visibilityTimeoutInSeconds": 240,
        "messageRetentionPeriodInSeconds": 345600
      }
    }
    ```

  ### Implementation notes
  - Both panels use the per-account credentials from the registry (`buildConfigForAccount`)
  - Auto-populate the `hook.url` field with the correct `?account=` URL from the current session
  - Show a disclaimer: "Saving will overwrite the current VTEX configuration for this account"
  - Validate JSON before sending (catch `JSON.parse` errors client-side)
  - VTEX returns `204 No Content` on success for POST — show a success toast accordingly

## Configuration Panel

- [x] `BL-005` **Persist configuration across Vercel cold starts using an encrypted cookie**
  Currently all config entered via the UI is stored in server memory and lost on every cold start / new serverless invocation. Fix by persisting the config as an **encrypted HttpOnly cookie** using `iron-session`. Non-secret fields (account, environment, mode) and the App Key are stored as-is; the App Token is encrypted with a server-side `SESSION_SECRET` env var. On every request the server reads the cookie and decrypts it — no external service (no Vercel KV) required, zero infra cost, and the App Token is never exposed in plaintext in the browser.
  **Approach:** `npm i iron-session` → wrap POST /api/config to write a sealed cookie → wrap GET /api/config and all VTEX-calling routes to read it → add `SESSION_SECRET` to `.env.example` and Vercel env vars.

- [x] `BL-003` **App Key does not need to be masked**
  The App Key is not a secret — it can be displayed in plain text in the UI. Only the App Token must remain hidden.

- [x] `BL-004` **Show the stored App Key value next to the CONFIGURED badge**
  After an App Key is saved, display it alongside the "CONFIGURED" indicator (e.g. `CONFIGURED · vtexappkey-mystore-XXXXX`) so the operator can confirm which key is active. The App Token must continue to show only "CONFIGURED" with no value revealed.
