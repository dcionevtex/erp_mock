export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getAllOrders } from '@/lib/store';
import type { ErpStatus, IntegrationSource } from '@/types';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const source = searchParams.get('source');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const sort   = searchParams.get('sort') ?? 'receivedAt_desc';

  let orders = getAllOrders();

  if (source && source !== 'ALL') {
    orders = orders.filter((o): boolean => o.source === (source as IntegrationSource));
  }
  if (status && status !== 'ALL') {
    orders = orders.filter((o): boolean => o.erpStatus === (status as ErpStatus));
  }
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter((o): boolean =>
      o.orderId.toLowerCase().includes(q) ||
      (o.sequence ?? '').toLowerCase().includes(q) ||
      (o.customerName ?? '').toLowerCase().includes(q) ||
      (o.erpPayload?.items ?? []).some(
        (item) => (item.name ?? '').toLowerCase().includes(q),
      ),
    );
  }

  if (sort === 'receivedAt_asc') {
    orders = [...orders].sort(
      (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
    );
  }

  return Response.json({ orders, total: orders.length });
}
