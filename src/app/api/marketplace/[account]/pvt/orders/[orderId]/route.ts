import { NextRequest, NextResponse } from 'next/server';
import { handleOrderPlacement } from '@/lib/marketplaceHandlers';
import type { MktOrderRequest } from '@/types/marketplace';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ account: string; orderId: string }> },
) {
  const start = Date.now();
  const { account, orderId } = await params;
  const body = await req.json() as MktOrderRequest;
  const responseBody = handleOrderPlacement(account, orderId, body, new URL(req.url).pathname, start);
  return NextResponse.json(responseBody);
}
