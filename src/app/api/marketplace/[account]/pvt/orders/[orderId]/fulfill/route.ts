import { NextRequest, NextResponse } from 'next/server';
import { handleAuthorize } from '@/lib/marketplaceHandlers';
import { appendCallLog } from '@/lib/marketplaceStore';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string; orderId: string }> },
) {
  const start = Date.now();
  const { account, orderId } = await params;
  const pathname = new URL(req.url).pathname;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }

  try {
    const responseBody = handleAuthorize(account, orderId, raw as Record<string, unknown>, pathname, start);
    return NextResponse.json(responseBody);
  } catch (e) {
    const body = { error: 'Authorize handler failed', detail: String(e) };
    appendCallLog(account, { timestamp: new Date().toISOString(), method: 'POST', path: pathname, account, orderId, endpoint: 'fulfill', requestBody: raw, responseBody: body, httpStatus: 500, durationMs: Date.now() - start });
    return NextResponse.json(body, { status: 500 });
  }
}
