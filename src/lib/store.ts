// src/lib/store.ts
// Persistence layer — in-memory by default, Neon Postgres when DATABASE_URL is set.
//
// All order/event functions are async so callers work identically in both modes.
// Config overrides and server secrets stay in-memory (covered by the iron-session cookie).

import type {
  AppConfig,
  ErpOrderRecord,
  ErpStatus,
  ErpTimelineEntry,
  EventLogEntry,
  IntegrationMode,
} from '@/types';
import { getSql, ensureSchema } from '@/lib/db';

// ---- globalThis in-memory singletons (used when DATABASE_URL is not set) ----

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
  globalThis.__erpStore ?? (globalThis.__erpStore = new Map());
const eventLog: EventLogEntry[] =
  globalThis.__eventLog ?? (globalThis.__eventLog = []);
const processedKeys: Set<string> =
  globalThis.__processedKeys ?? (globalThis.__processedKeys = new Set());
const configOverrides: Partial<AppConfig> =
  globalThis.__configOverrides ?? (globalThis.__configOverrides = {});

// ---- helpers ----------------------------------------------------------------

async function db() {
  const sql = getSql();
  if (sql) await ensureSchema(sql);
  return sql;
}

// ---- Order CRUD -------------------------------------------------------------

export async function upsertOrder(record: ErpOrderRecord): Promise<ErpOrderRecord> {
  const sql = await db();
  if (sql) {
    await sql`
      INSERT INTO erp_orders (id, order_id, data, received_at)
      VALUES (${record.id}, ${record.orderId}, ${JSON.stringify(record)}, ${record.receivedAt})
      ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return record;
  }
  orders.set(record.id, record);
  return record;
}

export async function getOrder(id: string): Promise<ErpOrderRecord | undefined> {
  const sql = await db();
  if (sql) {
    const rows = await sql`SELECT data FROM erp_orders WHERE id = ${id} LIMIT 1`;
    return rows[0]?.data as ErpOrderRecord | undefined;
  }
  return orders.get(id);
}

export async function getOrderByOrderId(orderId: string): Promise<ErpOrderRecord | undefined> {
  const sql = await db();
  if (sql) {
    const rows = await sql`SELECT data FROM erp_orders WHERE order_id = ${orderId} LIMIT 1`;
    return rows[0]?.data as ErpOrderRecord | undefined;
  }
  for (const rec of orders.values()) {
    if (rec.orderId === orderId) return rec;
  }
  return undefined;
}

export async function getAllOrders(): Promise<ErpOrderRecord[]> {
  const sql = await db();
  if (sql) {
    const rows = await sql`SELECT data FROM erp_orders ORDER BY received_at DESC`;
    return rows.map((r) => r.data as ErpOrderRecord);
  }
  return Array.from(orders.values()).sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );
}

export async function setOrderStatus(
  id: string,
  status: ErpStatus,
  lastAttemptAt?: string,
): Promise<ErpOrderRecord | undefined> {
  const rec = await getOrder(id);
  if (!rec) return undefined;
  return upsertOrder({
    ...rec,
    erpStatus: status,
    lastAttemptAt: lastAttemptAt ?? new Date().toISOString(),
  });
}

export async function appendTimelineEntry(
  id: string,
  entry: ErpTimelineEntry,
): Promise<ErpOrderRecord | undefined> {
  const rec = await getOrder(id);
  if (!rec) return undefined;
  return upsertOrder({ ...rec, timeline: [...rec.timeline, entry] });
}

export async function incrementAttempts(id: string): Promise<ErpOrderRecord | undefined> {
  const rec = await getOrder(id);
  if (!rec) return undefined;
  return upsertOrder({
    ...rec,
    attempts: rec.attempts + 1,
    lastAttemptAt: new Date().toISOString(),
  });
}

export async function deleteOrder(id: string): Promise<boolean> {
  const sql = await db();
  if (sql) {
    await sql`DELETE FROM erp_orders WHERE id = ${id}`;
    return true;
  }
  return orders.delete(id);
}

// ---- Event log --------------------------------------------------------------

export async function appendEventLog(entry: EventLogEntry): Promise<void> {
  const sql = await db();
  if (sql) {
    await sql`INSERT INTO event_log (ts, data) VALUES (${entry.timestamp}, ${JSON.stringify(entry)})`;
    // Keep DB log bounded (delete oldest beyond 1000 rows)
    await sql`
      DELETE FROM event_log
      WHERE id NOT IN (SELECT id FROM event_log ORDER BY ts DESC LIMIT 1000)
    `;
    return;
  }
  eventLog.push(entry);
  if (eventLog.length > 1000) eventLog.splice(0, eventLog.length - 1000);
}

export async function getEventLog(): Promise<EventLogEntry[]> {
  const sql = await db();
  if (sql) {
    const rows = await sql`SELECT data FROM event_log ORDER BY ts DESC LIMIT 1000`;
    return rows.map((r) => r.data as EventLogEntry);
  }
  return [...eventLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export async function clearEventLog(): Promise<void> {
  const sql = await db();
  if (sql) {
    await sql`TRUNCATE TABLE event_log RESTART IDENTITY`;
    return;
  }
  eventLog.length = 0;
}

// ---- Idempotency / dedup keys (always in-memory — ephemeral is fine) --------

export function hasProcessedKey(key: string): boolean {
  return processedKeys.has(key);
}

export function markProcessedKey(key: string): void {
  processedKeys.add(key);
  if (processedKeys.size > 5000) {
    const arr = Array.from(processedKeys);
    processedKeys.clear();
    for (const k of arr.slice(arr.length - 4000)) processedKeys.add(k);
  }
}

// ---- In-memory config overrides (covered by iron-session cookie) ------------

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

// ---- Server-side credential overrides (never serialized) --------------------

declare global {
  // eslint-disable-next-line no-var
  var __serverSecrets: { appToken?: string; appKey?: string } | undefined;
}

const serverSecrets: { appToken?: string; appKey?: string } =
  globalThis.__serverSecrets ?? (globalThis.__serverSecrets = {});

export function setServerSecrets(secrets: { appToken?: string; appKey?: string }): void {
  if (secrets.appToken !== undefined) serverSecrets.appToken = secrets.appToken;
  if (secrets.appKey !== undefined) serverSecrets.appKey = secrets.appKey;
}

export function getServerSecrets(): { appToken?: string; appKey?: string } {
  return { ...serverSecrets };
}

// ---- Persisted config (Neon DB only — survives cold starts for server-to-server calls) -----------

export async function getPersistedConfig(): Promise<Record<string, unknown>> {
  const sql = await db();
  if (!sql) return {};
  const rows = await sql`SELECT key, value FROM app_config` as { key: string; value: string }[];
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  }
  return result;
}

export async function savePersistedConfig(fields: Record<string, unknown>): Promise<void> {
  const sql = await db();
  if (!sql) return;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    await sql`
      INSERT INTO app_config (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  }
}

// ---- Test helpers -----------------------------------------------------------

export function __resetStoreForTests(): void {
  orders.clear();
  eventLog.length = 0;
  processedKeys.clear();
  for (const k of Object.keys(configOverrides)) {
    delete (configOverrides as Record<string, unknown>)[k];
  }
  serverSecrets.appToken = undefined;
  serverSecrets.appKey = undefined;
}

export function __getRawCounts() {
  return {
    orders: orders.size,
    eventLog: eventLog.length,
    processedKeys: processedKeys.size,
  };
}
