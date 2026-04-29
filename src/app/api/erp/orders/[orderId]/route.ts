export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getOrderByOrderId, deleteOrder } from '@/lib/store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;

  const record = await getOrderByOrderId(orderId);
  if (!record) {
    return Response.json({ error: 'Order not found', orderId }, { status: 404 });
  }

  return Response.json({ order: record });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;

  const record = await getOrderByOrderId(orderId);
  if (!record) {
    return Response.json({ error: 'Order not found', orderId }, { status: 404 });
  }

  await deleteOrder(record.id);
  return Response.json({ ok: true, deleted: orderId });
}
