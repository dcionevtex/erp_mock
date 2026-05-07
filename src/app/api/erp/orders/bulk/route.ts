export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getOrderByOrderId, deleteOrder, setOrderStatus, appendTimelineEntry } from '@/lib/store';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json() as { action: string; orderIds: string[] };
  const { action, orderIds } = body;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return Response.json({ error: 'orderIds must be a non-empty array' }, { status: 400 });
  }

  if (action === 'delete') {
    let affected = 0;
    for (const orderId of orderIds) {
      const record = await getOrderByOrderId(orderId);
      if (record) {
        await deleteOrder(record.id);
        affected++;
      }
    }
    return Response.json({ ok: true, action: 'delete', affected });
  }

  if (action === 'resolve') {
    const now = new Date().toISOString();
    let affected = 0;
    for (const orderId of orderIds) {
      const record = await getOrderByOrderId(orderId);
      if (record && record.erpStatus !== 'MANUALLY_RESOLVED') {
        await setOrderStatus(record.id, 'MANUALLY_RESOLVED');
        await appendTimelineEntry(record.id, {
          timestamp: now,
          step: 'MANUALLY_RESOLVED',
          status: 'INFO',
          message: 'Marked as manually resolved (bulk action)',
        });
        affected++;
      }
    }
    return Response.json({ ok: true, action: 'resolve', affected });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
