# VTEX Setup Guide — VTEX OMS to ERP Demo Console

This guide walks through creating VTEX credentials, configuring a VTEX Hook, and using the VTEX Feed for the demo integration.

**Official VTEX reference:** [ERP Integration Setup](https://developers.vtex.com/docs/guides/erp-integration-set-up-order-integration)

---

## 1. Prerequisites

- A VTEX account with at least one storefront (sandbox or production).
- Access to the VTEX Admin (`https://<account>.myvtex.com/admin`).
- Permission to create App Keys and App Tokens.

---

## 2. Create a VTEX App Key and App Token

### Step 1: Open Account Settings

1. Log in to your VTEX Admin.
2. Go to **Account Settings** → **Account Management** → **Account**.
3. Open the **App Keys** tab (or navigate directly to `https://<account>.myvtex.com/admin/license-manager/#/home`).

### Step 2: Create an App Key

1. Click **Generate app key**.
2. Enter a label (e.g., `ERP Demo Integration`).
3. The App Key is displayed immediately — copy it. It looks like: `vtexappkey-mystore-XXXXXX`.

### Step 3: Assign Permissions

The App Key needs these roles to support the demo:

| Role | Reason |
|---|---|
| `OMS - Full access` (or equivalent) | Required to call Get Order and Start Handling |
| `Feed - Full access` | Required to read Feed items and commit handles |

To assign:
1. In the App Key detail page, click **Add role**.
2. Search for and select the roles above.
3. Save.

### Step 4: Generate the App Token

1. On the App Key detail page, click **Generate token**.
2. Copy the token immediately — it is shown only once.
3. Store it securely (password manager, secrets manager).

---

## 3. Configure the App

### Using environment variables (recommended for Vercel)

Add to `.env.local` (local) or Vercel Environment Variables (deployed):

```env
VTEX_ACCOUNT=mystore
VTEX_ENVIRONMENT=vtexcommercestable.com.br
VTEX_APP_KEY=vtexappkey-mystore-XXXXXX
VTEX_APP_TOKEN=<your-generated-token>
```

### Using the Configuration Panel (runtime override)

1. Open the demo dashboard.
2. Click **Configuration**.
3. Fill in Account Name, App Key, and App Token.
4. Click **Save Configuration**.

Runtime overrides are stored in server memory and reset on cold start. For persistent configuration, use environment variables.

---

## 4. Configure a VTEX Hook

The hook endpoint receives order event notifications pushed by VTEX when an order transitions to a subscribed state.

### Your hook endpoint URL

```
POST https://<your-app-url>/api/vtex/hook
```

Replace `<your-app-url>` with your Vercel deployment URL or `http://localhost:3000` for local development.

For local development testing, use a tunneling tool like [ngrok](https://ngrok.com/) to expose your local server to the internet:

```bash
ngrok http 3000
# Use the https URL from ngrok output as your hook URL
```

### Option A: Configure via VTEX API

Use the VTEX Orders API to register a hook:

```bash
curl -X POST \
  "https://mystore.vtexcommercestable.com.br/api/orders/hook/config" \
  -H "Content-Type: application/json" \
  -H "X-VTEX-API-AppKey: vtexappkey-mystore-XXXXXX" \
  -H "X-VTEX-API-AppToken: <your-token>" \
  -d '{
    "filter": {
      "status": ["ready-for-handling"]
    },
    "hook": {
      "url": "https://<your-app-url>/api/vtex/hook",
      "headers": {
        "x-demo-hook-secret": "<your-demo-secret>"
      }
    }
  }'
```

**Filter status values** — VTEX will send notifications when orders reach these states. For the demo, `ready-for-handling` is the most relevant state.

Other useful states:
- `payment-approved` — order payment confirmed
- `invoiced` — order invoiced

### Option B: Configure via VTEX Admin (if available)

1. Go to **Store Settings** → **Integrations** → **Orders**.
2. Find the Hook configuration section.
3. Enter your hook endpoint URL.
4. Add the `x-demo-hook-secret` header if `DEMO_HOOK_SECRET` is configured.
5. Select the order states to subscribe to (at minimum: `ready-for-handling`).
6. Save.

### Verify hook configuration

Check the current hook configuration:

```bash
curl -X GET \
  "https://mystore.vtexcommercestable.com.br/api/orders/hook/config" \
  -H "X-VTEX-API-AppKey: vtexappkey-mystore-XXXXXX" \
  -H "X-VTEX-API-AppToken: <your-token>"
```

---

## 5. Use VTEX Feed

Feed is a queue-based pattern. No special VTEX configuration is required — your account's order queue is available automatically.

### How Feed works in VTEX

- VTEX maintains a Feed queue per account.
- When an order state changes, an event is added to the queue.
- Your app calls `GET /api/orders/feed` to retrieve pending events (up to a configured maximum per call).
- After processing, your app should commit (acknowledge) the event handle so VTEX removes it from the queue.
- If an event is not committed, VTEX re-delivers it on the next poll (this is why idempotency is critical).

### Polling Feed from the dashboard

1. Open the demo dashboard.
2. Set **Integration Mode** to `FEED` in the Configuration Panel.
3. Click **Poll Feed Now**.
4. The app calls `POST /api/vtex/feed/poll`, which retrieves up to 5 pending events.

### Configuring Feed auto-commit

When **Auto Commit Feed Items** is enabled in the Configuration Panel (or `AUTO_COMMIT_FEED=true` in env), the app automatically commits each successfully processed feed handle. If disabled, handles are left in the queue and will be re-delivered on subsequent polls.

For demo purposes, leave auto-commit disabled so you can re-poll and demonstrate the deduplication behavior.

### Feed configuration via VTEX API (optional)

If your account's Feed is not yet configured or needs adjustment:

```bash
# Get current Feed configuration
curl -X GET \
  "https://mystore.vtexcommercestable.com.br/api/orders/feed/config" \
  -H "X-VTEX-API-AppKey: vtexappkey-mystore-XXXXXX" \
  -H "X-VTEX-API-AppToken: <your-token>"

# Update Feed configuration
curl -X POST \
  "https://mystore.vtexcommercestable.com.br/api/orders/feed/config" \
  -H "Content-Type: application/json" \
  -H "X-VTEX-API-AppKey: vtexappkey-mystore-XXXXXX" \
  -H "X-VTEX-API-AppToken: <your-token>" \
  -d '{
    "filter": {
      "status": ["ready-for-handling"],
      "quantity": 5
    }
  }'
```

---

## 6. Testing the Integration

### Place a test order in VTEX Sandbox

1. Open your VTEX storefront (or sandbox storefront).
2. Add a product to the cart and complete the checkout.
3. Wait for the order to reach `payment-approved` state, then `ready-for-handling`.

### Trigger Start Handling manually (for testing)

If you want to send an order directly to `ready-for-handling` without completing a checkout:

```bash
curl -X POST \
  "https://mystore.vtexcommercestable.com.br/api/oms/pvt/orders/<orderId>/start-handling" \
  -H "Content-Type: application/json" \
  -H "X-VTEX-API-AppKey: vtexappkey-mystore-XXXXXX" \
  -H "X-VTEX-API-AppToken: <your-token>" \
  -d '{}'
```

### Send a test hook manually

Simulate VTEX pushing an event to your hook endpoint:

```bash
curl -X POST http://localhost:3000/api/vtex/hook \
  -H "Content-Type: application/json" \
  -H "x-demo-hook-secret: <your-demo-secret>" \
  -d '{"orderId": "<your-vtex-order-id>", "state": "ready-for-handling"}'
```

Replace `<your-vtex-order-id>` with a real VTEX orderId from your account. The app will call Get Order using your configured credentials to fetch full details.

### Verify results

1. Open the demo dashboard.
2. The order appears in the ERP Orders Inbox within seconds.
3. Expand the accordion — the Processing Timeline shows each pipeline step.
4. Confirm Start Handling status is `SUCCESS`.

---

## 7. Troubleshooting VTEX API Errors

**401 Unauthorized**

- The App Key or App Token is incorrect, expired, or missing.
- Regenerate the token in the VTEX admin and update the Configuration Panel or `.env.local`.

**403 Forbidden**

- The App Key does not have the required OMS or Feed permissions.
- Add the required roles in the VTEX admin App Key settings.

**404 Order Not Found**

- The orderId does not exist in your VTEX account.
- Verify the orderId format: it should look like `1234567890-01`.

**Start Handling returns 4xx**

- The order may not be in `ready-for-handling` state. VTEX only allows Start Handling for orders in this state.
- Check the order status in the VTEX Admin or via Get Order API.
- Some order types (marketplace orders, already-invoiced orders) may have restrictions.

**Feed returns empty array**

- There are no pending events in the Feed queue.
- Place a new test order or check that the Feed filter includes `ready-for-handling`.
- If events were previously committed, they are no longer in the queue.
