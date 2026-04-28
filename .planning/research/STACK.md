# Stack Research: VTEX OMS ERP Demo Console

**Researched:** 2026-04-28
**Next.js docs version confirmed:** 16.2.4 (current)
**Vercel docs confirmed:** current (April 2025+)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.x (latest stable) | Full-stack framework | App Router + Route Handlers is the current default for new projects per official docs. Vercel explicitly recommends Route Handlers over Pages Router API routes for new Next.js apps. |
| React | 19.2.x | UI runtime | Required by Next.js 16. React 19 is now fully stable. |
| TypeScript | 6.0.x | Type safety | Next.js installs and configures this automatically via `create-next-app`. |
| Node.js | 24.x | Runtime | Vercel default as of 2025. Pin via `engines.node` in package.json. |

**App Router is the correct choice for this project.** Reasons specific to this use case:

1. Route Handlers (`app/api/.../route.ts`) use the standard Web `Request`/`Response` API — no legacy `bodyParser` config, no `NextApiRequest` wrapper to fight.
2. The VTEX Hook endpoint (`POST /api/vtex/hook`) needs to read raw request body; App Router Route Handlers do this cleanly with `await request.text()` or `await request.json()`.
3. Dynamic segments for `/api/vtex/orders/[orderId]/start-handling` work naturally with `params: Promise<{ orderId: string }>` in Next.js 15+.
4. Server Components handle the dashboard UI rendering with zero client-side fetch boilerplate for the orders list.
5. Pages Router API routes are not deprecated but receive no new features; official Vercel docs state "we recommend using Route Handlers in the App Router" for new Next.js projects.

**Do not mix routers.** Use App Router exclusively. There is no reason to use Pages Router at all for a greenfield project in 2025.

---

### UI Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.2.x | Styling | Ships with `create-next-app`, zero config for Vercel deployment. v4 drops the config file for CSS-native setup. |
| shadcn/ui | components (not a package version — installed per-component) | Accordion, Table, Badge, Button, Dialog, Input, Select, Tabs, Tooltip, Toast/Sonner | shadcn/ui is not a dependency — it generates unstyled, accessible Radix UI components directly into your codebase as TypeScript files. You own the code. Perfect for a demo tool where you want consistent components without a heavy runtime dependency. |
| Radix UI primitives | 1.2.x (via shadcn/ui) | Accessible headless UI primitives | shadcn/ui wraps Radix. You get ARIA-compliant accordion, dialog, select, etc. without writing it yourself. |
| Lucide React | 1.11.x | Icons | shadcn/ui's default icon set. Lightweight, tree-shakeable. |
| class-variance-authority | 0.7.x | Variant-based className utility | Used internally by shadcn/ui generated components. |
| clsx + tailwind-merge | 2.1.x / 3.5.x | Safe className merging | Prevents Tailwind class conflicts. Ships with shadcn/ui setup. |

**Why shadcn/ui over plain Tailwind or a full component library:**

- The orders inbox requires an accordion (complex ARIA), a data table (sortable, filterable), badges for status, and a JSON viewer — all of which shadcn/ui covers with accessible primitives.
- Unlike Chakra UI, MUI, or Mantine, shadcn/ui adds zero runtime bundle weight beyond the Radix primitives it uses.
- Unlike plain Tailwind, you get keyboard navigation and ARIA for free on interactive components.
- The generated code lives in your repo, so you can adapt it for demo-specific styling without fighting a third-party API.

**Specific shadcn/ui components to install:**

```
accordion      — order detail expand/collapse
badge          — ERP status labels (RECEIVED, ERROR, etc.)
button         — actions (Poll Feed Now, Retry, etc.)
card           — configuration panel wrapper
dialog         — JSON viewer modal (optional)
input          — configuration fields
label          — form labels
select         — filter dropdowns (source, status)
separator      — layout dividers
table          — orders inbox list
tabs           — Feed / Hook / Event Log tabs
toast (sonner) — operation feedback (Start Handling success/fail)
tooltip        — column headers, masked PII explanation
```

---

### API / HTTP

**Use native `fetch` for all VTEX API calls. Do not use axios.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `fetch` | Built-in (Node.js 18+, Next.js 15+) | VTEX API client (Get Order, Feed, Start Handling) | Next.js 15 is built around the Web Fetch API. All official examples use `fetch`. No additional dependency needed. |
| zod | 4.3.x | Request payload validation | Validates incoming VTEX Hook payloads and VTEX API responses. Gives you typed, safe parsing with clear error messages — critical for a demo that needs to handle malformed payloads visibly. |

