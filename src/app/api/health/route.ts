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
    });
  }

  try {
    await ensureSchema(sql);
    const rows = await sql`SELECT NOW() AS now`;
    return Response.json({
      ok: true,
      db: 'connected',
      serverTime: rows[0]?.now,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, db: 'error', message }, { status: 500 });
  }
}
