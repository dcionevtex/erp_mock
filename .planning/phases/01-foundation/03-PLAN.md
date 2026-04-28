---
plan: 3
phase: 1
wave: 3
title: In-Memory Store, Constants, Env Config, and `.env.example`
depends_on: [1, 2]
files_modified:
  - src/lib/constants.ts
  - src/lib/config.ts
  - src/lib/store.ts
  - src/lib/__tests__/store.test.ts
  - src/lib/__tests__/config.test.ts
  - .env.example
requirements_addressed:
  - CONFIG-05
  - CONFIG-06
  - SEC-04
  - SEC-05
requirements:
  - CONFIG-05
  - CONFIG-06
  - SEC-04
  - SEC-05
autonomous: true
must_haves:
  truths:
    - "App reads VTEX credentials (account, environment, appKey, appToken) from `process.env` via `getServerConfig()` at runtime — CONFIG-06"
    - "`getPublicConfig()` returns `appTokenConfigured: boolean` and NEVER returns the raw token value — CONFIG-05, SEC-04"
    - "There is no `console.log(token)` or any code path that writes the app token to stdout/stderr — SEC-04"
    - "`.env.example` is committed at the project root with every required environment variable name and SAFE placeholder values — SEC-05"
    - "The in-memory store survives Next.js Fast Refresh in dev (uses `globalThis` guard per STACK.md) and exposes typed CRUD on `ErpOrderRecord`"
    - "All Vitest tests for store and config pass (`npm test` exit 0)"
  artifacts:
    - path: ".env.example"
      provides: "Committed template of every env var with safe placeholders — CONFIG-06, SEC-05"
      contains: "VTEX_APP_TOKEN="
    - path: "src/lib/constants.ts"
      provides: "VTEX endpoint paths, default environment, and re-exported status enums — referenced by vtexClient (Phase 2)"
      contains: "VTEX_DEFAULT_ENVIRONMENT"
    - path: "src/lib/config.ts"
      provides: "Server-side env reader with token-masking helpers — CONFIG-05, CONFIG-06, SEC-04"
      contains: "getServerConfig"
    - path: "src/lib/store.ts"
      provides: "globalThis-guarded in-memory store with typed CRUD on ErpOrderRecord, EventLogEntry, processed-key set, and AppConfig overrides"
      contains: "globalThis"
    - path: "src/lib/__tests__/store.test.ts"
      provides: "Tests proving CRUD behavior, sort-newest-first, and processed-key dedup"
      contains: "upsertOrder"
    - path: "src/lib/__tests__/config.test.ts"
      provides: "Tests proving getPublicConfig never returns the token and maskToken redacts correctly"
      contains: "appTokenConfigured"
  key_links:
    - from: "src/lib/store.ts"
      to: "src/types/index.ts"
      via: "import type { ErpOrderRecord, EventLogEntry, AppConfig } from '@/types'"
      pattern: "from '@/types'"
    - from: "src/lib/config.ts"
      to: "process.env"
      via: "getServerConfig() reads VTEX_ACCOUNT, VTEX_ENVIRONMENT, VTEX_APP_KEY, VTEX_APP_TOKEN"
      pattern: "process\\.env\\.VTEX_APP_TOKEN"
    - from: "src/lib/store.ts"
      to: "globalThis"
      via: "Fast-Refresh-safe singleton pattern"
      pattern: "globalThis\\.__erpStore"
---

# Plan 3: In-Memory Store, Constants, Env Config, and `.env.example`

## Objective
Implement the foundational state and configuration layer: VTEX endpoint constants, environment-variable reader (with token-masking), the `globalThis`-guarded in-memory store of `ErpOrderRecord`s, and the committed `.env.example`. This plan closes all four Phase 1 requirements: CONFIG-05, CONFIG-06, SEC-04, SEC-05.

## Context
- Stack/runtime constraints: c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/STACK.md (State / Storage section — globalThis pattern, Node runtime only)
- Pitfall avoidance: c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/PITFALLS.md (C4 cold-start awareness, S2 token leak, M5 strict mode)
- Architecture boundary: c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/ARCHITECTURE.md (store.ts module boundary, Persistence Seam)
- Project spec: c:/Users/USER/Desktop/Demos VTEX/oms_mock/CLAUDE.MD (sections 9, 19, 21, 25)

This plan depends on Plan 2 — it imports `ErpOrderRecord`, `EventLogEntry`, `AppConfig`, etc. from `@/types`. It does not implement any business logic (no normalization, no VTEX HTTP, no pipeline) — that lives in Phase 2.

The store interface defined here is THE persistence seam. When Vercel KV / Supabase replaces the in-memory Map in v2, only the bodies of these functions change.

## Tasks

### Task 3.1: Create `.env.example` and `src/lib/constants.ts`

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/CLAUDE.MD (sections 7, 9, 21)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.gitignore (confirm `.env.local` is ignored, `.env.example` is NOT)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/ARCHITECTURE.md (constants.ts boundary)
</read_first>

<action>
**File 1: `.env.example` at project root.** Create with EXACTLY this content (every variable from CLAUDE.MD §21, plus safe placeholder values, plus inline comments):

