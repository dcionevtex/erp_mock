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
