import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getPayment, upsertPayment, appendCallLog } from '@/lib/pppStore';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const start = Date.now();
  const url = new URL(request.url);
  const { paymentId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const record = getPayment(paymentId);
  const now = new Date().toISOString();
  const settleId = randomUUID();

  if (record) {
    upsertPayment({ ...record, settleId, settledAt: now });
  }

  const responseBody = {
    paymentId,
    settleId,
    value: body.value ?? null,
    code: null,
    message: 'Successfully settled',
    requestId: body.requestId ?? null,
  };

  appendCallLog({
    timestamp: now,
    method: 'POST',
    path: url.pathname,
    paymentId,
    requestBody: body,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return NextResponse.json(responseBody);
}