```
# VTEX OMS to ERP Demo Console — environment variables
# Copy this file to `.env.local` for local dev, or set these as Vercel Environment Variables for deployed environments.
# `.env.local` is gitignored — never commit real credentials.

# ----- VTEX credentials (required for live VTEX API calls) -----
# Account name — the subdomain in your VTEX URL: https://{account}.vtexcommercestable.com.br
VTEX_ACCOUNT=

# VTEX environment hostname. Use `vtexcommercestable.com.br` for stable production accounts.
# Alternative: `myvtex.com` for newer accounts.
VTEX_ENVIRONMENT=vtexcommercestable.com.br

# VTEX App Key (public identifier — looks like `vtexappkey-account-XXXXXX`)
VTEX_APP_KEY=

# VTEX App Token (SECRET — never commit this value, never log it).
# Required policies on the app key: OMS Full Access, Feed read/commit.
VTEX_APP_TOKEN=

# ----- Demo behavior toggles -----
# Optional shared secret for the Hook endpoint (`x-demo-hook-secret` header validation).
# Leave blank to disable secret validation (demo-only — not production-grade).
DEMO_HOOK_SECRET=

# Auto-commit feed handles after successful pipeline completion (`true` | `false`).
AUTO_COMMIT_FEED=false

# Toggle simulated ERP rejection (`true` makes simulator return FAILURE; `false` returns SUCCESS).
SIMULATE_ERP_FAILURE=false

# ----- Optional -----
# Public app URL — used to render the Hook URL in the UI (HOOK-05).
# Example: https://oms-mock.vercel.app
NEXT_PUBLIC_APP_URL=
```

