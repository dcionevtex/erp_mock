import { NextRequest, NextResponse } from 'next/server';
import { handleOrderPlacement } from '@/lib/marketplaceHandlers';
import type { MktOrderRequest } from '@/types/marketplace';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const start = Date.now();
  const { account } = await params;
  const raw = await req.json();
  const order = (Array.isArray(raw) ? raw[0] : raw) as MktOrderRequest;
  const orderId = order.marketplaceOrderId ?? crypto.randomUUID();
  const responseBody = handleOrderPlacement(account, orderId, order, new URL(req.url).pathname, start);
  return NextResponse.json(responseBody);
}
