// POST /api/gift-card/[account]/giftcards — explicit card creation (optional protocol endpoint)

import { NextResponse } from 'next/server';
import { handleCreateCard } from '@/lib/giftCardHandlers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const start = Date.now();
  const { account } = await params;
  const url = new URL(request.url);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // body is optional for this endpoint
  }

  const result = handleCreateCard(account, body, url.pathname, start);
  return NextResponse.json(result.body, { status: result.status });
}
