import { NextResponse } from 'next/server';
import { appendCallLog } from '@/lib/pppStore';
import type { PppManifest } from '@/types/ppp';

export const dynamic = 'force-dynamic';

const MANIFEST: PppManifest = {
  paymentMethods: [
    { name: 'Visa', allowsSplit: 'onAuthorize' },
    { name: 'Mastercard', allowsSplit: 'onAuthorize' },
    { name: 'American Express', allowsSplit: 'onAuthorize' },
    { name: 'Boleto Bancário', allowsSplit: 'disabled' },
    { name: 'Pix', allowsSplit: 'disabled' },
  ],
  customFields: [],
  autoSettleDelay: { minimum: '0', maximum: '720' },
};

export async function GET(request: Request) {
  const start = Date.now();
  const url = new URL(request.url);

  appendCallLog({
    timestamp: new Date().toISOString(),
    method: 'GET',
    path: url.pathname,
    responseBody: MANIFEST,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return NextResponse.json(MANIFEST);
}
