import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getPppConfig, upsertPayment, appendCallLog } from '@/lib/pppStore';
import type { PppCreatePaymentRequest } from '@/types/ppp';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const start = Date.now();
  const url = new URL(request.url);
  let body: PppCreatePaymentRequest;

  try {
    body = await request.json() as PppCreatePaymentRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { scenario } = getPppConfig();
  const paymentId = body.paymentId ?? randomUUID();
  const now = new Date().toISOString();

  upsertPayment({
    paymentId,
    orderId: body.orderId,
    transactionId: body.transactionId,
    paymentMethod: body.paymentMethod,
    value: body.value,
    currency: body.currency,
    installments: body.installments,
    callbackUrl: body.callbackUrl,
    status: scenario,
    scenario,
    authorizationId: scenario === 'approved' ? randomUUID() : undefined,
    createdAt: now,
    requestBody: body,
  });

  const responseBody = buildPaymentResponse(paymentId, scenario);

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

function buildPaymentResponse(paymentId: string, scenario: string) {
  const base = {
    paymentId,
    tid: randomUUID(),
    acquirer: 'VTEX Demo Acquirer',
    code: null as string | null,
    message: null as string | null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };

  switch (scenario) {
    case 'approved':
      return { ...base, status: 'approved', authorizationId: randomUUID(), nsu: String(Date.now()) };
    case 'denied':
      return { ...base, status: 'denied', authorizationId: null, nsu: null, message: 'Payment denied by simulator' };
    case 'pending':
      return { ...base, status: 'pending', authorizationId: null, nsu: null, message: 'Awaiting async callback' };
    case 'undefined':
      return { ...base, status: 'undefined', authorizationId: null, nsu: null, message: 'Payment status undefined — callback required' };
    default:
      return { ...base, status: 'approved', authorizationId: randomUUID(), nsu: String(Date.now()) };
  }
}
