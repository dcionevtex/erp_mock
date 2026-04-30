export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { clearAllOrders, clearEventLog } from '@/lib/store';

/**
 * Weekly cleanup cron — deletes all ERP orders and event log entries.
 * Scheduled every Sunday at 00:00 UTC via vercel.json.
 *
 * Protection: Vercel automatically sends Authorization: Bearer <CRON_SECRET>
 * when CRON_SECRET is set as an environment variable.
 * Without it, the endpoint is open — set CRON_SECRET in Vercel env vars.
 */
export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const [orderCount] = await Promise.all([
    clearAllOrders(),
    clearEventLog(),
  ]);

  const now = new Date().toISOString();
  console.log(`[cron/cleanup] ${now} — deleted ${orderCount} orders and cleared event log`);

  return Response.json({
    ok: true,
    clearedAt: now,
    ordersDeleted: orderCount,
    eventLogCleared: true,
  });
}
