import { NextRequest, NextResponse } from 'next/server';
import { handleOrderPlacement } from '@/lib/marketplaceHandlers';
import { appendCallLog } from '@/lib/marketplaceStore';
import type { MktOrderRequest } from '@/types/marketplace';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const start = Date.now();
  const { account } = await params;
  const pathname = new URL(req.url).pathname;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch (e) {
    const body = { error: 'Failed to parse request body', detail: String(e) };
    appendCallLog(account, { timestamp: new Date().toISOString(), method: 'POST', path: pathname, account, endpoint: 'placement', responseBody: body, httpStatus: 400, durationMs: Date.now() - start });
    return NextResponse.json(body, { status: 400 });
  }

  try {
    const orders = (Array.isArray(raw) ? raw : [raw]) as MktOrderRequest[];
    const responses = orders.map(order => {
      const orderId = order.marketplaceOrderId ?? crypto.randomUUID();
      return handleOrderPlacement(account, orderId, order, pathname, start);
    });
    return NextResponse.json(responses);
  } catch (e) {
    const body = { error: 'Order placement handler failed', detail: String(e), receivedBody: raw };
    appendCallLog(account, { timestamp: new Date().toISOString(), method: 'POST', path: pathname, account, endpoint: 'placement', requestBody: raw, responseBody: body, httpStatus: 500, durationMs: Date.now() - start });
    return NextResponse.json(body, { status: 500 });
  }
}
