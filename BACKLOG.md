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

- [ ] `BL-008` **Invoice (Nota Fiscal) notification flow**

  After Start Handling succeeds, the ERP must send a fiscal invoice back to VTEX OMS to advance the order to `invoiced` status. This is the natural next step after the current Start Handling implementation.

  ### VTEX API

  | Method | Endpoint | Purpose |
  |---|---|---|
  | `POST` | `/api/oms/pvt/orders/{orderId}/invoice` | Send invoice notification |
  | `PATCH` | `/api/oms/pvt/orders/{orderId}/invoice/{invoiceNumber}` | Update tracking on an existing invoice |
  | `PUT` | `/api/oms/pvt/orders/{orderId}/invoice/{invoiceNumber}/tracking` | Push manual tracking events (non-integrated carriers) |

  Same `X-VTEX-API-AppKey` / `X-VTEX-API-AppToken` auth as all other OMS calls.

  ### Invoice POST payload

  ```json
  {
    "type": "Output",
    "invoiceNumber": "NF-1628470500060-01-1746000000",
    "invoiceValue": 7450,
    "issuanceDate": "2026-04-29T19:05:00",
    "invoiceKey": "35240312345678000195550010000001231000000123",
    "invoiceUrl": "https://erp.example.com/nf/NF-000123.pdf",
    "courier": "Correios",
    "trackingNumber": "BR123456789BR",
    "trackingUrl": "https://rastreamento.correios.com.br/...",
    "items": [
      { "id": "SKU-001", "price": 7450, "quantity": 1 }
    ]
  }
  ```

  | Field | Required | Notes |
  |---|---|---|
  | `type` | Yes | `"Output"` (sale) or `"Input"` (return/devolution) |
  | `invoiceNumber` | Yes | Unique per order. **Never use `/`** — causes 404 on tracking PATCH (known VTEX bug) |
  | `invoiceValue` | Yes | Integer in cents. Maps directly from VTEX `totalValue` |
  | `issuanceDate` | Yes | ISO 8601. Use current timestamp at ERP dispatch time |
  | `invoiceKey` | No | 44-digit NF-e chave de acesso. Optional for demo, required for production Brazil |
  | `invoiceUrl` | No | URL to invoice PDF |
  | `courier` / `trackingNumber` / `trackingUrl` | No | Can be sent now or updated later via PATCH |
  | `items[].id` | Yes | Maps to VTEX order item `id` (skuId) |
  | `items[].price` | Yes | Integer in cents |
  | `items[].quantity` | Yes | Integer |

  ### Order lifecycle (mandatory sequence)

  ```
  payment-approved
    → ready-for-handling
    → [Start Handling]       ← already implemented
    → handling
    → [Send Invoice]         ← this backlog item
    → verifying-invoice      (VTEX validates totals)
    → invoiced               (terminal — order cannot be cancelled after this)
  ```

  **Start Handling is a prerequisite** — invoicing an order not in `handling` state is rejected by VTEX.

  ### Key constraints
  - An order becomes **non-cancellable** the moment an invoice is received.
  - **Partial invoices** are supported: send multiple POSTs with different `invoiceNumber`s; all invoice values must sum to the order total for the order to reach `invoiced`.
  - Tracking fields can be included on the initial POST or added later via PATCH (two-step dispatch pattern).

  ### Implementation scope (when ready)
  - Add `invoiceFlow` step to the pipeline after Start Handling success
  - Generate a simulated `invoiceNumber` (`NF-{orderId}` with slashes stripped)
  - Add `invoiceStatus` field to `ErpOrderRecord` (`NOT_SENT | SUCCESS | ERROR`)
  - Add timeline steps: `INVOICE_REQUESTED`, `INVOICE_SUCCESS`, `INVOICE_ERROR`
  - Add "Send Invoice" and "Retry Invoice" actions to the order accordion
  - Add simulated `courier` / `trackingNumber` for the demo
  - New API endpoint: `POST /api/erp/orders/:orderId/send-invoice`
  - Extend `VTEX_API_PATHS` constants with `sendInvoice` and `updateInvoiceTracking`

  ### References
  - https://developers.vtex.com/docs/guides/erp-integration-set-up-order-processing
  - https://developers.vtex.com/docs/guides/external-marketplace-integration-invoice-tracking
  - https://help.vtex.com/tracks/orders--2xkTisx4SXOWXQel8Jg8sa/4811ExCe3WrEiRMV3sy9n8
  - https://help.vtex.com/en/docs/tracks/partial-invoices

---

## Feed Polling

- [ ] `BL-002` **Poll Feed modal with live status**
  When the user clicks "Poll Feed Now", open a modal showing real-time progress of the polling run — items found, each orderId being processed, ERP result, Start Handling result, and a final summary (processed / skipped / errors). Modal closes manually or auto-closes on success.

## Configuration Panel

- [x] `BL-005` **Persist configuration across Vercel cold starts using an encrypted cookie**
  Currently all config entered via the UI is stored in server memory and lost on every cold start / new serverless invocation. Fix by persisting the config as an **encrypted HttpOnly cookie** using `iron-session`. Non-secret fields (account, environment, mode) and the App Key are stored as-is; the App Token is encrypted with a server-side `SESSION_SECRET` env var. On every request the server reads the cookie and decrypts it — no external service (no Vercel KV) required, zero infra cost, and the App Token is never exposed in plaintext in the browser.
  **Approach:** `npm i iron-session` → wrap POST /api/config to write a sealed cookie → wrap GET /api/config and all VTEX-calling routes to read it → add `SESSION_SECRET` to `.env.example` and Vercel env vars.

- [x] `BL-003` **App Key does not need to be masked**
  The App Key is not a secret — it can be displayed in plain text in the UI. Only the App Token must remain hidden.

- [x] `BL-004` **Show the stored App Key value next to the CONFIGURED badge**
  After an App Key is saved, display it alongside the "CONFIGURED" indicator (e.g. `CONFIGURED · vtexappkey-mystore-XXXXX`) so the operator can confirm which key is active. The App Token must continue to show only "CONFIGURED" with no value revealed.
