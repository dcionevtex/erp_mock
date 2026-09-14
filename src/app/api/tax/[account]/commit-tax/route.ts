// POST /api/tax/[account]/commit-tax — the Tax Service protocol's "commit" hook.
// Per the Recipe doc, this is "the same route that is on the hooks object on the
// provider's response to the Checkout API after calculating the taxes" — VTEX calls it
// back when the order status changes, to confirm the previously-calculated taxes.
// See the comment on handleCommitTax in taxHandlers.ts for what a real integration
// would do here.

import { NextResponse } from 'next/server';
import { handleCommitTax } from '@/lib/taxHandlers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const start = Date.now();
  const { account } = await params;
  const url = new URL(request.url);

  let body: unknown = null;
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    // malformed/empty body — still acknowledge the call
  }

  const result = handleCommitTax(account, body, url.pathname, start);
  return NextResponse.json(result.body, { status: result.status });
}
