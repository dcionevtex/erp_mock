export const runtime = 'nodejs';

import { getMissingCredentials, buildServerConfig } from '@/lib/config';
import { getOrderByOrderId, upsertOrder, appendEventLog } from '@/lib/store';
import { createVtexClient } from '@/lib/vtexClient';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;

  const existing = await getOrderByOrderId(orderId);
  if (!existing) return Response.json({ error: 'Order not found', orderId }, { status: 404 });

  if (existing.invoiceStatus !== 'SUCCESS') {
    return Response.json(
      { error: 'Invoice must be sent before updating tracking', code: 'INVOICE_REQUIRED' },
      { status: 409 },
    );
  }

  if (!existing.invoiceNumber) {
    return Response.json({ error: 'Invoice number not found on record' }, { status: 409 });
  }

  let body: { courier?: string; trackingNumber?: string; trackingUrl?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const cfg = await buildServerConfig();
  const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
  if (missing.length > 0) {
    return Response.json({ error: 'VTEX credentials not configured', missing }, { status: 401 });
  }

  const vtexClient = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);

  try {
    await vtexClient.updateInvoiceTracking(orderId, existing.invoiceNumber, body);

    const r = await getOrderByOrderId(orderId);
    if (r) {
      await upsertOrder({
        ...r,
        invoiceTracking: {
          courier: body.courier,
          trackingNumber: body.trackingNumber,
          trackingUrl: body.trackingUrl,
        },
      });
    }

    return Response.json({ ok: true, orderId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'SYSTEM',
      level: 'ERROR',
      message: `Update tracking failed for orderId=${orderId}: ${message}`,
      orderId,
    });
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
