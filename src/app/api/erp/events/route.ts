export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getEventLog } from '@/lib/store';

export async function GET(_request: Request): Promise<Response> {
  const events = getEventLog();
  return Response.json({ events, total: events.length });
}
