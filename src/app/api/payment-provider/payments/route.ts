import { NextResponse } from 'next/server';
import { handleCreatePayment } from '@/lib/pppHandlers';
import { getPppConfig } from '@/lib/pppStore';
import type { PppCreatePaymentRequest } from '@/types/ppp';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: PppCreatePaymentRequest;
  try {
    body = await request.json() as PppCreatePaymentRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const url = new URL(request.url);
  const { scenario } = getPppConfig();
  return NextResponse.json(handleCreatePayment(body, url.pathname, scenario, Date.now()));
}
