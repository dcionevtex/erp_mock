import { NextResponse } from 'next/server';
import { handleGetPayment } from '@/lib/pppHandlers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ scenario: string; paymentId: string }> }
) {
  const { paymentId } = await params;
  const url = new URL(request.url);
  const { body, status } = handleGetPayment(paymentId, url.pathname, Date.now());
  return NextResponse.json(body, { status });
}
