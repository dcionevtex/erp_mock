// POST /api/tax/[account]/calculate-tax — the VTEX Tax Service protocol endpoint.
// This is the URL registered as orderForm.taxConfiguration.url. VTEX Checkout calls it
// synchronously on every cart change with a 5s timeout and no retry.

import { NextResponse } from 'next/server';
import { handleCalculateTax } from '@/lib/taxHandlers';
import type { TaxCalculationRequest } from '@/types/tax';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const start = Date.now();
  const { account } = await params;
  const url = new URL(request.url);

  // Use text() + JSON.parse() instead of json() — Checkout sends a custom Content-Type
  // (application/vnd.vtex.checkout.minicart.v1+json), same reason gift-card does this.
  let body: TaxCalculationRequest = { items: [] };
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as TaxCalculationRequest;
  } catch {
    // malformed body — proceed with empty items rather than failing the demo call
  }

  const authHeader = request.headers.get('authorization');
  const serviceUrl = `${url.origin}/api/tax/${account}`;
  const result = handleCalculateTax(account, body, authHeader, url.pathname, start, serviceUrl);
  return NextResponse.json(result.body, { status: result.status });
}
