export const runtime = 'nodejs';

import { buildServerConfig, getMissingCredentials } from '@/lib/config';
import { getOrderByOrderId, upsertOrder, appendTimelineEntry, setOrderStatus, appendEventLog } from '@/lib/store';
import { createVtexClient } from '@/lib/vtexClient';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;

  const existing = await getOrderByOrderId(orderId);
  if (!existing) {
    return Response.json({ error: 'Order not found', orderId }, { status: 404 });
  }

  if (existing.erpStatus === 'CANCELLED') {
    return Response.json({ error: 'Order is already cancelled', code: 'ALREADY_CANCELLED' }, { status: 409 });
  }

  const cfg = await buildServerConfig();
  const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
  if (missing.length > 0) {
    return Response.json({ error: 'VTEX credentials not configured', missing }, { status: 401 });
  }

  await appendTimelineEntry(existing.id, {
    timestamp: new Date().toISOString(),
    step: 'CANCEL_REQUESTED',
    status: 'INFO',
    message: `Cancel order requested for orderId: ${orderId}`,
  });

  const vtexClient = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);
  try {
    await vtexClient.cancelOrder(orderId);

    await setOrderStatus(existing.id, 'CANCELLED');
    await appendTimelineEntry(existing.id, {
      timestamp: new Date().toISOString(),
      step: 'CANCEL_SUCCESS',
      status: 'SUCCESS',
      message: 'Order successfully cancelled in VTEX',
    });
    await appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'SYSTEM',
      level: 'INFO',
      message: `Order cancelled: ${orderId}`,
      orderId,
    });

    return Response.json({ ok: true, orderId, erpStatus: 'CANCELLED' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await setOrderStatus(existing.id, 'ERROR');
    await appendTimelineEntry(existing.id, {
      timestamp: new Date().toISOString(),
      step: 'CANCEL_ERROR',
      status: 'ERROR',
      message,
    });
    await upsertOrder({ ...existing, errorMessage: message });
    await appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'SYSTEM',
      level: 'ERROR',
      message: `Cancel order failed for orderId=${orderId}: ${message}`,
      orderId,
    });

    return Response.json({ ok: false, orderId, error: message }, { status: 502 });
  }
}
