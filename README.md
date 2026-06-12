# VTEX Demo Platform

A multi-simulator integration demo tool for VTEX Solution Engineers and SAs. Each simulator exposes real protocol-compliant endpoints and shows every VTEX API call in a live dashboard. Deploy once to Vercel, share a URL with a customer, and run four different integration demos from the same app.

**Current version:** 1.4.0

---

## Simulators

| Simulator | Path | Status | What it demonstrates |
|---|---|---|---|
| ERP Simulator | `/erp` | Live | OMS → ERP order handoff via Feed or Hook, Get Order, Start Handling, electronic invoice, shipping label |
| Payment Provider Protocol | `/payment-provider` | Live | Full PPP endpoint suite — create, cancel, refund, settlement — with per-scenario approval control |
| External Seller Simulator | `/marketplace` | Beta | Fulfillment simulation, order placement, cancellation, SKU registration via Change Notification + Suggestions |
| Gift Card Provider | `/gift-card` | Beta | Gift Card Provider Protocol — fictional card auto-return, transaction lifecycle (debit, settle, cancel) |

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/dcionevtex/erp_mock.git
cd erp_mock
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — minimum required: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with your @vtex.com Google account to access the launcher.

---

## Prerequisites

- Node.js 24 or later
- A Google Cloud project with OAuth credentials configured for @vtex.com login
- A VTEX account + App Key/Token with OMS permissions (for ERP Simulator)

---

## Environment Variables

```env
# Auth — required for login to work
AUTH_SECRET=                          # any random string, e.g. output of: openssl rand -base64 32
AUTH_GOOGLE_ID=                       # Google OAuth client ID
AUTH_GOOGLE_SECRET=                   # Google OAuth client secret

# ERP Simulator — can also be set at runtime via the config panel
VTEX_ACCOUNT=
VTEX_ENVIRONMENT=vtexcommercestable.com.br
VTEX_APP_KEY=
VTEX_APP_TOKEN=

# Optional
DATABASE_URL=                         # Neon PostgreSQL connection string — enables persistent storage
AUTO_COMMIT_FEED=false                # Commit feed items after processing
SIMULATE_ERP_FAILURE=false            # Force ERP simulation to fail (demo mode)
NEXT_PUBLIC_APP_URL=                  # Override public URL shown in hook endpoint display
```

Without `DATABASE_URL`, all state is held in-memory and resets on cold starts. This is acceptable for demos — set `DATABASE_URL` if you need state to survive Vercel redeployments.

---

## Authentication

The app uses NextAuth v5 with Google OAuth. Only `@vtex.com` email addresses can sign in. All pages (except `/login`) are protected by session middleware.

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create an OAuth 2.0 Client ID (type: Web application).
3. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (dev) + your Vercel URL (prod).
4. Copy the Client ID and Client Secret to `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
5. Generate `AUTH_SECRET` with `openssl rand -base64 32`.

---

## ERP Simulator

Demonstrates the full VTEX OMS → ERP order integration lifecycle.

### Flow

```
VTEX OMS
  → POST /api/vtex/hook  (push)  or  POST /api/vtex/feed/poll  (pull)
  → Get Order API → ERP Payload Normalizer → ERP Simulator
  → Start Handling (only on ERP success)
  → ERP Orders Inbox
```

### Setup

1. Open `/erp` and configure VTEX credentials in the Config Panel.
2. The hook URL is shown in the Config Panel — use it in VTEX hook registration.

### VTEX Hook Setup

1. In VTEX admin: Store Settings → Orders → Notifications → Add hook.
2. Set the endpoint to `https://<your-app>/api/vtex/hook`.
3. Subscribe to `order-created` and `ready-for-handling` states.
4. See `docs/VTEX_SETUP.md` for full step-by-step guide.

### Feed Mode

1. Set Integration Mode to `FEED` in the config panel.
2. Click **Poll Feed Now**.
3. Orders in `ready-for-handling` state are fetched and processed automatically.
4. Set `AUTO_COMMIT_FEED=true` or enable via the config panel to acknowledge items after processing.

### Start Handling rules

- Called **only** after ERP simulation returns success.
- If Get Order fails → no Start Handling.
- If ERP simulation fails → no Start Handling.
- Manual retry available from the order accordion.

