---
plan: 2
phase: 2
wave: 2
title: VTEX Client and Hook Payload Parser
depends_on:
  - 1
files_modified:
  - src/lib/vtexClient.ts
  - src/lib/hookParser.ts
  - src/lib/__tests__/vtexClient.test.ts
  - src/lib/__tests__/hookParser.test.ts
requirements_addressed:
  - PIPE-01
  - TEST-03
autonomous: true
must_haves:
  truths:
    - "createVtexClient(config, fetcher?) returns an object with getOrder, getFeedItems, commitFeedItems, startHandling methods"
    - "createVtexClient never reads process.env or calls getServerConfig() — it accepts config as a parameter"
    - "getOrder calls fetch with URL https://{account}.{environment}/api/oms/pvt/orders/{orderId} and X-VTEX-API-AppKey + X-VTEX-API-AppToken headers"
    - "Non-2xx responses throw VtexApiError with status, statusText, body, url — never the appToken"
    - "204 No Content responses resolve with undefined (not throw, not parse JSON)"
    - "startHandling sends POST with empty {} body and Content-Type: application/json (PITFALL M6)"
    - "commitFeedItems with empty handles array returns without making any HTTP call"
    - "getFeedItems normalizes both raw-array and {events:[]} wrapper response shapes"
    - "extractOrderId from VtexHookPayload supports orderId, OrderId, order.orderId, data.orderId, data.OrderId"
  artifacts:
    - path: "src/lib/vtexClient.ts"
      provides: "createVtexClient factory + VtexClient interface + VtexApiError class + VtexClientConfig type"
      exports: ["createVtexClient", "VtexClient", "VtexClientConfig", "VtexApiError", "VtexFetcher"]
    - path: "src/lib/hookParser.ts"
      provides: "extractOrderId for VtexHookPayload covering all known shapes (HOOK-02 prep)"
      exports: ["extractOrderId"]
    - path: "src/lib/__tests__/vtexClient.test.ts"
      provides: "Vitest suite using vi.fn() injected fetcher (PIPE-01 verification)"
    - path: "src/lib/__tests__/hookParser.test.ts"
      provides: "Vitest suite for TEST-03 (multiple payload shapes)"
  key_links:
    - from: "src/lib/vtexClient.ts"
      to: "src/lib/constants.ts"
      via: "imports buildVtexBaseUrl, VTEX_API_PATHS, VTEX_REQUIRED_HEADERS"
      pattern: "from ['\"]@/lib/constants['\"]"
    - from: "src/lib/vtexClient.ts"
      to: "VtexApiError"
      via: "throws on non-2xx with no token in message"
      pattern: "throw new VtexApiError"
    - from: "src/lib/__tests__/vtexClient.test.ts"
      to: "vi.fn"
      via: "injected fetcher mock"
      pattern: "vi\\.fn"
---

# Plan 2: VTEX Client and Hook Payload Parser

## Objective

Implement the VTEX HTTP client as an injectable factory (`createVtexClient(config, fetcher?)`) so tests pass `vi.fn()` mocks instead of stubbing global fetch — and a tiny pure helper `extractOrderId` that handles all known VTEX hook payload shapes. Wave 2 because Wave 1's type changes to `VtexFeedItem` are consumed here.

## Tasks

### Task 2.1: Implement vtexClient.ts factory with injectable fetcher + tests

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/constants.ts (VTEX_API_PATHS, buildVtexBaseUrl, VTEX_REQUIRED_HEADERS)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/vtex.ts (VtexOrder, VtexFeedItem, VtexApiErrorShape, VtexStartHandlingResponse)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/phases/02-core-library-modules/02-RESEARCH.md (Module 4: vtexClient.ts section, Pitfalls 2 + 5)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/lib/config.ts (pattern reference — config-as-parameter)
</read_first>

<action>
Create `src/lib/vtexClient.ts` with the EXACT contract below. The factory accepts an optional `fetcher` parameter that defaults to `globalThis.fetch` so tests can inject `vi.fn()` without `vi.stubGlobal`.

**CRITICAL constraints:**
- Do NOT call `getServerConfig()` inside this module. Config flows in via the `config` parameter.
- The `appToken` MUST never appear in any thrown error message, log, or response body. Only `status`, `statusText`, `body`, and `url` are exposed via `VtexApiError`.
- Use `VTEX_API_PATHS` and `VTEX_REQUIRED_HEADERS` from `@/lib/constants` — do not inline path strings.

