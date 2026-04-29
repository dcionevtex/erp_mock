export const runtime = 'nodejs';

import { getMissingCredentials, buildServerConfig } from '@/lib/config';
import { getOrderByOrderId, upsertOrder } from '@/lib/store';
import { createVtexClient } from '@/lib/vtexClient';
import { processOrder } from '@/lib/orderProcessor';


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

  await upsertOrder({
    ...existing,
    erpStatus: 'RECEIVED',
    startHandlingStatus: 'NOT_STARTED',
    errorMessage: undefined,
    timeline: [
      ...existing.timeline,
      {
        timestamp: new Date().toISOString(),
        step: 'REPROCESS_REQUESTED',
        status: 'INFO',
        message: 'Manual reprocess requested',
      },
    ],
  });

  const vtexClient = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);
  await processOrder(orderId, existing.source, { vtexClient, config: cfg });

  return Response.json({ ok: true, orderId });
}
