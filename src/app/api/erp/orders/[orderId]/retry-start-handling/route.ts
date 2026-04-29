export const runtime = 'nodejs';

import { getMissingCredentials, buildServerConfig } from '@/lib/config';
import { getOrderByOrderId, upsertOrder, appendTimelineEntry, setOrderStatus, appendEventLog } from '@/lib/store';
import { createVtexClient } from '@/lib/vtexClient';


export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;

  const existing = getOrderByOrderId(orderId);
  if (!existing) {
    return Response.json({ error: 'Order not found', orderId }, { status: 404 });
  }

  if (existing.startHandlingStatus === 'SUCCESS') {
    return Response.json(
      { error: 'Start Handling already succeeded — no retry needed', code: 'ALREADY_HANDLED' },
      { status: 409 },
    );
  }

  const cfg = await buildServerConfig();
  const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
  if (missing.length > 0) {
    return Response.json({ error: 'VTEX credentials not configured', missing }, { status: 401 });
  }

  const vtexClient = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);
  try {
    await vtexClient.startHandling(orderId);
    const r = getOrderByOrderId(orderId);
    if (r) {
      upsertOrder({ ...r, startHandlingStatus: 'SUCCESS' });
      setOrderStatus(r.id, 'START_HANDLING_SUCCESS');
      appendTimelineEntry(r.id, {
        timestamp: new Date().toISOString(),
        step: 'START_HANDLING_SUCCESS',
        status: 'SUCCESS',
        message: 'Manual retry succeeded',
      });
    }
    return Response.json({ ok: true, orderId, startHandlingStatus: 'SUCCESS' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const r = getOrderByOrderId(orderId);
    if (r) {
      upsertOrder({ ...r, startHandlingStatus: 'ERROR', errorMessage: message });
      setOrderStatus(r.id, 'START_HANDLING_ERROR');
      appendTimelineEntry(r.id, {
        timestamp: new Date().toISOString(),
        step: 'START_HANDLING_ERROR',
        status: 'ERROR',
        message,
      });
    }
    appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'SYSTEM',
      level: 'ERROR',
      message: `Retry Start Handling failed for orderId=${orderId}: ${message}`,
      orderId,
    });
    return Response.json({ ok: false, orderId, error: message }, { status: 502 });
  }
}