Rules:
- Every variable name MUST match the names referenced in CLAUDE.MD §21 EXACTLY (`VTEX_ACCOUNT`, `VTEX_ENVIRONMENT`, `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `DEMO_HOOK_SECRET`, `AUTO_COMMIT_FEED`, `SIMULATE_ERP_FAILURE`, `NEXT_PUBLIC_APP_URL`).
- Placeholder values must be EMPTY (e.g., `VTEX_APP_TOKEN=`) for secrets, or a SAFE non-secret default (e.g., `VTEX_ENVIRONMENT=vtexcommercestable.com.br`).
- DO NOT include any real credential, even in comments.

**File 2: `src/lib/constants.ts`.** Create with EXACTLY this content:

```typescript
// src/lib/constants.ts
// VTEX endpoint paths and shared static constants.
// Centralizes endpoint shapes so a VTEX API version bump touches one file.

export const VTEX_DEFAULT_ENVIRONMENT = 'vtexcommercestable.com.br';

/**
 * Build the VTEX OMS base URL for a given account/environment.
 * Pure function — no side effects.
 */
export function buildVtexBaseUrl(account: string, environment: string): string {
  return `https://${account}.${environment}`;
}

/**
 * VTEX API path templates. Use these instead of inline strings so a version bump is a one-file change.
 * Each is a path (no host) — combine with `buildVtexBaseUrl(account, environment)`.
 */
export const VTEX_API_PATHS = {
  /** Get a single order by orderId. CLAUDE.MD §7. */
  getOrder: (orderId: string) => `/api/oms/pvt/orders/${encodeURIComponent(orderId)}`,
  /** Retrieve pending feed items. */
  feedItems: () => `/api/orders/feed`,
  /** Commit feed handles (acknowledge processed). */
  feedCommit: () => `/api/orders/feed`,
  /** Start handling for a given order. */
  startHandling: (orderId: string) => `/api/oms/pvt/orders/${encodeURIComponent(orderId)}/start-handling`,
} as const;

/** VTEX-required headers (token MUST come from server config — never hard-coded). */
export const VTEX_REQUIRED_HEADERS = {
  accept: 'application/json',
  contentType: 'application/json',
  appKeyHeader: 'X-VTEX-API-AppKey',
  appTokenHeader: 'X-VTEX-API-AppToken',
} as const;

/** Default polling interval for the dashboard (ms). Used by Phase 4 UI. */
export const DASHBOARD_POLL_INTERVAL_MS = 3000;

/** Maximum events processed per `POST /api/vtex/feed/poll` invocation (PITFALL M3). */
export const FEED_POLL_MAX_EVENTS = 5;

/** Re-export status string-literal arrays so UI dropdowns (Phase 4) can iterate them without re-declaring. */
export const ERP_STATUS_VALUES = [
  'RECEIVED',
  'PROCESSING',
  'ERP_ACCEPTED',
  'START_HANDLING_SUCCESS',
  'START_HANDLING_ERROR',
  'ERROR',
  'DUPLICATE_IGNORED',
  'MANUALLY_RESOLVED',
] as const;

export const INTEGRATION_SOURCE_VALUES = ['FEED', 'HOOK'] as const;

export const TIMELINE_STATUS_VALUES = ['SUCCESS', 'ERROR', 'INFO', 'SKIPPED'] as const;
```

Notes:
- The exact VTEX feed/start-handling path strings are documented in CLAUDE.MD §7 and the official VTEX docs link at the top of CLAUDE.MD. Phase 2 will refine these if the live VTEX API uses different paths.
- `as const` on the arrays gives narrow literal types compatible with `ErpStatus` etc. from `@/types`.
</action>

<acceptance_criteria>
- File `.env.example` exists at project root
- `grep -q "^VTEX_ACCOUNT=" .env.example` exits 0
- `grep -q "^VTEX_ENVIRONMENT=vtexcommercestable.com.br" .env.example` exits 0
- `grep -q "^VTEX_APP_KEY=" .env.example` exits 0
- `grep -q "^VTEX_APP_TOKEN=" .env.example` exits 0
- `grep -q "^DEMO_HOOK_SECRET=" .env.example` exits 0
- `grep -q "^AUTO_COMMIT_FEED=" .env.example` exits 0
- `grep -q "^SIMULATE_ERP_FAILURE=" .env.example` exits 0
- The line `VTEX_APP_TOKEN=` in `.env.example` has NO value after the `=` sign (empty placeholder)
- The line `VTEX_APP_KEY=` in `.env.example` has NO value after the `=` sign
- File `.env` does NOT exist at project root (real env file, never committed)
- File `src/lib/constants.ts` exists
- `grep -q "VTEX_DEFAULT_ENVIRONMENT" src/lib/constants.ts` exits 0
- `grep -q "VTEX_API_PATHS" src/lib/constants.ts` exits 0
- `grep -q "buildVtexBaseUrl" src/lib/constants.ts` exits 0
- `grep -q "ERP_STATUS_VALUES" src/lib/constants.ts` exits 0
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 3.2: Create `src/lib/config.ts` — env reader, token masking, public config builder

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/CLAUDE.MD (sections 9, 19, 21)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/index.ts (AppConfig, AppConfigPublic, IntegrationMode)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/constants.ts (VTEX_DEFAULT_ENVIRONMENT)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/PITFALLS.md (S2 — token leak)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/ARCHITECTURE.md (Config State subsection)
</read_first>

<action>
Create `src/lib/config.ts` with EXACTLY this content. This file is the only place in the codebase that reads VTEX_APP_TOKEN.

```typescript
// src/lib/config.ts
// Server-side configuration reader. Single source of truth for VTEX credentials and demo toggles.
//
// SECURITY (CONFIG-05, SEC-04):
//   - The app token is read here and stored in memory only.
//   - Never log it. Never return it from any API route. Never put it on a type that gets serialized to a client.
//   - Use `getPublicConfig()` to expose configuration to API responses or client code.

import type { AppConfig, AppConfigPublic, IntegrationMode } from '@/types';
import { VTEX_DEFAULT_ENVIRONMENT } from './constants';

// Internal-only: extends AppConfig with the secret token. NEVER export this type.
type ServerAppConfig = AppConfig & {
  appToken: string;
  demoHookSecret: string;
};

function readBoolEnv(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v.toLowerCase() === 'true' || v === '1';
}

function readIntegrationMode(): IntegrationMode {
  // Default to HOOK; if explicitly set to FEED, honor it.
  const v = process.env.INTEGRATION_MODE;
  return v === 'FEED' ? 'FEED' : 'HOOK';
}

/**
 * Read the full server-side config from process.env.
 * Includes the app token — for use ONLY by server-side modules (vtexClient, store).
 * Never call this from a client component or pass the result to a client.
 */
export function getServerConfig(): ServerAppConfig {
  return {
    account: process.env.VTEX_ACCOUNT ?? '',
    environment: process.env.VTEX_ENVIRONMENT ?? VTEX_DEFAULT_ENVIRONMENT,
    appKey: process.env.VTEX_APP_KEY ?? '',
    appToken: process.env.VTEX_APP_TOKEN ?? '',
    demoHookSecret: process.env.DEMO_HOOK_SECRET ?? '',
    integrationMode: readIntegrationMode(),
    autoCommitFeed: readBoolEnv('AUTO_COMMIT_FEED', false),
    simulateErpFailure: readBoolEnv('SIMULATE_ERP_FAILURE', false),
  };
}

/**
 * Build the public-safe config view returned by GET /api/config (Phase 4).
 * Strips appToken and demoHookSecret. Reports their configured-or-not state as booleans.
 */
export function getPublicConfig(serverConfig: ServerAppConfig = getServerConfig()): AppConfigPublic {
  const { appToken, demoHookSecret, ...rest } = serverConfig;
  return {
    ...rest,
    appTokenConfigured: appToken.length > 0,
  };
}

/**
 * Mask a token for safe display in error messages or audit logs.
 * Returns `'***'` for empty input, otherwise first 4 chars + `***` + last 2 chars.
 * NEVER use this to "log the token" — only for diagnostic UI strings.
 */
export function maskToken(token: string | undefined | null): string {
  if (!token) return '***';
  if (token.length <= 6) return '***';
  return `${token.slice(0, 4)}***${token.slice(-2)}`;
}

/**
 * Validate that all required VTEX credentials are present.
 * Returns a list of missing field names; empty list means fully configured.
 */
export function getMissingCredentials(cfg: ServerAppConfig = getServerConfig()): Array<keyof Pick<ServerAppConfig, 'account' | 'environment' | 'appKey' | 'appToken'>> {
  const missing: Array<keyof Pick<ServerAppConfig, 'account' | 'environment' | 'appKey' | 'appToken'>> = [];
  if (!cfg.account) missing.push('account');
  if (!cfg.environment) missing.push('environment');
  if (!cfg.appKey) missing.push('appKey');
  if (!cfg.appToken) missing.push('appToken');
  return missing;
}

/**
 * Demo-hook-secret check.
 * - If DEMO_HOOK_SECRET is unset (empty string), validation is disabled — return `true`.
 * - If set, the provided header value must match exactly.
 */
export function isHookSecretValid(providedHeader: string | null, cfg: ServerAppConfig = getServerConfig()): boolean {
  if (!cfg.demoHookSecret) return true;
  return providedHeader === cfg.demoHookSecret;
}
```

Hard rules — these are the SEC-04 / CONFIG-05 invariants:
- `console.log`, `console.info`, `console.warn`, `console.error`, `console.debug` MUST NOT appear ANYWHERE in this file. The file does not log. Period.
- The string `appToken` MUST NOT appear in any return value of `getPublicConfig` or `maskToken` (other than as a key being explicitly stripped).
- The internal `ServerAppConfig` type is NOT exported.
- `getServerConfig` is the single read site for `process.env.VTEX_APP_TOKEN`. Other modules import this function — they do NOT read `process.env.VTEX_APP_TOKEN` directly.
</action>

<acceptance_criteria>
- File `src/lib/config.ts` exists
- `grep -q "export function getServerConfig" src/lib/config.ts` exits 0
- `grep -q "export function getPublicConfig" src/lib/config.ts` exits 0
- `grep -q "export function maskToken" src/lib/config.ts` exits 0
- `grep -q "export function getMissingCredentials" src/lib/config.ts` exits 0
- `grep -q "export function isHookSecretValid" src/lib/config.ts` exits 0
- `grep -q "process.env.VTEX_APP_TOKEN" src/lib/config.ts` exits 0
- The internal `ServerAppConfig` type is NOT exported: `grep -E "^export (type|interface) ServerAppConfig" src/lib/config.ts` returns nothing (exit code 1)
- The file does NOT contain any `console.` call: `grep -E "console\\.(log|info|warn|error|debug)" src/lib/config.ts` returns nothing (exit code 1)
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 3.3: Create `src/lib/store.ts` — globalThis-guarded in-memory store with typed CRUD

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/STACK.md (State / Storage section — copy the globalThis pattern)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/ARCHITECTURE.md (store.ts boundary, persistence seam)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/research/PITFALLS.md (C3 — double-call guard, C4 — cold start, S5 — dedup key, M7 — PII masking applied at storage time)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/index.ts (ErpOrderRecord, EventLogEntry, ErpTimelineEntry, AppConfig)
</read_first>

<action>
Create `src/lib/store.ts` with EXACTLY this content. This is the persistence seam — every mutation goes through these functions.

```typescript
// src/lib/store.ts
// In-memory store (process-scoped) with `globalThis` guard for Next.js Fast Refresh compatibility.
//
// CRITICAL CONSTRAINTS:
//   - This module must run on the Node.js runtime ONLY, never the Edge runtime (Edge V8 isolates do not share state).
//   - All API routes that import from this module must NOT export `runtime = 'edge'`.
//   - State is lost on cold starts and is NOT shared across Vercel instances. Demo-only. (PITFALL C4)
//   - The interface defined here is THE persistence seam. Replacing the Map with Vercel KV / Supabase later
//     means swapping these function bodies — no caller changes.

import type {
  AppConfig,
  ErpOrderRecord,
  ErpStatus,
  ErpTimelineEntry,
  EventLogEntry,
  IntegrationMode,
} from '@/types';

// ---- globalThis singletons ----------------------------------------------
// Next.js Fast Refresh re-executes module code on save. Without `globalThis`, a module-level
// `new Map()` resets on every save. The guard ensures one instance per Node.js process.

declare global {
  // eslint-disable-next-line no-var
  var __erpStore: Map<string, ErpOrderRecord> | undefined;
  // eslint-disable-next-line no-var
  var __eventLog: EventLogEntry[] | undefined;
  // eslint-disable-next-line no-var
  var __processedKeys: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __configOverrides: Partial<AppConfig> | undefined;
}

const orders: Map<string, ErpOrderRecord> =
  globalThis.__erpStore ?? (globalThis.__erpStore = new Map<string, ErpOrderRecord>());

const eventLog: EventLogEntry[] =
  globalThis.__eventLog ?? (globalThis.__eventLog = []);

const processedKeys: Set<string> =
  globalThis.__processedKeys ?? (globalThis.__processedKeys = new Set<string>());

const configOverrides: Partial<AppConfig> =
  globalThis.__configOverrides ?? (globalThis.__configOverrides = {});

// ---- Order CRUD ----------------------------------------------------------

/** Insert or replace an order record (keyed by `id`). */
export function upsertOrder(record: ErpOrderRecord): ErpOrderRecord {
  orders.set(record.id, record);
  return record;
}

/** Get a single order by internal id. */
export function getOrder(id: string): ErpOrderRecord | undefined {
  return orders.get(id);
}

/** Find an order by VTEX orderId (most callers use this). */
export function getOrderByOrderId(orderId: string): ErpOrderRecord | undefined {
  for (const rec of orders.values()) {
    if (rec.orderId === orderId) return rec;
  }
  return undefined;
}

/** Return all orders sorted newest-first by `receivedAt` (INBOX-03). */
export function getAllOrders(): ErpOrderRecord[] {
  return Array.from(orders.values()).sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );
}