```typescript
// src/lib/vtexClient.ts
// VTEX HTTP client. Pure dependency injection — accepts config + optional fetcher.
// SECURITY: appToken is in headers only. Never logged. Never in error messages.

import type { VtexOrder, VtexFeedItem, VtexApiErrorShape } from '@/types/vtex';
import {
  buildVtexBaseUrl,
  VTEX_API_PATHS,
  VTEX_REQUIRED_HEADERS,
} from '@/lib/constants';

/**
 * Typed error thrown on non-2xx responses.
 * Message format: "VTEX API error {status} on {url}" — never includes credentials.
 */
export class VtexApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly url: string;

  constructor(shape: VtexApiErrorShape) {
    super(`VTEX API error ${shape.status} on ${shape.url}`);
    this.name = 'VtexApiError';
    this.status = shape.status;
    this.statusText = shape.statusText ?? '';
    this.body = shape.body;
    this.url = shape.url;
  }
}

export interface VtexClientConfig {
  account: string;
  environment: string;
  appKey: string;
  appToken: string;
}

/** Function-shape compatible with global fetch — the only HTTP surface this module needs. */
export type VtexFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface VtexClient {
  getOrder(orderId: string): Promise<VtexOrder>;
  getFeedItems(maxLot?: number): Promise<VtexFeedItem[]>;
  commitFeedItems(handles: string[]): Promise<void>;
  startHandling(orderId: string): Promise<void>;
}

/**
 * Create a VtexClient bound to a config and optional fetcher.
 * Tests pass a vi.fn() as the fetcher to assert URL/headers/body without network.
 */
export function createVtexClient(
  config: VtexClientConfig,
  fetcher: VtexFetcher = globalThis.fetch.bind(globalThis),
): VtexClient {
  const baseUrl = buildVtexBaseUrl(config.account, config.environment);

  function buildHeaders(): Record<string, string> {
    return {
      [VTEX_REQUIRED_HEADERS.appKeyHeader]: config.appKey,
      [VTEX_REQUIRED_HEADERS.appTokenHeader]: config.appToken,
      Accept: VTEX_REQUIRED_HEADERS.accept,
      'Content-Type': VTEX_REQUIRED_HEADERS.contentType,
    };
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const res = await fetcher(url, {
      method,
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        try {
          errorBody = await res.text();
        } catch {
          errorBody = null;
        }
      }
      throw new VtexApiError({
        status: res.status,
        statusText: res.statusText,
        body: errorBody,
        url,
      });
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    async getOrder(orderId) {
      return request<VtexOrder>('GET', VTEX_API_PATHS.getOrder(orderId));
    },
    async getFeedItems(maxLot = 10) {
      const path = `${VTEX_API_PATHS.feedItems()}?maxLot=${maxLot}`;
      const data = await request<unknown>('GET', path);
      // Defensive: VTEX may return a raw array or { events: [...] } wrapper
      if (Array.isArray(data)) return data as VtexFeedItem[];
      if (data && typeof data === 'object' && Array.isArray((data as { events?: unknown }).events)) {
        return ((data as { events: unknown[] }).events) as VtexFeedItem[];
      }
      return [];
    },
    async commitFeedItems(handles) {
      if (handles.length === 0) return; // Skip empty commit (PITFALL: VTEX may 400 on empty body)
      await request<void>('POST', VTEX_API_PATHS.feedCommit(), { handles });
    },
    async startHandling(orderId) {
      // Empty body {} required — Content-Type: application/json must still be set (PITFALL M6)
      await request<void>('POST', VTEX_API_PATHS.startHandling(orderId), {});
    },
  };
}
```

Then create `src/lib/__tests__/vtexClient.test.ts`. The test pattern is **inject a `vi.fn()` fetcher**, never `vi.stubGlobal`.

**Helper at top of test file:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createVtexClient,
  VtexApiError,
  type VtexClientConfig,
  type VtexFetcher,
} from '@/lib/vtexClient';

const TEST_CONFIG: VtexClientConfig = {
  account: 'demoacct',
  environment: 'vtexcommercestable.com.br',
  appKey: 'test-key',
  appToken: 'SECRET-TOKEN-MUST-NEVER-LEAK',
};

