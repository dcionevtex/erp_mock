import { NextResponse } from 'next/server';
import { getPayment, appendCallLog } from '@/lib/pppStore';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const start = Date.now();
  const url = new URL(request.url);
  const { paymentId } = await params;

  const record = getPayment(paymentId);

  if (!record) {
    appendCallLog({
      timestamp: new Date().toISOString(),
      method: 'GET',
      path: url.pathname,
      paymentId,
      responseBody: { error: 'Payment not found' },
      httpStatus: 404,
      durationMs: Date.now() - start,
    });
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  const responseBody = {
    paymentId: record.paymentId,
    status: record.status,
    authorizationId: record.authorizationId ?? null,
    nsu: null,
    acquirer: 'VTEX Demo Acquirer',
    code: null,
    message: null,
  };

  appendCallLog({
    timestamp: new Date().toISOString(),
    method: 'GET',
    path: url.pathname,
    paymentId,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return NextResponse.json(responseBody);
}
