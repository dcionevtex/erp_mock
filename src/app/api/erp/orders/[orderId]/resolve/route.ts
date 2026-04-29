export const runtime = 'nodejs';

import { getOrderByOrderId, setOrderStatus, appendTimelineEntry } from '@/lib/store';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;

  const existing = await getOrderByOrderId(orderId);
  if (!existing) {
    return Response.json({ error: 'Order not found', orderId }, { status: 404 });
  }

  await setOrderStatus(existing.id, 'MANUALLY_RESOLVED');
  await appendTimelineEntry(existing.id, {
    timestamp: new Date().toISOString(),
    step: 'MANUALLY_RESOLVED',
    status: 'INFO',
    message: 'Order marked as manually resolved',
  });

  return Response.json({ ok: true, orderId });
}