function makeResponse(opts: {
  status?: number;
  ok?: boolean;
  statusText?: string;
  body?: unknown;
}): Response {
  const status = opts.status ?? 200;
  const ok = opts.ok ?? status >= 200 && status < 300;
  return {
    status,
    statusText: opts.statusText ?? '',
    ok,
    json: async () => opts.body,
    text: async () => (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body ?? '')),
  } as unknown as Response;
}
```

**Test groups (every group MUST be present):**

1. `describe('createVtexClient.getOrder')`:
   - `it('calls fetch with the correct URL for an orderId')` — assert `fetcher.mock.calls[0][0] === 'https://demoacct.vtexcommercestable.com.br/api/oms/pvt/orders/o-123'`
   - `it('sends X-VTEX-API-AppKey and X-VTEX-API-AppToken headers')` — assert headers object includes both
   - `it('sends Accept and Content-Type as application/json')`
   - `it('returns the parsed VtexOrder body on 200')`
   - `it('throws VtexApiError on 404 with status 404 and no token in message')` — assert error is `VtexApiError`, `error.status === 404`, `error.message` does NOT contain `'SECRET-TOKEN-MUST-NEVER-LEAK'`
   - `it('throws VtexApiError on 401 with no token in message')`
   - `it('throws VtexApiError on 429 with no token in message')`
   - `it('URL-encodes special characters in orderId')` — input `'a/b'` produces `'a%2Fb'` in URL

2. `describe('createVtexClient.startHandling')`:
   - `it('sends POST with empty body {} JSON-stringified')` — assert `init.body === '{}'`
   - `it('sets Content-Type: application/json even on empty body (PITFALL M6)')`
   - `it('uses correct path /api/oms/pvt/orders/{id}/start-handling')`
   - `it('resolves on 204 No Content without parsing JSON')` — assert no throw and resolves
   - `it('resolves on 200 with body')` — assert no throw
   - `it('throws VtexApiError on 4xx')`

3. `describe('createVtexClient.getFeedItems')`:
   - `it('uses /api/orders/feed?maxLot=10 by default')`
   - `it('honors a custom maxLot parameter')` — pass `5`, assert URL includes `maxLot=5`
   - `it('returns array as-is when response is a raw array')`
   - `it('extracts events array when response is wrapped { events: [...] }')`
   - `it('returns empty array on unexpected shape')` — body `{}` returns `[]`

4. `describe('createVtexClient.commitFeedItems')`:
   - `it('makes NO HTTP call when handles array is empty')` — assert `fetcher.mock.calls.length === 0`
   - `it('POSTs { handles } to /api/orders/feed when handles non-empty')` — assert body parses to `{ handles: [...] }`

5. `describe('VtexApiError safety')`:
   - `it('does not include appToken in toString()')`
   - `it('exposes status, statusText, body, url as readonly properties')`

Use `beforeEach(() => { vi.clearAllMocks(); })`.
</action>

<acceptance_criteria>
- File `src/lib/vtexClient.ts` exists
- `grep -E "^export function createVtexClient" src/lib/vtexClient.ts` returns 1 match
- `grep -E "^export class VtexApiError" src/lib/vtexClient.ts` returns 1 match
- `grep -E "^export interface VtexClient[^C]" src/lib/vtexClient.ts` returns 1 match (VtexClient, not VtexClientConfig)
- `grep -E "^export interface VtexClientConfig" src/lib/vtexClient.ts` returns 1 match
- `grep -E "^export type VtexFetcher" src/lib/vtexClient.ts` returns 1 match
- `grep -E "fetcher: VtexFetcher = globalThis\\.fetch" src/lib/vtexClient.ts` returns 1 match (default param)
- `grep -E "process\\.env" src/lib/vtexClient.ts` returns 0 matches (NEVER reads env)
- `grep -E "getServerConfig" src/lib/vtexClient.ts` returns 0 matches (NEVER calls config)
- `grep -E "VTEX_API_PATHS" src/lib/vtexClient.ts` returns at least 4 matches (one per endpoint)
- File `src/lib/__tests__/vtexClient.test.ts` exists
- `grep -c "describe\\(" src/lib/__tests__/vtexClient.test.ts` returns at least 5
- `npx vitest run src/lib/__tests__/vtexClient.test.ts --reporter=verbose` passes (exit code 0) with at least 20 passing tests
- `npx tsc --noEmit` passes with zero errors
</acceptance_criteria>

---

### Task 2.2: Implement hookParser.ts extractOrderId + tests (TEST-03)

<read_first>
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/src/types/vtex.ts (VtexHookPayload — note all paths where orderId may appear)
- c:/Users/USER/Desktop/Demos VTEX/oms_mock/.planning/phases/02-core-library-modules/02-RESEARCH.md (TEST-03 context)
</read_first>

<action>
Create `src/lib/hookParser.ts`. This is a tiny pure module — one exported function, zero dependencies beyond types. It exists in Wave 2 (rather than Wave 1) because the TEST-03 unit tests directly cover hook-specific logic, and downstream Plan 4 (orderProcessor) will reuse it.

```typescript
// src/lib/hookParser.ts
// Hook payload parsing — VTEX delivers orderId at multiple paths (PITFALL C6).
// Pure function, exhaustive over the known shapes documented in VtexHookPayload.

import type { VtexHookPayload } from '@/types/vtex';

