import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

/** Returns the Neon SQL client, or null when DATABASE_URL is not set (local dev / tests). */
export function getSql(): NeonQueryFunction<false, false> | null {
  if (!process.env.DATABASE_URL) return null;
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

let _schemaReady = false;

/** Idempotent schema bootstrap — runs once per process lifetime. */
export async function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  if (_schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS erp_orders (
      id          TEXT PRIMARY KEY,
      order_id    TEXT NOT NULL,
      data        JSONB NOT NULL,
      received_at TIMESTAMPTZ NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS erp_orders_order_id_idx ON erp_orders (order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS erp_orders_received_at_idx ON erp_orders (received_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS event_log (
      id   BIGSERIAL PRIMARY KEY,
      ts   TIMESTAMPTZ NOT NULL,
      data JSONB NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS event_log_ts_idx ON event_log (ts DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS app_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  _schemaReady = true;
}
