import { NextResponse } from 'next/server';
import { handleCancellation } from '@/lib/pppHandlers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scenario: string; paymentId: string }> }
) {
  const { paymentId } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const url = new URL(request.url);
  return NextResponse.json(handleCancellation(paymentId, body, url.pathname, Date.now()));
}
