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
  /** Cancel an order. */
  cancelOrder: (orderId: string) => `/api/oms/pvt/orders/${encodeURIComponent(orderId)}/cancel`,
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
  'CANCELLED',
] as const;

export const INTEGRATION_SOURCE_VALUES = ['FEED', 'HOOK'] as const;

export const TIMELINE_STATUS_VALUES = ['SUCCESS', 'ERROR', 'INFO', 'SKIPPED'] as const;
