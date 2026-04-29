# Deployment Guide — VTEX OMS to ERP Demo Console

---

## Prerequisites

- Node.js 24 or later (`node --version`)
- npm 10 or later
- A Vercel account (free tier is sufficient for demos)
- A GitHub account (for GitHub-to-Vercel integration, optional)

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VTEX_ACCOUNT=mystore
VTEX_ENVIRONMENT=vtexcommercestable.com.br
VTEX_APP_KEY=vtexappkey-mystore-XXXXXX
VTEX_APP_TOKEN=<your-app-token>
DEMO_HOOK_SECRET=my-local-secret
AUTO_COMMIT_FEED=false
SIMULATE_ERP_FAILURE=false
```

### 3. Run the development server

```bash
npm run dev
```

The app starts at [http://localhost:3000](http://localhost:3000).

Next.js hot reload is active. The in-memory store uses `globalThis` singletons to survive Fast Refresh module re-executions without losing state during development.

### 4. Verify the setup

Open [http://localhost:3000](http://localhost:3000). If the Configuration Panel shows "Credentials configured," the environment variables are loaded correctly.

Send a test hook event:

```bash
curl -X POST http://localhost:3000/api/vtex/hook \
  -H "Content-Type: application/json" \
  -H "x-demo-hook-secret: my-local-secret" \
  -d '{"orderId": "1234567890-01"}'
```

Expected response: `{"received":true,"orderId":"1234567890-01"}`

---

## Vercel Deployment

### Option A: Deploy with the Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Deploy (follow prompts to link to your Vercel account)
vercel

# Deploy to production
vercel --prod
```

### Option B: Deploy via GitHub integration (recommended)

1. Push your code to a GitHub repository.
2. Log in to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Select your GitHub repository.
4. Vercel auto-detects Next.js — leave the build settings as defaults.
5. Click **Deploy**.

Every push to the default branch automatically triggers a new deployment.

---

## Configuring Environment Variables in Vercel

After the initial deployment, set your environment variables in the Vercel dashboard:

1. Open your project in [vercel.com/dashboard](https://vercel.com/dashboard).
2. Go to **Settings** → **Environment Variables**.
3. Add each variable:

| Variable | Environment | Value |
|---|---|---|
| `VTEX_ACCOUNT` | Production, Preview | Your VTEX account name |
| `VTEX_ENVIRONMENT` | Production, Preview | `vtexcommercestable.com.br` |
| `VTEX_APP_KEY` | Production, Preview | Your App Key |
| `VTEX_APP_TOKEN` | Production, Preview | Your App Token |
| `DEMO_HOOK_SECRET` | Production, Preview | A strong random string |
| `AUTO_COMMIT_FEED` | Production, Preview | `false` |
| `SIMULATE_ERP_FAILURE` | Production, Preview | `false` |
| `NEXT_PUBLIC_APP_URL` | Production | `https://your-vercel-url.vercel.app` |

4. After adding variables, redeploy: go to **Deployments** → select the latest → **Redeploy**.

**Important:** Mark `VTEX_APP_TOKEN` and `DEMO_HOOK_SECRET` as **Sensitive** (Vercel will not show them in the dashboard after saving).

---

## Setting NEXT_PUBLIC_APP_URL

The dashboard Configuration Panel displays the hook endpoint URL. When running locally, the URL is inferred from `window.location.origin`. On Vercel preview deployments, the URL changes with each deployment.

Set `NEXT_PUBLIC_APP_URL` to ensure the displayed hook URL is always correct:

```env
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

For custom domains:

```env
NEXT_PUBLIC_APP_URL=https://erp-demo.yourdomain.com
```

---

## Configuring VTEX to Send Hooks to the Vercel URL

Once deployed, your hook endpoint is:

```
POST https://<your-vercel-url>/api/vtex/hook
```

See `docs/VTEX_SETUP.md` for step-by-step instructions to configure a VTEX Hook pointing to this URL.

---

## Cold Start Behavior

Vercel serverless functions can be recycled ("cold started") when idle. When a cold start occurs:

- The in-memory store is reset — all ERP Orders Inbox data is lost.
- Configuration overrides set via the UI are lost (env variables persist).
- The deduplication key set is reset (previously processed events may be re-processed if re-delivered).

**This is expected behavior for the demo.** The app is designed so that incoming hook events or a fresh Feed poll will repopulate the inbox.

For production use, replace the in-memory store with a persistent backend. See `docs/SDD.md` section 12 and the v0 Improvement Backlog.

---

## Custom Domain

To use a custom domain:

1. Go to your project in Vercel → **Settings** → **Domains**.
2. Add your domain and follow the DNS configuration instructions.
3. Update `NEXT_PUBLIC_APP_URL` and the VTEX Hook configuration to use the new domain.

---

## Build Verification

To verify the build locally before deploying:

```bash
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000) and confirm the app loads.

To run type checking independently:

```bash
npx tsc --noEmit
```

To run tests:

```bash
npm test
```

---

## Vercel Plan Considerations

The free Vercel Hobby plan is sufficient for demos:

- Serverless function execution time limit: 10 seconds (more than enough for a single Feed poll of 5 items).
- No persistent storage required for the demo.
- Bandwidth and request limits are generous for demo usage.

For production deployments with high event volume, a Vercel Pro plan provides increased limits and access to Vercel KV for persistent storage.
