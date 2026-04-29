# Security Guide — VTEX OMS to ERP Demo Console

This document describes the security model of the demo application and provides a production hardening checklist. The app is intentionally an MVP demo and applies only lightweight security controls.

---

## 1. Credential Handling

### VTEX App Token

The VTEX App Token is the most sensitive credential. It grants OMS read/write access to your VTEX account.

**What the app does:**

- Reads `VTEX_APP_TOKEN` from `process.env` on the server side only.
- Stores it in a server-only memory object (`globalThis.__serverSecrets`) when updated via the Configuration Panel.
- Uses it only in the `buildHeaders()` function inside `src/lib/vtexClient.ts` (placed in HTTP request headers).
- Never serializes it to any type returned by API routes.
- Never logs it — not in info logs, not in error messages, not in timeline entries.
- The `AppConfigPublic` type (returned by `GET /api/config`) explicitly excludes `appToken`. Instead, it includes `appTokenConfigured: boolean`.
- The Configuration Panel does not render the token value after saving. The `<input type="password">` field is cleared after a successful save.

**What the app does NOT do:**

- Does not store the token in cookies, localStorage, or sessionStorage.
- Does not include the token in API responses.
- Does not log the token in any form (masked or otherwise).

### VTEX App Key

The App Key is less sensitive than the App Token (it is not a secret by itself) but is still kept server-side and not returned in API responses, following the same handling as the App Token.

### Demo Hook Secret

`DEMO_HOOK_SECRET` is used to validate incoming hook requests. It is:

- Read from `process.env` on the server.
- Never returned by any API endpoint.
- Compared using a direct string equality check (not timing-safe comparison — see production hardening below).

---

## 2. PII Masking

PII masking is applied at **ingestion time** in `src/lib/erpSimulator.ts` (via `src/lib/piiMasker.ts`). Masking happens before the data is stored in the in-memory store, so the raw VTEX order payload stored in `vtexOrderRaw` is always already masked.

### Masking rules

| Field | Masking | Example |
|---|---|---|
| Customer email | First character + `***` + `@domain` | `d***@vtex.com` |
| Customer document (CPF/CNPJ) | `***-` + last 2 digits | `***-09` |
| Customer phone | Always `(**) *****-****` | `(**) *****-****` |
| Shipping street | First 4 characters + `***` | `Rua ***` |
| Shipping receiver name | First word + ` ***` | `John ***` |

Other fields (city, state, postal code, country, neighborhood) are not masked as they are not considered sensitive for demo purposes.

### What is not masked

The ERP normalized payload (`erpPayload`) includes `customer.emailMasked` and `customer.documentMasked` — these are already masked strings, not original PII. The `name` field (first + last name) is included unmasked in the ERP payload, consistent with what a real ERP would need.

---

## 3. Hook Endpoint Security

### Demo hook secret

The hook endpoint (`POST /api/vtex/hook`) supports an optional shared secret via the `x-demo-hook-secret` header:

- If `DEMO_HOOK_SECRET` is not set (empty string), validation is disabled and all requests are accepted.
- If set, the header value must match exactly. Non-matching requests receive `403 Forbidden`.

**This is demo-grade security only.** It provides basic origin filtering but is not a replacement for cryptographic signature validation.

### Limitations of the demo secret approach

- The secret is a shared static string — it does not rotate.
- String comparison is not timing-safe (vulnerable to timing attacks in theory, negligible risk for a demo).
- There is no replay protection — an intercepted valid request can be resent.
- There is no request signing — the payload content is not authenticated, only the presence of the header value.

---

## 4. What This Demo Does NOT Implement

The following security controls are intentionally deferred as non-goals for the MVP. All of them are required before using this app in a production environment:

| Control | Status | Recommendation |
|---|---|---|
| HMAC-SHA256 webhook signature validation | Not implemented | Validate VTEX hook payloads using HMAC-SHA256. Store the signing key in an encrypted secret manager. |
| Encryption at rest | Not implemented | If persisting orders, encrypt the database. Use Vercel KV with encryption or a cloud database with encryption at rest enabled. |
| Rate limiting | Not implemented | Add per-IP rate limiting on `POST /api/vtex/hook` and `POST /api/vtex/feed/poll` to prevent abuse. |
| User authentication | Not implemented | Add OAuth (e.g., NextAuth.js) or session-based auth to protect the Configuration Panel and all API routes from unauthenticated access. |
| RBAC | Not implemented | Restrict configuration changes to admin roles; give read-only operators access to the order inbox only. |
| Audit log | Not implemented | Log all credential changes and pipeline actions with actor identity and timestamps in an immutable store. |
| Secrets management | Env variables only | Use a dedicated secrets manager (Vercel Encrypted Env Vars, AWS Secrets Manager, HashiCorp Vault) for production. |
| CORS policy | Default Next.js | Restrict CORS origins explicitly for production deployments. |
| Input sanitization | Basic type checks | Add schema validation (e.g., Zod) on all request bodies. |
| Timing-safe comparison | Not implemented | Replace string equality checks on secrets with `crypto.timingSafeEqual()`. |

---

## 5. Production Hardening Checklist

Use this checklist before deploying this app to a production or customer-facing environment:

**Credentials:**
- [ ] App Token is stored in an encrypted secrets manager, not in plaintext env vars.
- [ ] App Token has the minimum required VTEX permissions (OMS read + write, no broader access).
- [ ] App Key and Token are rotated on a schedule or immediately if compromised.
- [ ] `DEMO_HOOK_SECRET` is replaced with HMAC-SHA256 signature validation.

**Authentication and authorization:**
- [ ] Admin authentication is required to access the Configuration Panel.
- [ ] All `POST /api/erp/*` and `POST /api/vtex/*` routes require authentication.
- [ ] RBAC is implemented — operators cannot change credentials.

**Input validation:**
- [ ] All request bodies are validated with a schema library (e.g., Zod).
- [ ] The `orderId` path parameter is validated before use in store lookups.
- [ ] Timing-safe comparison is used for all secret comparisons.

**Infrastructure:**
- [ ] Rate limiting is applied on public-facing endpoints.
- [ ] CORS origins are restricted to known domains.
- [ ] In-memory store is replaced with a persistent, encrypted database.
- [ ] Vercel functions run in a private VPC if VTEX credentials are high-value.

**Observability:**
- [ ] Structured logging is enabled with correlation IDs.
- [ ] Alerts are configured for repeated `401`/`403` errors (credential misuse signals).
- [ ] An audit log records configuration changes with actor and timestamp.

**Operations:**
- [ ] A runbook exists for credential rotation.
- [ ] A runbook exists for responding to a leaked App Token.
- [ ] Dependency updates are automated (Dependabot or Renovate).
