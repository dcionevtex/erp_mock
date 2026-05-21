import { NextResponse } from 'next/server';
import { handleSettlement } from '@/lib/pppHandlers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string; paymentId: string }> },
) {
  const { account, paymentId } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const url = new URL(request.url);
  return NextResponse.json(handleSettlement(account, paymentId, body, url.pathname, Date.now()));
}
