export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getEventLog, clearEventLog } from '@/lib/store';

export async function GET(_request: Request): Promise<Response> {
  const events = await getEventLog();
  return Response.json({ events, total: events.length });
}

export async function DELETE(_request: Request): Promise<Response> {
  await clearEventLog();
  return Response.json({ ok: true, cleared: true });
}