/**
 * Extract orderId from a VTEX hook payload.
 * Tries (in order):
 *   payload.orderId
 *   payload.OrderId        (case variation observed in some VTEX events)
 *   payload.order?.orderId
 *   payload.order?.OrderId
 *   payload.data?.orderId
 *   payload.data?.OrderId
 * Returns undefined if none are non-empty strings.
 */
export function extractOrderId(payload: VtexHookPayload | null | undefined): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;

  const candidates: Array<unknown> = [
    payload.orderId,
    payload.OrderId,
    payload.order?.orderId,
    payload.order?.OrderId,
    payload.data?.orderId,
    payload.data?.OrderId,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return undefined;
}
```

Then create `src/lib/__tests__/hookParser.test.ts` covering all six payload shapes plus edge cases:

```typescript
import { describe, it, expect } from 'vitest';
import { extractOrderId } from '@/lib/hookParser';

describe('extractOrderId', () => {
  it('extracts from top-level orderId', () => {
    expect(extractOrderId({ orderId: 'o-1' })).toBe('o-1');
  });

  it('extracts from top-level OrderId (capitalized)', () => {
    expect(extractOrderId({ OrderId: 'o-2' })).toBe('o-2');
  });

  it('extracts from nested order.orderId', () => {
    expect(extractOrderId({ order: { orderId: 'o-3' } })).toBe('o-3');
  });

  it('extracts from nested order.OrderId', () => {
    expect(extractOrderId({ order: { OrderId: 'o-4' } })).toBe('o-4');
  });

  it('extracts from nested data.orderId', () => {
    expect(extractOrderId({ data: { orderId: 'o-5' } })).toBe('o-5');
  });

  it('extracts from nested data.OrderId', () => {
    expect(extractOrderId({ data: { OrderId: 'o-6' } })).toBe('o-6');
  });

  it('prefers top-level orderId over nested values', () => {
    expect(extractOrderId({ orderId: 'top', order: { orderId: 'nested' } })).toBe('top');
  });

  it('returns undefined for null', () => {
    expect(extractOrderId(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(extractOrderId(undefined)).toBeUndefined();
  });

  it('returns undefined for empty object', () => {
    expect(extractOrderId({})).toBeUndefined();
  });

  it('returns undefined when orderId is empty string', () => {
    expect(extractOrderId({ orderId: '' })).toBeUndefined();
  });

  it('returns undefined when orderId is non-string', () => {
    expect(extractOrderId({ orderId: 12345 as unknown as string })).toBeUndefined();
  });

  it('handles realistic VTEX hook envelope shape', () => {
    const realistic = {
      State: 'ready-for-handling',
      OrderId: 'v69305315atmc-01',
      Domain: 'Marketplace',
      LastState: 'payment-approved',
      LastChange: '2020-07-13T20:25:13.2304508Z',
    } as unknown as VtexHookPayload;
    expect(extractOrderId(realistic)).toBe('v69305315atmc-01');
  });
});
```

Note: `VtexHookPayload` already has the `[key: string]: unknown` index signature so the realistic example with `State`, `Domain`, etc. type-checks via the indexer.
</action>

<acceptance_criteria>
- File `src/lib/hookParser.ts` exists
- `grep -E "^export function extractOrderId" src/lib/hookParser.ts` returns 1 match
- `grep -E "from ['\"]@/types/vtex['\"]" src/lib/hookParser.ts` returns 1 match
- File `src/lib/__tests__/hookParser.test.ts` exists
- `grep -c "it\\(" src/lib/__tests__/hookParser.test.ts` returns at least 13
- `npx vitest run src/lib/__tests__/hookParser.test.ts --reporter=verbose` passes (exit code 0) with at least 13 passing tests
- `npx tsc --noEmit` passes with zero errors
</acceptance_criteria>

---

## Verification

### Must-Haves

- [ ] `createVtexClient(config, fetcher?)` returns an object with all four methods
- [ ] Tests pass injected `vi.fn()` fetcher — NO `vi.stubGlobal('fetch', ...)` anywhere
- [ ] `vtexClient.ts` does NOT call `process.env` or `getServerConfig`
- [ ] `VtexApiError.message` never contains the appToken value (test asserts via literal `SECRET-TOKEN-MUST-NEVER-LEAK`)
- [ ] `startHandling` sends `body: '{}'` and Content-Type: application/json
- [ ] `commitFeedItems([])` makes zero HTTP calls
- [ ] `getFeedItems` handles raw-array, `{events: [...]}` wrapper, and unknown shape (returns `[]`)
- [ ] `extractOrderId` covers all six payload shapes (orderId, OrderId, order.*, data.*) — TEST-03
- [ ] All Wave 1 + Wave 2 tests pass: `npx vitest run src/lib/__tests__/ --reporter=verbose`
- [ ] `npx tsc --noEmit` passes with zero errors
