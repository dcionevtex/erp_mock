# Backlog

## UI / Design

- [x] `BL-001` **Apply VTEX brand guidelines to the frontend**
  Apply the official VTEX brand design system (colors, typography, spacing, components) across the entire dashboard UI to make the demo feel native to the VTEX ecosystem.

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