/** Update only the ERP status and `lastAttemptAt` of an existing order. No-op if not found. */
export function setOrderStatus(id: string, status: ErpStatus, lastAttemptAt?: string): ErpOrderRecord | undefined {
  const rec = orders.get(id);
  if (!rec) return undefined;
  const next: ErpOrderRecord = {
    ...rec,
    erpStatus: status,
    lastAttemptAt: lastAttemptAt ?? new Date().toISOString(),
  };
  orders.set(id, next);
  return next;
}

/** Append a single timeline entry to an order. No-op if not found. */
export function appendTimelineEntry(id: string, entry: ErpTimelineEntry): ErpOrderRecord | undefined {
  const rec = orders.get(id);
  if (!rec) return undefined;
  const next: ErpOrderRecord = { ...rec, timeline: [...rec.timeline, entry] };
  orders.set(id, next);
  return next;
}

/** Increment attempts counter and update lastAttemptAt. No-op if not found. */
export function incrementAttempts(id: string): ErpOrderRecord | undefined {
  const rec = orders.get(id);
  if (!rec) return undefined;
  const next: ErpOrderRecord = {
    ...rec,
    attempts: rec.attempts + 1,
    lastAttemptAt: new Date().toISOString(),
  };
  orders.set(id, next);
  return next;
}

