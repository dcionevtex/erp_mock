import { NextResponse } from 'next/server';
import { handleGetPayment } from '@/lib/pppHandlers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ account: string; paymentId: string }> },
) {
  const { account, paymentId } = await params;
  const url = new URL(request.url);
  const { body, status } = handleGetPayment(account, paymentId, url.pathname, Date.now());
  return NextResponse.json(body, { status });
}
