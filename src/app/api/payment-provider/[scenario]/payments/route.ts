import { NextResponse } from 'next/server';
import { handleCreatePayment } from '@/lib/pppHandlers';
import type { PppScenario, PppCreatePaymentRequest } from '@/types/ppp';

export const dynamic = 'force-dynamic';

const VALID: PppScenario[] = ['approved', 'denied', 'pending', 'undefined'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scenario: string }> }
) {
  const { scenario } = await params;
  if (!VALID.includes(scenario as PppScenario)) {
    return NextResponse.json({ error: `Unknown scenario: ${scenario}` }, { status: 404 });
  }

  let body: PppCreatePaymentRequest;
  try {
    body = await request.json() as PppCreatePaymentRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const url = new URL(request.url);
  const responseBody = handleCreatePayment(body, url.pathname, scenario as PppScenario, Date.now());
  return NextResponse.json(responseBody);
}
