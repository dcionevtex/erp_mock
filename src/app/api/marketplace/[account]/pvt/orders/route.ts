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
  const body = await req.json() as MktOrderRequest;
  const orderId = (body.marketplaceOrderId as string | undefined) ?? crypto.randomUUID();
  const responseBody = handleOrderPlacement(account, orderId, body, new URL(req.url).pathname, start);
  return NextResponse.json(responseBody);
}
