import { NextRequest, NextResponse } from 'next/server';
import { handleAuthorize } from '@/lib/marketplaceHandlers';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string; orderId: string }> },
) {
  const start = Date.now();
  const { account, orderId } = await params;
  const body = await req.json() as Record<string, unknown>;
  const responseBody = handleAuthorize(account, orderId, body, new URL(req.url).pathname, start);
  return NextResponse.json(responseBody);
}
