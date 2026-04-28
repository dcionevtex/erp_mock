---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [nextjs, typescript, tailwind, shadcn, vitest, react]

# Dependency graph
requires: []
provides:
  - Next.js 16 + TypeScript 6 (strict) project scaffold with App Router
  - Tailwind CSS v4 with shadcn/ui initialized and cn() helper
  - Vitest 4 test runner with jsdom environment and smoke test
  - tsconfig.json with strict mode, bundler moduleResolution, @/* alias
  - next.config.ts typed configuration
  - package.json with engines node>=24, test/test:watch scripts
affects: [02-types, 03-store-env, 04-api-routes, 05-ui-dashboard]

# Tech tracking
tech-stack:
  added:
    - next@16.2.4
    - react@19.2.5
    - react-dom@19.2.5
    - typescript@6.0.3
    - tailwindcss@4.2.4
    - shadcn/ui (via npx shadcn@latest init)
    - class-variance-authority@0.7.1
    - clsx@2.1.1
    - tailwind-merge@3.5.0
    - lucide-react@1.11.0
    - vitest@4.1.5
    - "@vitejs/plugin-react"
    - jsdom
    - "@testing-library/react@16.3.2"
    - vite-tsconfig-paths
  patterns:
    - App Router (app/ directory) as the sole router — no Pages Router
    - cn() helper via clsx + tailwind-merge for safe className merging
    - Vitest with jsdom for unit testing TypeScript functions
    - @/* path alias mapping to src/*

key-files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - vitest.config.ts
    - components.json
    - .gitignore
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/globals.css
    - src/lib/utils.ts
    - src/__tests__/smoke.test.ts
    - src/components/ui/button.tsx
  modified:
    - .gitignore (added Thumbs.db)

key-decisions:
  - "Used App Router exclusively — no Pages Router mixing per STACK.md recommendation"
  - "shadcn/ui --defaults preset used (base-nova style) as --base-color flag unavailable in shadcn v4"
  - "jsx set to preserve in tsconfig spec but Next.js auto-updates to react-jsx during build (expected, correct)"
  - "Node.js >= 24.0.0 pinned in engines field per Vercel 2025 default"
  - "vitest-tsconfig-paths warning about native resolve noted but plugin kept for compatibility"

patterns-established:
  - "All imports use @/* alias pointing to src/*"
  - "TypeScript strict mode enforced from day one per PITFALLS.md M5"
  - "No runtime: edge exports anywhere — all routes default to Node.js runtime"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-04-28
---

# Phase 1 Plan 1: Project Scaffold Summary

**Next.js 16 + TypeScript 6 strict + Tailwind 4 + shadcn/ui + Vitest 4 scaffold with App Router, cn() helper, and passing smoke test**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-28T14:37:55Z
- **Completed:** 2026-04-28T14:44:10Z
- **Tasks:** 5
- **Files modified:** 24

## Accomplishments
- Scaffolded Next.js 16.2.4 with TypeScript 6, Tailwind v4, ESLint, App Router, and src/ directory structure
- Configured strict TypeScript (strict mode, bundler moduleResolution, isolatedModules, @/* alias)
- Initialized shadcn/ui generating cn() helper at src/lib/utils.ts and CSS variable theme in globals.css
- Installed Vitest 4 with jsdom environment; smoke test passes with npm test
- Production build (npm run build) exits 0 — route / is compiled and static pages generated

## Task Commits

Each task was committed atomically:

1. **Task 1.1: create-next-app scaffold and pin Node engines** - `4f29a74` (chore)
2. **Task 1.2: strict tsconfig.json and TypeScript next.config.ts** - `4410050` (chore)
3. **Task 1.3: shadcn/ui initialization with cn() helper** - `ecb7f36` (feat)
4. **Task 1.4: Vitest 4 installation and smoke test** - `35642a0` (feat)
5. **Task 1.5: gitignore additions and build verification** - `8d2c611` (chore)

## Files Created/Modified
- `package.json` - Next.js 16 + React 19 + TypeScript 6 dependencies, engines, test scripts
- `tsconfig.json` - strict: true, moduleResolution: bundler, @/* alias, isolatedModules
- `next.config.ts` - TypeScript-typed Next.js config with import type { NextConfig }
- `vitest.config.ts` - Vitest runner with React plugin, jsdom, tsconfigPaths
- `components.json` - shadcn/ui configuration with aliases and CSS variables
- `src/lib/utils.ts` - cn() helper using clsx + tailwind-merge
- `src/app/globals.css` - Tailwind v4 @import + shadcn CSS variable theme tokens
- `src/app/layout.tsx` - Root layout with HTML/body shell
- `src/app/page.tsx` - Default home page from create-next-app
- `src/__tests__/smoke.test.ts` - Smoke test: expect(1+1).toBe(2)
- `.gitignore` - Added Thumbs.db, coverage/ already present from create-next-app

## Decisions Made
- Used shadcn/ui `--defaults` flag instead of `--base-color neutral` because shadcn v4.5.0 removed the `--base-color` flag (auto-selected base-nova preset with neutral base color)
- Next.js automatically updated tsconfig.json during build to set `jsx: react-jsx` (correct for Next.js) and add `.next/dev/types/**/*.ts` to includes — this is expected and not reverted
- Kept vite-tsconfig-paths plugin despite the native resolution warning — maintains explicit compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] shadcn init --base-color flag not available in shadcn v4.5.0**
- **Found during:** Task 1.3 (Initialize shadcn/ui)
- **Issue:** Plan specified `npx shadcn@latest init --yes --base-color neutral` but shadcn v4.5.0 removed the `--base-color` flag
- **Fix:** Used `--defaults` flag instead which selects base-nova preset with neutral base color — functionally equivalent
- **Files modified:** components.json (style: base-nova, baseColor: neutral confirmed)
- **Verification:** components.json has $schema, aliases, neutral baseColor; src/lib/utils.ts has export function cn
- **Committed in:** ecb7f36 (Task 1.3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — outdated CLI flag)
**Impact on plan:** Minimal. shadcn/ui initialized correctly with same neutral color and all required outputs.

## Issues Encountered
- `create-next-app` refused to scaffold into non-empty directory — temporarily moved `.planning/` and `CLAUDE.MD` aside, scaffolded, then restored. Both files confirmed present after restoration.
- `@types/react-dom@19.2.14` not published on npm — used latest available `@types/react-dom@19.2.3` instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete Next.js project scaffold ready for Phase 2 (types + store)
- All subsequent plans can add files into this working build
- `npm run build`, `npm test`, and `npx tsc --noEmit` all exit 0
- No blockers

---
*Phase: 01-foundation*
*Completed: 2026-04-28*
