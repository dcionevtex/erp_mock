export const runtime = 'nodejs';

import { getMissingCredentials, buildServerConfig } from '@/lib/config';
import { getOrderByOrderId, upsertOrder, appendTimelineEntry, setOrderStatus, appendEventLog } from '@/lib/store';
import { createVtexClient, buildInvoiceNumber } from '@/lib/vtexClient';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;

  const existing = await getOrderByOrderId(orderId);
  if (!existing) return Response.json({ error: 'Order not found', orderId }, { status: 404 });

  if (existing.invoiceStatus === 'SUCCESS') {
    return Response.json({ error: 'Invoice already sent', code: 'ALREADY_INVOICED' }, { status: 409 });
  }

  if (existing.startHandlingStatus !== 'SUCCESS') {
    return Response.json(
      { error: 'Start Handling must succeed before sending invoice', code: 'START_HANDLING_REQUIRED' },
      { status: 409 },
    );
  }

  const cfg = await buildServerConfig();
  const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
  if (missing.length > 0) {
    return Response.json({ error: 'VTEX credentials not configured', missing }, { status: 401 });
  }

  const vtexClient = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);
  const invoiceNumber = buildInvoiceNumber(orderId);
  const invoiceItems = (existing.erpPayload?.items ?? []).map((item) => ({
    id: item.skuId ?? '',
    price: item.price ?? 0,
    quantity: item.quantity ?? 1,
  }));

  await appendTimelineEntry(existing.id, {
    timestamp: new Date().toISOString(),
    step: 'INVOICE_REQUESTED',
    status: 'INFO',
    message: `Sending invoice ${invoiceNumber} to VTEX`,
  });

  try {
    await vtexClient.sendInvoice(orderId, {
      type: 'Output',
      invoiceNumber,
      invoiceValue: existing.totalValue ?? 0,
      issuanceDate: new Date().toISOString(),
      items: invoiceItems,
    });

    const r = await getOrderByOrderId(orderId);
    if (r) {
      await upsertOrder({
        ...r,
        invoiceStatus: 'SUCCESS',
        invoiceNumber,
        invoiceIssuedAt: new Date().toISOString(),
      });
    }
    await setOrderStatus(existing.id, 'INVOICED');
    await appendTimelineEntry(existing.id, {
      timestamp: new Date().toISOString(),
      step: 'INVOICE_SUCCESS',
      status: 'SUCCESS',
      message: `Invoice ${invoiceNumber} accepted by VTEX`,
    });

    return Response.json({ ok: true, orderId, invoiceNumber });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const r = await getOrderByOrderId(orderId);
    if (r) await upsertOrder({ ...r, invoiceStatus: 'ERROR', errorMessage: message });
    await setOrderStatus(existing.id, 'INVOICE_ERROR');
    await appendTimelineEntry(existing.id, {
      timestamp: new Date().toISOString(),
      step: 'INVOICE_ERROR',
      status: 'ERROR',
      message,
    });
    await appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'SYSTEM',
      level: 'ERROR',
      message: `Send Invoice failed for orderId=${orderId}: ${message}`,
      orderId,
    });
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
