# VTEX OMS to ERP Demo Console

A Next.js application that simulates an external ERP integration with VTEX OMS. It demonstrates the complete order processing handoff: VTEX sends an order event via Hook or Feed, the app fetches the full order, normalizes it into an ERP payload, simulates ERP acceptance, and calls VTEX Start Handling — all visible step-by-step in a business-friendly dashboard.

**Official VTEX reference:** [ERP Integration Setup](https://developers.vtex.com/docs/guides/erp-integration-set-up-order-integration)

---

## Quick Start

Get the app running in under 5 minutes:

```bash
# 1. Clone and install
git clone <your-repo-url>
cd oms_mock
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your VTEX credentials (see Environment Variables below)

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The ERP Orders Inbox loads immediately. If credentials are missing, the configuration panel shows a warning.

---

## Architecture Summary

The app is a Next.js 16 serverless application deployed on Vercel. VTEX remains the source of truth for OMS and order orchestration. The app acts as middleware and a simulated ERP: it receives events from VTEX via Hook (push) or Feed (pull), calls the VTEX Get Order API to load full order details, normalizes the order into a simplified ERP payload, simulates ERP acceptance, and then calls VTEX Start Handling to signal that the ERP has accepted the order. All state is held in an in-memory store (process-scoped, demo-only). The dashboard polls the API every 3 seconds and displays all orders in a unified ERP Orders Inbox.

```
VTEX OMS
  → POST /api/vtex/hook  (or POST /api/vtex/feed/poll)
  → Order Processor
      → VTEX Get Order API
      → ERP Payload Normalizer
      → ERP Simulator (accept / fail)
      → VTEX Start Handling
  → In-Memory Store
  → ERP Orders Inbox (dashboard)
```

---

## Prerequisites

- Node.js 24 or later (`node --version`)
- A VTEX account with OMS access
- A VTEX App Key and App Token with `OMS read` and `OMS write` permissions

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your VTEX credentials:

```env
VTEX_ACCOUNT=mystore
VTEX_ENVIRONMENT=vtexcommercestable.com.br
VTEX_APP_KEY=vtexappkey-mystore-XXXXXX
VTEX_APP_TOKEN=<your-app-token>
DEMO_HOOK_SECRET=my-demo-secret
AUTO_COMMIT_FEED=false
SIMULATE_ERP_FAILURE=false
```

### 3. Run the development server

```bash
npm run dev
```

The app starts at [http://localhost:3000](http://localhost:3000).

### 4. Run tests

```bash
npm test
```

### 5. Build for production

```bash
npm run build
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `VTEX_ACCOUNT` | Yes | — | Your VTEX account name (e.g., `mystore`) |
| `VTEX_ENVIRONMENT` | Yes | `vtexcommercestable.com.br` | VTEX API environment |
| `VTEX_APP_KEY` | Yes | — | VTEX App Key with OMS permissions |
| `VTEX_APP_TOKEN` | Yes | — | VTEX App Token (never logged, never exposed in UI) |
| `DEMO_HOOK_SECRET` | No | — | If set, the hook endpoint requires `x-demo-hook-secret: <value>` header |
| `AUTO_COMMIT_FEED` | No | `false` | Set to `true` to automatically commit (acknowledge) feed items after processing |
| `SIMULATE_ERP_FAILURE` | No | `false` | Set to `true` to make all ERP simulations fail (for demo purposes) |
| `NEXT_PUBLIC_APP_URL` | No | — | Override the app's public URL used to display the hook endpoint address |

All credentials can also be updated at runtime from the Configuration Panel in the dashboard. Runtime overrides are stored in memory and reset on server restart.

---

## Feed Mode

Feed mode lets the app poll the VTEX Feed queue on demand.

### How it works

1. Click **Poll Feed Now** in the dashboard.
2. The app calls `POST /api/vtex/feed/poll`.
3. The endpoint retrieves up to 5 pending events from the VTEX Feed API.
4. Each event is deduplicated (by eventId or `orderId+state+timestamp` composite).
5. For each new event, the full pipeline runs: Get Order → normalize → ERP simulate → Start Handling.
6. If `AUTO_COMMIT_FEED=true`, the feed handle is committed after successful processing.
7. The result counter (processed / duplicates / errors) appears in the UI.

### Enable Feed mode in the config panel

1. Open the Configuration Panel.
2. Set **Integration Mode** to `FEED`.
3. Optionally enable **Auto Commit Feed Items**.
4. Click **Poll Feed Now**.

---

## Hook Mode

Hook mode receives VTEX order notifications pushed directly to the app.

### How it works

1. VTEX sends a `POST` to your hook endpoint when an order reaches a subscribed state.
2. The app extracts the `orderId` from the payload (handles multiple VTEX payload shapes).
3. The full pipeline runs synchronously: Get Order → normalize → ERP simulate → Start Handling.
4. The app returns `200 {"received": true, "orderId": "..."}` immediately.

### Hook endpoint URL

```
POST https://<your-vercel-url>/api/vtex/hook
```

The dashboard Configuration Panel shows the hook URL once `NEXT_PUBLIC_APP_URL` is set or automatically inferred from the browser origin.

### Optional hook secret

If `DEMO_HOOK_SECRET` is set, include this header in VTEX hook requests:

```
x-demo-hook-secret: <your-demo-secret>
```

Requests without a valid secret receive `403 Forbidden`. This is demo-level security — see `docs/SECURITY.md` for production recommendations.

---

## Demo Script

Use this script for a live demo session:

### Setup (before the demo)

1. Deploy to Vercel or run locally.
2. Open the dashboard at the app URL.
3. Open the Configuration Panel and enter VTEX credentials.
4. Confirm the status indicator shows "Credentials configured."

### Feed demo (2 minutes)

1. Ensure there are orders in the VTEX sandbox in `ready-for-handling` state.
2. Set Integration Mode to `FEED`.
3. Click **Poll Feed Now**.
4. Watch the ERP Orders Inbox — new orders appear within seconds.
5. Click any order row to expand the accordion.
6. Walk through: ERP Summary → Order Items → Shipping → Payment → Processing Timeline.
7. Note the timeline shows each pipeline step with timestamps.
8. Point out the Start Handling status (SUCCESS or ERROR).

### Hook demo (2 minutes)

1. Configure a VTEX Hook pointing to your `/api/vtex/hook` URL (see `docs/VTEX_SETUP.md`).
2. Place a test order in VTEX.
3. Watch the order appear in the ERP Orders Inbox in real time.
4. Expand the accordion and show the Processing Timeline.

### Failure simulation (1 minute)

1. In the Configuration Panel, enable **Simulate ERP Failure**.
2. Click **Poll Feed Now** or send a hook event.
3. The order shows `ERROR` status. Start Handling is NOT called.
4. Expand the order and note the ERP_SIMULATION_ERROR step in the timeline.
5. Disable the failure flag.
6. Click **Reprocess** on the order row — the pipeline reruns and succeeds.

### Retry Start Handling (1 minute)

1. Show an order in `START_HANDLING_ERROR` status.
2. Click **Retry Start Handling** in the order accordion.
3. The timeline shows a new START_HANDLING_REQUESTED step.

---

## Troubleshooting

**"VTEX credentials missing" warning on the dashboard**

Set `VTEX_ACCOUNT`, `VTEX_APP_KEY`, and `VTEX_APP_TOKEN` in `.env.local` and restart `npm run dev`. Alternatively, enter them in the Configuration Panel.

**Poll Feed Now returns `{"processed": 0, "duplicates": 0, "errors": 0, "total": 0}`**

The VTEX Feed queue is empty. Place a test order in VTEX sandbox in `ready-for-handling` state, then poll again.

**Hook returns `403 Forbidden`**

`DEMO_HOOK_SECRET` is set. Include the matching `x-demo-hook-secret` header in your VTEX hook configuration, or unset the variable in `.env.local`.

**Order shows `ERROR` with "VTEX API error 401"**

The App Key or App Token is invalid or expired. Regenerate them in the VTEX admin and update the Configuration Panel or `.env.local`.

**Order shows `START_HANDLING_ERROR`**

The order may not be in a state that allows Start Handling (e.g., already invoiced, cancelled, or not `ready-for-handling`). VTEX returns a `4xx` error in this case. The order remains in the ERP Inbox — use **Mark as Manually Resolved** if you want to clear it from the active queue.

**State disappears after Vercel redeployment**

The in-memory store is process-scoped and resets on every cold start. This is expected for the demo. See `docs/DEPLOYMENT.md` and `docs/SDD.md` for persistence options.

---

## Production Hardening

The following are known limitations of the MVP that must be addressed before using this app in production:

- **Persistent storage:** Replace the in-memory store with Vercel KV, Supabase, PostgreSQL, or DynamoDB.
- **Authentication:** Add OAuth or session-based admin authentication to protect the configuration panel and API routes.
- **Webhook signature validation:** Replace the demo hook secret with HMAC-SHA256 signature validation.
- **Rate limiting:** Add per-IP rate limiting on the hook endpoint to prevent abuse.
- **Encrypted credential storage:** Store VTEX App Token in an encrypted secret vault (Vercel Secrets, AWS Secrets Manager). Never allow clients to read it.
- **Audit log:** Record all configuration changes and pipeline actions with timestamps and actor identity.
- **Background polling:** Use Vercel Cron or a queue service for scheduled Feed polling instead of manual triggers.
- **Retry queue:** Implement exponential backoff for failed pipeline runs.
- **Structured logging:** Add correlation IDs and structured log output for observability.

See `docs/SDD.md` for the full v0 improvement backlog.

---

## Documentation

| File | Contents |
|---|---|
| `docs/SDD.md` | Software Design Document with architecture diagrams and sequence flows |
| `docs/API.md` | Full API reference for all endpoints |
| `docs/DEPLOYMENT.md` | Vercel deployment guide |
| `docs/SECURITY.md` | Security model and production hardening checklist |
| `docs/VTEX_SETUP.md` | VTEX Feed and Hook configuration guide |
| `.env.example` | Environment variable reference |