### Order accordion

Each order row expands to show: ERP summary, order items, shipping, payment, normalized ERP payload (JSON), raw VTEX payload (JSON), and a step-by-step processing timeline.

### Actions available per order

Reprocess, Retry Get Order, Retry Start Handling, Send Invoice, Update Tracking, Cancel Order, Mark as Manually Resolved, Simulate ERP failure/success, Copy payloads.

---

## Payment Provider Protocol Simulator

Implements the [VTEX Payment Provider Protocol](https://developers.vtex.com/docs/guides/payment-provider-protocol) endpoint suite.

### Setup in VTEX

1. Open `/payment-provider`, enter a VTEX account name.
2. Copy the **Provider Base URL** shown in the dashboard.
3. In VTEX admin: Payments → Settings → Payment Providers → Add provider.
4. Set the provider URL to the copied base URL.
5. Run the VTEX PPP test suite against it from the dashboard.

### Protocol endpoints exposed

```
GET  /api/payment-provider/[account]/manifest
POST /api/payment-provider/[account]/payments
GET  /api/payment-provider/[account]/payments/[paymentId]
POST /api/payment-provider/[account]/payments/[paymentId]/cancellations
POST /api/payment-provider/[account]/payments/[paymentId]/refunds
GET  /api/payment-provider/[account]/payments/[paymentId]/settlements
```

### Scenario control

Toggle **Approve** / **Deny** in the dashboard to control how the simulator responds to payment creation requests. Every call VTEX makes is logged with full request and response.

---

## External Seller Simulator

Implements the [VTEX External Seller Fulfillment Protocol](https://developers.vtex.com/docs/guides/external-seller-integration-guide).

### Setup in VTEX

1. Open `/marketplace`, enter a seller account name.
2. Copy the **Seller Fulfillment URL** shown in the dashboard.
3. In VTEX admin: Marketplace → Sellers → Add seller → set Fulfillment Endpoint to the copied URL.
4. Use the **Catalog** tab to register SKUs (Change Notification → Suggestion flow).

### Protocol endpoints exposed

```
POST /api/marketplace/[account]/pvt/orderForms/simulation   — checkout simulation
POST /api/marketplace/[account]/pvt/orders                  — order placement
POST /api/marketplace/[account]/pvt/orders/[orderId]/cancel
POST /api/marketplace/[account]/pvt/orders/[orderId]/fulfill
POST /api/marketplace/[account]/change-notification          — SKU change notification
POST /api/marketplace/[account]/suggest-sku                  — SKU suggestion to VTEX catalog
```

### SKU Registration flow

The Catalog tab runs a two-step flow:
1. Send Change Notification to VTEX — if the SKU exists (200), stop.
2. If the SKU is not found (404), automatically send an SKU Suggestion.

Each step shows the VTEX response inline. The Suggestions API uses `api.vtex.com` as the base URL.

---

## Gift Card Provider

Implements the [VTEX Gift Card Provider Protocol](https://developers.vtex.com/docs/guides/gift-card-integration-guide).

### Setup in VTEX

1. Open `/gift-card`, enter a VTEX account name.
2. Copy the **Hub URL** shown in the dashboard.
3. In VTEX admin: Payments → Gift Cards → Add provider → set the Hub URL.
4. Any customer email at checkout now returns a fictional card from this simulator.

### Protocol endpoints exposed

```
GET  /api/gift-card/[account]/hub
POST /api/gift-card/[account]/giftcards           — search by email
GET  /api/gift-card/[account]/giftcards/[id]      — get card
POST /api/gift-card/[account]/giftcards/[id]/[transaction]  — debit, credit, cancel
```

### Scenario control

Toggle **Return card** (approved) or **Return empty** (no cards found at checkout).

---

## Demo Script

### Before the demo

1. Deploy to Vercel or start locally.
2. Sign in with your @vtex.com account.
3. Open the simulator you want to demo and check the setup panel.

### ERP demo (~5 min)

1. Enter VTEX credentials in the ERP config panel.
2. Place a test order in VTEX sandbox.
3. Click **Poll Feed Now** or wait for the hook to fire.
4. Walk through the order accordion: timeline → items → shipping → payment → payloads.
5. Enable **Simulate ERP Failure**, reprocess — show that Start Handling is not called.
6. Disable failure flag, click **Reprocess** — show full success flow.

### PPP demo (~3 min)

1. Copy the Provider Base URL from the dashboard.
2. Register it in VTEX admin as a payment provider.
3. Toggle **Approve** and go through a test checkout.
4. Show every request/response in the call log.
5. Toggle **Deny** — repeat checkout, show declined response.

### External Seller demo (~4 min)

1. Copy the Fulfillment URL, register in VTEX as a seller.
2. Go to the Catalog tab, enter a SKU — run the Change Notification → Suggestion flow.
3. Show the step-by-step result with VTEX API responses.
4. Go through a test checkout via the VTEX storefront — show simulation and placement calls in the log.

### Gift Card demo (~2 min)

1. Copy the Hub URL, register in VTEX Payments.
2. Go through checkout with any email — show the fictional card applied.
3. Show the call log: search → get card → debit → settle.

---

## Troubleshooting

**Login loop / "Sign in" page keeps redirecting**

`AUTH_SECRET`, `AUTH_GOOGLE_ID`, or `AUTH_GOOGLE_SECRET` is missing or incorrect. Check the values in `.env.local` and ensure the Google OAuth redirect URIs include your app URL.

**ERP: "VTEX credentials missing" warning**

Enter VTEX Account, App Key, and App Token in the ERP config panel, or set them in `.env.local`.

**ERP: Poll Feed returns `{"processed": 0}`**

The VTEX Feed queue is empty. Place a test order in `ready-for-handling` state, then poll again.

**ERP: Order shows `START_HANDLING_ERROR`**

The order may already be invoiced, cancelled, or not in a state that allows Start Handling. Use **Mark as Manually Resolved** to clear it from the active queue.

**PPP: VTEX test suite fails with connection error**

The Provider Base URL must be publicly accessible. If testing locally, use a tunnel (ngrok, Cloudflare Tunnel) to expose `localhost:3000`.

**Marketplace: Suggestions API returns 400 "account resolution error"**

Confirm the Seller account name field is set correctly. The Suggestions API endpoint uses `api.vtex.com`, not `vtexcommercestable.com.br`.

**State disappears after Vercel redeployment**

Expected — state is in-memory without `DATABASE_URL`. Set `DATABASE_URL` to a Neon PostgreSQL connection string to persist ERP orders across deployments.

---

## Development

```bash
npm run dev        # start dev server at localhost:3000
npm run build      # production build (must exit 0)
npm run test       # run Vitest test suite
npm run lint       # ESLint
```

Node.js >= 24.0.0 required.

---

## Deployment to Vercel

1. Push to GitHub.
2. Import the repo in the [Vercel dashboard](https://vercel.com/new).
3. Set all required environment variables (Auth + VTEX).
4. Deploy — no build configuration needed (Next.js auto-detected).
5. Add the Vercel deployment URL to your Google OAuth authorized redirect URIs.

For persistent storage, provision a [Neon](https://neon.tech) database and set `DATABASE_URL`.

---

## Documentation

| File | Contents |
|---|---|
| `docs/SDD.md` | Software Design Document with architecture diagrams |
| `docs/API.md` | Full API reference for all endpoints |
| `docs/DEPLOYMENT.md` | Vercel deployment guide |
| `docs/SECURITY.md` | Security model and production hardening checklist |
| `docs/VTEX_SETUP.md` | VTEX Feed, Hook, and provider configuration guide |
| `CLAUDE.md` | Codebase guide for AI-assisted development |
| `.env.example` | Environment variable reference |

---

## Production Hardening

This app is built for demos. Before using in production:

- Replace in-memory store with Neon, Supabase, or another durable store (already supported via `DATABASE_URL`)
- Add HMAC-SHA256 webhook signature validation on the hook endpoint
- Add per-IP rate limiting on all inbound endpoints
- Store VTEX App Token in an encrypted secret vault — never expose it to clients
- Scope VTEX App Key/Token permissions to the minimum required
- Add structured logging with correlation IDs

---

Built by [@dcionevtex](https://github.com/dcionevtex) & his bot army.