/** Remove an order — used by tests / reset endpoints. Returns true if removed. */
export function deleteOrder(id: string): boolean {
  return orders.delete(id);
}

// ---- Event log -----------------------------------------------------------

export function appendEventLog(entry: EventLogEntry): void {
  eventLog.push(entry);
  // Cap log to a sane maximum to prevent unbounded growth in long demo sessions.
  if (eventLog.length > 1000) eventLog.splice(0, eventLog.length - 1000);
}

export function getEventLog(): EventLogEntry[] {
  // Return newest-first for UI consumption.
  return [...eventLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ---- Idempotency / dedup keys -------------------------------------------

export function hasProcessedKey(key: string): boolean {
  return processedKeys.has(key);
}

export function markProcessedKey(key: string): void {
  processedKeys.add(key);
  // Prevent unbounded growth.
  if (processedKeys.size > 5000) {
    const arr = Array.from(processedKeys);
    processedKeys.clear();
    for (const k of arr.slice(arr.length - 4000)) processedKeys.add(k);
  }
}

// ---- In-memory config overrides ----------------------------------------
// The Configuration Panel (Phase 4) writes to these overrides at runtime.
// At read time, the merge order is: env defaults <- in-memory overrides.

export function getConfigOverrides(): Partial<AppConfig> {
  return { ...configOverrides };
}

export function setConfigOverrides(partial: Partial<AppConfig>): Partial<AppConfig> {
  Object.assign(configOverrides, partial);
  return { ...configOverrides };
}

export function setIntegrationMode(mode: IntegrationMode): void {
  configOverrides.integrationMode = mode;
}

// ---- Test helpers (NOT for production routes) ---------------------------
// Only call these from test files. They are safe in production but expose internals.

export function __resetStoreForTests(): void {
  orders.clear();
  eventLog.length = 0;
  processedKeys.clear();
  for (const k of Object.keys(configOverrides)) {
    delete (configOverrides as Record<string, unknown>)[k];
  }
}

export function __getRawCounts() {
  return {
    orders: orders.size,
    eventLog: eventLog.length,
    processedKeys: processedKeys.size,
  };
}
```

Hard rules (will be enforced by the test in Task 3.4):
- No `console.*` calls in this file (SEC-04 — the store handles `vtexOrderRaw` payloads which may transit through env; never log them).
- No imports of `process.env` — the store knows nothing about credentials.
- No `runtime = 'edge'` exports.
- The `globalThis` guard MUST be present (proves Fast-Refresh safety per STACK.md).
</action>

<acceptance_criteria>
- File `src/lib/store.ts` exists
- `grep -q "globalThis.__erpStore" src/lib/store.ts` exits 0 (Fast-Refresh-safe singleton)
- `grep -q "export function upsertOrder" src/lib/store.ts` exits 0
- `grep -q "export function getOrder" src/lib/store.ts` exits 0
- `grep -q "export function getOrderByOrderId" src/lib/store.ts` exits 0
- `grep -q "export function getAllOrders" src/lib/store.ts` exits 0
- `grep -q "export function setOrderStatus" src/lib/store.ts` exits 0
- `grep -q "export function appendTimelineEntry" src/lib/store.ts` exits 0
- `grep -q "export function incrementAttempts" src/lib/store.ts` exits 0
- `grep -q "export function appendEventLog" src/lib/store.ts` exits 0
- `grep -q "export function getEventLog" src/lib/store.ts` exits 0
- `grep -q "export function hasProcessedKey" src/lib/store.ts` exits 0
- `grep -q "export function markProcessedKey" src/lib/store.ts` exits 0
- `grep -q "export function getConfigOverrides" src/lib/store.ts` exits 0
- `grep -q "export function setConfigOverrides" src/lib/store.ts` exits 0
- `grep -q "export function __resetStoreForTests" src/lib/store.ts` exits 0
- File contains literal `import type` from `@/types`: `grep -q "from '@/types'" src/lib/store.ts` exits 0
- File does NOT contain any `console.` call: `grep -E "console\\.(log|info|warn|error|debug)" src/lib/store.ts` returns nothing (exit 1)
- File does NOT contain `process.env`: `grep -q "process.env" src/lib/store.ts` returns exit code 1 (store reads no env)
- File does NOT contain `runtime` export literal: `grep -E "export const runtime" src/lib/store.ts` returns exit code 1
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 3.4: Add Vitest tests for store and config (must PROVE SEC-04 invariants)

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/store.ts
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/config.ts
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/vitest.config.ts
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/index.ts
</read_first>

<action>
**Test 1: `src/lib/__tests__/store.test.ts`.** EXACT content:

```typescript
// src/lib/__tests__/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  upsertOrder,
  getOrder,
  getOrderByOrderId,
  getAllOrders,
  setOrderStatus,
  appendTimelineEntry,
  incrementAttempts,
  deleteOrder,
  appendEventLog,
  getEventLog,
  hasProcessedKey,
  markProcessedKey,
  getConfigOverrides,
  setConfigOverrides,
  __resetStoreForTests,
  __getRawCounts,
} from '@/lib/store';
import type { ErpOrderRecord, EventLogEntry } from '@/types';

const baseRecord = (id: string, orderId: string, receivedAt: string): ErpOrderRecord => ({
  id,
  orderId,
  source: 'HOOK',
  erpStatus: 'RECEIVED',
  startHandlingStatus: 'NOT_STARTED',
  receivedAt,
  attempts: 0,
  timeline: [],
});

describe('store — order CRUD', () => {
  beforeEach(() => __resetStoreForTests());

  it('upsertOrder + getOrder roundtrip', () => {
    const rec = baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z');
    upsertOrder(rec);
    expect(getOrder('a')?.orderId).toBe('v1');
  });

  it('upsertOrder replaces existing record by id', () => {
    upsertOrder(baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'));
    upsertOrder({ ...baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'), erpStatus: 'PROCESSING' });
    expect(getOrder('a')?.erpStatus).toBe('PROCESSING');
    expect(__getRawCounts().orders).toBe(1);
  });

  it('getOrderByOrderId finds by VTEX orderId', () => {
    upsertOrder(baseRecord('a', 'v-find', '2026-04-28T00:00:00.000Z'));
    expect(getOrderByOrderId('v-find')?.id).toBe('a');
    expect(getOrderByOrderId('missing')).toBeUndefined();
  });

  it('getAllOrders returns newest-first by receivedAt (INBOX-03)', () => {
    upsertOrder(baseRecord('old', 'v-old', '2026-04-01T00:00:00.000Z'));
    upsertOrder(baseRecord('new', 'v-new', '2026-04-28T00:00:00.000Z'));
    upsertOrder(baseRecord('mid', 'v-mid', '2026-04-15T00:00:00.000Z'));
    const ids = getAllOrders().map((r) => r.id);
    expect(ids).toEqual(['new', 'mid', 'old']);
  });

  it('setOrderStatus updates erpStatus and lastAttemptAt', () => {
    upsertOrder(baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'));
    const updated = setOrderStatus('a', 'ERP_ACCEPTED', '2026-04-28T01:00:00.000Z');
    expect(updated?.erpStatus).toBe('ERP_ACCEPTED');
    expect(updated?.lastAttemptAt).toBe('2026-04-28T01:00:00.000Z');
  });

  it('setOrderStatus on missing id is a no-op', () => {
    expect(setOrderStatus('missing', 'ERROR')).toBeUndefined();
  });

  it('appendTimelineEntry appends to timeline', () => {
    upsertOrder(baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'));
    appendTimelineEntry('a', { timestamp: 't1', step: 'EVENT_RECEIVED', status: 'SUCCESS' });
    appendTimelineEntry('a', { timestamp: 't2', step: 'GET_ORDER_REQUESTED', status: 'INFO' });
    expect(getOrder('a')?.timeline).toHaveLength(2);
    expect(getOrder('a')?.timeline[1]?.step).toBe('GET_ORDER_REQUESTED');
  });

  it('incrementAttempts increments and updates lastAttemptAt', () => {
    upsertOrder(baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'));
    incrementAttempts('a');
    incrementAttempts('a');
    const rec = getOrder('a');
    expect(rec?.attempts).toBe(2);
    expect(rec?.lastAttemptAt).toBeDefined();
  });

  it('deleteOrder removes the record and returns true', () => {
    upsertOrder(baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'));
    expect(deleteOrder('a')).toBe(true);
    expect(getOrder('a')).toBeUndefined();
    expect(deleteOrder('a')).toBe(false);
  });
});

describe('store — event log', () => {
  beforeEach(() => __resetStoreForTests());

  it('appendEventLog + getEventLog returns newest-first', () => {
    const e1: EventLogEntry = { timestamp: '2026-04-28T00:00:00.000Z', source: 'HOOK', level: 'INFO', message: 'first' };
    const e2: EventLogEntry = { timestamp: '2026-04-28T01:00:00.000Z', source: 'FEED', level: 'INFO', message: 'second' };
    appendEventLog(e1);
    appendEventLog(e2);
    const log = getEventLog();
    expect(log).toHaveLength(2);
    expect(log[0]?.message).toBe('second');
    expect(log[1]?.message).toBe('first');
  });

  it('event log caps at 1000 entries', () => {
    for (let i = 0; i < 1100; i++) {
      appendEventLog({ timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(), source: 'SYSTEM', level: 'INFO', message: `m${i}` });
    }
    expect(__getRawCounts().eventLog).toBe(1000);
  });
});

describe('store — dedup keys', () => {
  beforeEach(() => __resetStoreForTests());

  it('hasProcessedKey returns false for unseen key', () => {
    expect(hasProcessedKey('k1')).toBe(false);
  });

  it('markProcessedKey + hasProcessedKey roundtrip', () => {
    markProcessedKey('k1');
    expect(hasProcessedKey('k1')).toBe(true);
  });

  it('processed-key set is bounded', () => {
    for (let i = 0; i < 5500; i++) markProcessedKey(`k${i}`);
    expect(__getRawCounts().processedKeys).toBeLessThanOrEqual(5000);
  });
});

describe('store — config overrides', () => {
  beforeEach(() => __resetStoreForTests());

  it('starts empty', () => {
    expect(getConfigOverrides()).toEqual({});
  });

  it('setConfigOverrides merges partial overrides', () => {
    setConfigOverrides({ account: 'demo' });
    setConfigOverrides({ simulateErpFailure: true });
    expect(getConfigOverrides()).toEqual({ account: 'demo', simulateErpFailure: true });
  });
});
```

**Test 2: `src/lib/__tests__/config.test.ts`.** EXACT content:

```typescript
// src/lib/__tests__/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getServerConfig,
  getPublicConfig,
  maskToken,
  getMissingCredentials,
  isHookSecretValid,
} from '@/lib/config';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.VTEX_ACCOUNT;
  delete process.env.VTEX_ENVIRONMENT;
  delete process.env.VTEX_APP_KEY;
  delete process.env.VTEX_APP_TOKEN;
  delete process.env.DEMO_HOOK_SECRET;
  delete process.env.AUTO_COMMIT_FEED;
  delete process.env.SIMULATE_ERP_FAILURE;
  delete process.env.INTEGRATION_MODE;
}

describe('config — getServerConfig', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('reads from process.env', () => {
    process.env.VTEX_ACCOUNT = 'demoacct';
    process.env.VTEX_APP_KEY = 'k';
    process.env.VTEX_APP_TOKEN = 'super-secret-token-value';
    const cfg = getServerConfig();
    expect(cfg.account).toBe('demoacct');
    expect(cfg.appKey).toBe('k');
    expect(cfg.appToken).toBe('super-secret-token-value');
  });

  it('defaults environment to vtexcommercestable.com.br', () => {
    expect(getServerConfig().environment).toBe('vtexcommercestable.com.br');
  });

  it('defaults autoCommitFeed and simulateErpFailure to false', () => {
    const cfg = getServerConfig();
    expect(cfg.autoCommitFeed).toBe(false);
    expect(cfg.simulateErpFailure).toBe(false);
  });

  it('parses AUTO_COMMIT_FEED=true correctly', () => {
    process.env.AUTO_COMMIT_FEED = 'true';
    expect(getServerConfig().autoCommitFeed).toBe(true);
  });

  it('parses SIMULATE_ERP_FAILURE=1 correctly', () => {
    process.env.SIMULATE_ERP_FAILURE = '1';
    expect(getServerConfig().simulateErpFailure).toBe(true);
  });

  it('honors INTEGRATION_MODE=FEED', () => {
    process.env.INTEGRATION_MODE = 'FEED';
    expect(getServerConfig().integrationMode).toBe('FEED');
  });

  it('defaults integrationMode to HOOK', () => {
    expect(getServerConfig().integrationMode).toBe('HOOK');
  });
});

describe('config — getPublicConfig (CONFIG-05, SEC-04 GUARD)', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('returns appTokenConfigured=false when token is empty', () => {
    const pub = getPublicConfig();
    expect(pub.appTokenConfigured).toBe(false);
    // The literal token field must NOT exist on the public config.
    expect((pub as Record<string, unknown>).appToken).toBeUndefined();
  });

  it('returns appTokenConfigured=true when token is set', () => {
    process.env.VTEX_APP_TOKEN = 'secret-token-value';
    const pub = getPublicConfig();
    expect(pub.appTokenConfigured).toBe(true);
    expect((pub as Record<string, unknown>).appToken).toBeUndefined();
  });

  it('JSON-serialized public config never contains the token value', () => {
    process.env.VTEX_APP_TOKEN = 'this-must-never-appear';
    const json = JSON.stringify(getPublicConfig());
    expect(json).not.toContain('this-must-never-appear');
    expect(json).not.toContain('appToken');
  });

  it('JSON-serialized public config never contains the demo-hook-secret', () => {
    process.env.DEMO_HOOK_SECRET = 'hidden-hook-secret';
    const json = JSON.stringify(getPublicConfig());
    expect(json).not.toContain('hidden-hook-secret');
    expect(json).not.toContain('demoHookSecret');
  });
});

describe('config — maskToken', () => {
  it('returns *** for empty input', () => {
    expect(maskToken(undefined)).toBe('***');
    expect(maskToken(null)).toBe('***');
    expect(maskToken('')).toBe('***');
  });

  it('returns *** for short tokens (<= 6 chars)', () => {
    expect(maskToken('abc')).toBe('***');
    expect(maskToken('abcdef')).toBe('***');
  });

  it('returns first4 + *** + last2 for long tokens', () => {
    expect(maskToken('1234567890')).toBe('1234***90');
  });
});

describe('config — getMissingCredentials', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('reports all four missing on empty env', () => {
    // environment defaults to vtexcommercestable.com.br so it is never missing.
    const missing = getMissingCredentials();
    expect(missing).toContain('account');
    expect(missing).toContain('appKey');
    expect(missing).toContain('appToken');
  });

  it('reports empty array when fully configured', () => {
    process.env.VTEX_ACCOUNT = 'a';
    process.env.VTEX_APP_KEY = 'k';
    process.env.VTEX_APP_TOKEN = 't';
    expect(getMissingCredentials()).toEqual([]);
  });
});

describe('config — isHookSecretValid', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('returns true when DEMO_HOOK_SECRET is unset (validation disabled)', () => {
    expect(isHookSecretValid('anything')).toBe(true);
    expect(isHookSecretValid(null)).toBe(true);
  });

  it('returns true when header matches secret', () => {
    process.env.DEMO_HOOK_SECRET = 'open-sesame';
    expect(isHookSecretValid('open-sesame')).toBe(true);
  });

  it('returns false when header is missing or wrong', () => {
    process.env.DEMO_HOOK_SECRET = 'open-sesame';
    expect(isHookSecretValid('wrong')).toBe(false);
    expect(isHookSecretValid(null)).toBe(false);
  });
});
```

Then run `npm test`. Both test files must pass and report >= 25 total new tests in addition to the existing smoke test and types tests from Plans 1 and 2.

After the tests pass, run a final invariant grep across the source to confirm SEC-04: no code path logs the token name.

```bash
grep -rE "console\\.(log|info|warn|error|debug)\\([^)]*VTEX_APP_TOKEN" src/
grep -rE "console\\.(log|info|warn|error|debug)\\([^)]*appToken" src/
```

Both commands MUST exit non-zero (no matches) — that is the SEC-04 grep guard.
</action>

<acceptance_criteria>
- File `src/lib/__tests__/store.test.ts` exists
- File `src/lib/__tests__/config.test.ts` exists
- `grep -q "upsertOrder" src/lib/__tests__/store.test.ts` exits 0
- `grep -q "getOrderByOrderId" src/lib/__tests__/store.test.ts` exits 0
- `grep -q "newest-first" src/lib/__tests__/store.test.ts` exits 0 (the INBOX-03 sort test)
- `grep -q "appTokenConfigured" src/lib/__tests__/config.test.ts` exits 0
- `grep -q "this-must-never-appear" src/lib/__tests__/config.test.ts` exits 0 (the SEC-04 guard test)
- `grep -q "maskToken" src/lib/__tests__/config.test.ts` exits 0
- Command `npm test` exits 0
- `npm test` stdout contains the substring `store — order CRUD`
- `npm test` stdout contains the substring `config — getPublicConfig`
- `npm test` reports at least 25 passing tests in total
- Command `grep -rE "console\\.(log|info|warn|error|debug)\\([^)]*VTEX_APP_TOKEN" src/` returns exit code 1 (no matches — SEC-04 guard)
- Command `grep -rE "console\\.(log|info|warn|error|debug)\\([^)]*appToken" src/` returns exit code 1 (no matches — SEC-04 guard)
- Command `npm run build` exits 0 (full type-check + production build)
</acceptance_criteria>

---

## Verification

### Must-Haves (phase goal requires these)
- [ ] `.env.example` exists at project root with all CLAUDE.MD §21 variables (CONFIG-06, SEC-05) — Task 3.1
- [ ] `getServerConfig()` reads VTEX credentials from `process.env` (CONFIG-06) — Task 3.2 + tests
- [ ] `getPublicConfig()` returns `appTokenConfigured: boolean`, never the raw token (CONFIG-05) — Task 3.4 JSON-serialization test
- [ ] No `console.*(... appToken ...)` or `console.*(... VTEX_APP_TOKEN ...)` anywhere in `src/` (SEC-04) — Task 3.4 grep guard
- [ ] In-memory store is `globalThis`-guarded and exposes typed CRUD on `ErpOrderRecord` — Task 3.3
- [ ] Newest-first sort is enforced by `getAllOrders` (INBOX-03 contract) — Task 3.4 test
- [ ] All store and config tests pass (`npm test` exits 0) — Task 3.4
- [ ] `npm run build` exits 0 (the entire foundation compiles end-to-end) — Task 3.4 final check

### Should-Haves
- [ ] Store provides a `__resetStoreForTests` helper used by future Phase 2 tests (cleanly resets state between tests)
- [ ] Event log is bounded at 1000 entries to prevent runaway memory in long demos
- [ ] Processed-key set is bounded at 5000 entries
- [ ] Config overrides type uses `Partial<AppConfig>` so the Phase 4 config UI can update incrementally
- [ ] No file in `src/lib/` exports `runtime = 'edge'` (Edge runtime would break the in-memory singleton — STACK.md / PITFALL C4)
