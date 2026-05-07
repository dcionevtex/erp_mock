export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getSql, ensureSchema } from '@/lib/db';

export async function GET(): Promise<Response> {
  const sql = getSql();

  if (!sql) {
    return Response.json({
      ok: true,
      db: 'not_configured',
      message: 'DATABASE_URL not set — using in-memory store',
      authEnv,
    });
  }

  try {
    await ensureSchema(sql);
    const [time, orders, events, config] = await Promise.all([
      sql`SELECT NOW() AS now`,
      sql`SELECT COUNT(*)::int AS count FROM erp_orders`,
      sql`SELECT COUNT(*)::int AS count FROM event_log`,
      sql`SELECT COUNT(*)::int AS count FROM app_config`,
    ]);
    return Response.json({
      ok: true,
      db: 'connected',
      serverTime: time[0]?.now,
      tables: {
        erp_orders: orders[0]?.count ?? 0,
        event_log: events[0]?.count ?? 0,
        app_config: config[0]?.count ?? 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, db: 'error', message }, { status: 500 });
  }
}