**Why not axios:**

- `fetch` is built into Node.js 18+ and is the standard used throughout Next.js documentation and Route Handlers.
- axios adds 40KB+ to your server bundle for zero benefit when `fetch` handles JSON, headers, and error inspection natively.
- Next.js extends `fetch` with caching and deduplication semantics — axios bypasses this entirely.
- For server-side calls in Route Handlers, `fetch` with proper error handling is idiomatic and sufficient.

**Recommended VTEX client pattern:**

```typescript
// src/lib/vtex-client.ts
// Pure function — no class, no singleton. Stateless HTTP wrapper.
// Config injected from environment variables at call time.
export async function getOrder(orderId: string, config: VtexConfig) {
  const res = await fetch(
    `https://${config.account}.${config.environment}/api/oms/pvt/orders/${orderId}`,
    {
      headers: {
        'X-VTEX-API-AppKey': config.appKey,
        'X-VTEX-API-AppToken': config.appToken,
        'Accept': 'application/json',
      },
    }
  );
  if (!res.ok) throw new VtexApiError(res.status, await res.text());
  return res.json() as Promise<VtexOrder>;
}
```

---

### State / Storage

**Pattern: Module-level singleton with `globalThis` guard, Node.js runtime only.**

This is the correct in-memory pattern for Next.js on Vercel. Here is the reasoning and the exact implementation pattern:

**Vercel Fluid Compute behavior (verified from Vercel docs, April 2025):**

> "Multiple invocations can share the same physical instance (a global state/process) concurrently."
> "Fluid compute is enabled by default for new projects as of April 23, 2025."

This means: with Fluid Compute enabled, module-level singletons **can** and **do** persist across requests within the same warm instance. A `Map` declared at module level will survive between requests hitting the same instance.

**The critical caveat: this is still unreliable across cold starts.** Each new instance starts with empty state. For a demo tool where data is ephemeral by design, this is acceptable. The implementation must be clearly documented as demo-only.

**Correct pattern:**

```typescript
// src/lib/store.ts
// Guards against module re-initialization in Next.js dev (fast refresh)
// and ensures a single store per process on Vercel.

import type { ErpOrderRecord } from '@/types';

declare global {
  // eslint-disable-next-line no-var
  var __erpStore: Map<string, ErpOrderRecord> | undefined;
  var __eventLog: Array<EventLogEntry> | undefined;
}

// globalThis prevents re-initialization during Next.js hot reload in dev
export const erpStore: Map<string, ErpOrderRecord> =
  globalThis.__erpStore ?? (globalThis.__erpStore = new Map());

export const eventLog: Array<EventLogEntry> =
  globalThis.__eventLog ?? (globalThis.__eventLog = []);
```

**Why `globalThis` guard:** Next.js Fast Refresh in development re-executes module code. Without the `globalThis` guard, the store is reset on every save. The guard ensures a single instance per Node.js process in both dev and production.

**Runtime: always `nodejs`, never `edge`.** The Edge Runtime does not support module-level global state at all — it runs in a V8 isolate with no cross-request persistence. Every Route Handler that touches the store must use Node.js runtime (which is the default — no `export const runtime = 'edge'` needed).

**Do not add `export const runtime = 'nodejs'` explicitly** — it is the default and adding it is noise. Only add it if you need to override a parent layout that set edge.

**Store interface — keep it simple:**

```typescript
// Expose typed accessors, not the raw Map
export function getAllOrders(): ErpOrderRecord[] {
  return Array.from(erpStore.values())
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
}

export function upsertOrder(record: ErpOrderRecord): void {
  erpStore.set(record.id, record);
}

