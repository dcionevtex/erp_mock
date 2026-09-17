// POST /api/promotion/[account]/notifyUsage — the External Promotions Protocol's
// notifyUsage endpoint. The path segment matches the protocol's literal endpoint name.
// VTEX calls this when an order is placed or cancelled; retried up to 3x with backoff,
// so a real integration must process it idempotently.
//
// Request validation (orderId, type enum, promotionUsages shape) happens inside
// handleNotifyUsage so malformed/invalid bodies are logged and correctly rejected with
// 400 rather than silently defaulted to a valid-looking shape.

import { NextResponse } from 'next/server';
import { handleNotifyUsage } from '@/lib/promotionHandlers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const start = Date.now();
  const { account } = await params;
  const url = new URL(request.url);

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    // malformed JSON — pass the empty object through; validateNotifyUsageRequest
    // rejects it with a 400 the same way it would any other missing-field body.
  }

  const result = handleNotifyUsage(account, body, request.headers, url.pathname, start);
  return NextResponse.json(result.body, { status: result.status });
}
