export const runtime = 'nodejs';

import { getMissingCredentials, buildServerConfig } from '@/lib/config';
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

  const cfg = await buildServerConfig();
  const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
  if (missing.length > 0) {
    return Response.json({ error: 'VTEX credentials not configured', missing }, { status: 401 });
  }

  const vtexClient = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);
  try {
    await vtexClient.startHandling(orderId);
    const r = await getOrderByOrderId(orderId);
    if (r) {
      await upsertOrder({ ...r, startHandlingStatus: 'SUCCESS' });
      await setOrderStatus(r.id, 'START_HANDLING_SUCCESS');
      await appendTimelineEntry(r.id, {
        timestamp: new Date().toISOString(),
        step: 'START_HANDLING_SUCCESS',
        status: 'SUCCESS',
        message: 'Manual Start Handling trigger succeeded',
      });
    }
    return Response.json({ ok: true, orderId, startHandlingStatus: 'SUCCESS' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const r = await getOrderByOrderId(orderId);
    if (r) {
      await upsertOrder({ ...r, startHandlingStatus: 'ERROR', errorMessage: message });
      await setOrderStatus(r.id, 'START_HANDLING_ERROR');
      await appendTimelineEntry(r.id, {
        timestamp: new Date().toISOString(),
        step: 'START_HANDLING_ERROR',
        status: 'ERROR',
        message,
      });
    }
    await appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'SYSTEM',
      level: 'ERROR',
      message: `Start Handling failed for orderId=${orderId}: ${message}`,
      orderId,
    });
    return Response.json({ ok: false, orderId, error: message }, { status: 502 });
  }
}