export function getOrder(id: string): ErpOrderRecord | undefined {
  return erpStore.get(id);
}
```

This interface is the swap point: replace the `Map` operations with Vercel KV, Supabase, or Postgres calls when upgrading to persistence.

---

### Testing

**Use Vitest, not Jest.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | 4.1.x | Unit test runner | Native ESM support, TypeScript without `ts-node`, faster than Jest, `@testing-library/react` compatible. |
| @testing-library/react | 16.3.x | Component testing (if needed) | React 19 compatible. |
| @vitejs/plugin-react | latest | Vitest React transform | Required for JSX in Vitest. |
| vite-tsconfig-paths | latest | Path alias resolution | Maps `@/` imports in tests. |

**Why Vitest over Jest:**

- Both Next.js official docs list Vitest and Jest equally. However, Vitest has a practical advantage: it uses Vite's transformer, which handles ESM and TypeScript natively. Jest with `next/jest` requires `ts-node` and the SWC transformer, adding config overhead.
- The tests needed for this project are pure unit tests of TypeScript functions: normalization, deduplication, PII masking, ERP simulator logic, Start Handling guards. None of these require component rendering or async Server Component testing.
- Vitest runs faster on these pure function tests.
- Both frameworks have the same limitation: async Server Components cannot be unit-tested directly — use E2E for those (out of scope for this MVP).

**Test file location:** colocate with source or use `src/__tests__/` — either works. Recommended: `src/lib/__tests__/` for unit tests of pure functions.

---

### TypeScript Config

**Recommended `tsconfig.json` for this project:**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Key decisions:

- **`strict: true`** — enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`. Non-negotiable for a project with complex state transitions and API response typing.
- **`moduleResolution: "bundler"`** — required for Next.js 15+. Do not use `"node"` (legacy) or `"node16"` (node-native ESM, incompatible with bundler).
- **`isolatedModules: true`** — required by Next.js SWC compiler (each file compiled independently). Catches re-export-of-type patterns that would break SWC.
- **`plugins: [{ "name": "next" }]`** — enables the Next.js TypeScript plugin in VS Code for App Router-aware type checking (detects `'use client'` misuse, invalid segment config values).
- **`paths: { "@/*": ["./src/*"] }`** — enables `@/lib/store`, `@/types`, etc. consistent with `create-next-app` default.
- **`incremental: true`** — faster `tsc` type-checking runs. No downside for this project size.

**`next.config.ts` (not `.js`):** Use TypeScript for the Next.js config file — Next.js 15+ supports it natively and you get type-safe config options.

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No extra config needed for MVP — defaults are correct
};

