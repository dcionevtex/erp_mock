// POST /api/promotion/[account]/calculatePromotion — the VTEX External Promotions
// Protocol's calculate endpoint. The path segment matches the protocol's literal
// endpoint name (calculatePromotion, not calculate-promotion) since VTEX support
// configures the exact URL you give them — it isn't rewritten on VTEX's side.
// There's no self-service registration for this protocol: this URL (and notifyUsage)
// is handed to VTEX support in a ticket, along with the auth header name/value from
// the Scenario tab.

import { NextResponse } from 'next/server';
import { handleCalculatePromotion } from '@/lib/promotionHandlers';
import type { CalculatePromotionRequest } from '@/types/promotion';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const start = Date.now();
  const { account } = await params;
  const url = new URL(request.url);

  // VTEX sends Content-Type: application/json; charset=utf-8 — parse via text() +
  // JSON.parse() rather than request.json() to avoid any strict content-type matching.
  let body: CalculatePromotionRequest = { correlationId: '', origin: 'Marketplace', salesChannelId: '', items: [] };
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as CalculatePromotionRequest;
  } catch {
    // malformed body — proceed with empty items rather than failing the demo call
  }

  const result = handleCalculatePromotion(account, body, request.headers, url.pathname, start);
  return NextResponse.json(result.body, { status: result.status });
}