export default nextConfig;
```

**Do not set `typescript.ignoreBuildErrors: true`** — this defeats the purpose of TypeScript. Vercel will fail builds on type errors by default; fix them.

---

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| **Pages Router** | No new features. Route Handlers in App Router are the Vercel-recommended path. Creating a new project with Pages Router in 2025 is a step backwards. |
| **axios** | Zero benefit over native `fetch` in a Node.js 18+/Next.js 15+ environment. Adds bundle weight and bypasses Next.js fetch extensions. |
| **Jest** | Requires more config for TypeScript + ESM than Vitest. Both are equally supported by Next.js, but Vitest is simpler to set up for pure-function unit testing. |
| **Edge Runtime for any route that touches the store** | Edge runtime runs in V8 isolates with no persistent global state between requests. Module-level singletons do not work. All routes must use Node.js runtime (the default). |
| **Prisma / Drizzle / any ORM** | Out of scope for MVP. The project spec explicitly excludes a database. Adding an ORM "for later" adds complexity and requires provisioning infrastructure. Structure the store interface for easy swapping instead. |
| **Redux / Zustand / Jotai (for server state)** | Client-side state managers do not own the canonical data store for this app. The server-side Map is the store. Client components read from API endpoints. Do not replicate server state in a client store. |
| **SWR / React Query (for dashboard client fetching)** | The dashboard is primarily a Server Component. Use server-side data access for the orders list. If real-time updates are needed later, SWR is fine — but it is not needed for MVP where manual polling is the interaction model. |
| **`bodyParser: false` config** | Not needed in App Router — Route Handlers handle body parsing natively. This is a Pages Router legacy. |
| **`express` or `fastify`** | Incompatible with Vercel serverless. Next.js Route Handlers are the correct API layer. |
| **Tailwind CSS v3** | v4 is stable and is what `create-next-app` installs. Do not pin to v3. |
| **`export const runtime = 'edge'`** | Do not set this on any route. The in-memory store requires Node.js runtime. |

---

## Confidence Levels

| Recommendation | Confidence | Source |
|----------------|------------|--------|
| App Router + Route Handlers | HIGH | Official Next.js docs 16.2.4, Vercel docs explicit recommendation |
| Next.js 16.x version | HIGH | npm registry confirmed |
| shadcn/ui for component library | MEDIUM-HIGH | Widely adopted pattern; shadcn/ui official docs confirmed current; no single "official" Next.js recommendation for UI library |
| Native `fetch` over axios | HIGH | Official Next.js docs use `fetch` exclusively for server-side calls; axios docs do not claim Next.js-specific advantages |
| Vitest over Jest | MEDIUM-HIGH | Both supported by official docs; Vitest advantage is verified for simpler TypeScript/ESM setup; project preference is a judgment call |
| `globalThis` singleton pattern | HIGH | Verified against Next.js documentation on Fast Refresh behavior and Vercel Fluid Compute docs on global state/process sharing |
| Node.js runtime (not edge) for all routes | HIGH | Vercel docs explicitly state edge runtime uses V8 isolates with no cross-request global state |
| `strict: true` TypeScript | HIGH | Standard for all modern TypeScript projects; no caveats for this project |
| `moduleResolution: "bundler"` | HIGH | Required for Next.js 15+ per official TypeScript config docs |
| zod for payload validation | MEDIUM-HIGH | Industry standard for runtime TypeScript validation; no official Next.js requirement but universally recommended pattern |
| Tailwind CSS v4 | HIGH | npm registry confirmed 4.2.4; `create-next-app` installs v4 by default |
| Node.js 24.x on Vercel | HIGH | Vercel docs confirmed 24.x is the default as of current Vercel platform |

---

## Key Versions (as of 2026-04-28)

| Package | Version | Notes |
|---------|---------|-------|
| `next` | 16.2.4 | Latest stable. Use this. |
| `react` | 19.2.5 | Required by Next.js 16. Stable. |
| `react-dom` | 19.2.5 | Same as react. |
| `typescript` | 6.0.3 | Latest stable. `create-next-app` installs this. |
| `tailwindcss` | 4.2.4 | v4 is stable. CSS-native config (no `tailwind.config.js` needed in v4). |
| `vitest` | 4.1.5 | Latest stable. |
| `@testing-library/react` | 16.3.2 | React 19 compatible. |
| `zod` | 4.3.6 | Latest stable. |
| `lucide-react` | 1.11.0 | shadcn/ui default icon set. |
| `class-variance-authority` | 0.7.1 | shadcn/ui dependency. |
| `clsx` | 2.1.1 | shadcn/ui dependency. |
| `tailwind-merge` | 3.5.0 | shadcn/ui dependency. |
| `@radix-ui/react-accordion` | 1.2.12 | Via shadcn/ui. |
| `@radix-ui/react-dialog` | 1.1.15 | Via shadcn/ui. |
| `@types/node` | 25.6.0 | Latest. |
| `@types/react` | 19.2.14 | Latest. |
| Node.js (Vercel runtime) | 24.x | Set in `package.json` engines. |

**Install command for core dependencies:**

```bash
npx create-next-app@latest oms-mock \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

**Add after scaffolding:**

```bash
# Runtime dependencies
npm install zod lucide-react class-variance-authority clsx tailwind-merge

# shadcn/ui CLI (installs components on demand, not a package)
npx shadcn@latest init

# Testing
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

**shadcn/ui components for this project:**

```bash
npx shadcn@latest add accordion badge button card input label select separator table tabs tooltip
```

For toasts/notifications, prefer `sonner` (shadcn/ui default in 2025):

```bash
npx shadcn@latest add sonner
```

---

## Sources

- Next.js Route Handlers official docs: https://nextjs.org/docs/app/api-reference/file-conventions/route (version 16.2.4, confirmed 2026-04-10)
- Next.js 15 release blog: https://nextjs.org/blog/next-15 (async params, caching semantics, React 19)
- Next.js TypeScript config: https://nextjs.org/docs/app/api-reference/config/typescript (version 16.2.4)
- Next.js Vitest setup: https://nextjs.org/docs/app/guides/testing/vitest (version 16.2.4)
- Next.js Jest setup: https://nextjs.org/docs/app/guides/testing/jest (version 16.2.4)
- Next.js data fetching: https://nextjs.org/docs/app/getting-started/fetching-data (native fetch recommendation)
- Vercel Node.js runtime: https://vercel.com/docs/functions/runtimes/node-js
- Vercel Node.js versions: https://vercel.com/docs/functions/runtimes/node-js/node-js-versions (Node 24.x default confirmed)
- Vercel Fluid Compute: https://vercel.com/docs/fluid-compute (global state/process sharing confirmed; default as of April 23, 2025)
- npm registry: confirmed versions of next (16.2.4), tailwindcss (4.2.4), typescript (6.0.3), vitest (4.1.5), zod (4.3.6), react (19.2.5)
