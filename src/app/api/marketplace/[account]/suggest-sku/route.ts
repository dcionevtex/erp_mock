import { NextRequest, NextResponse } from 'next/server';
import type { MktSuggestRequest } from '@/types/marketplace';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  let body: MktSuggestRequest;

  try {
    body = await req.json() as MktSuggestRequest;
  } catch {
    return NextResponse.json({ ok: false, vtexStatus: 400, message: 'Invalid JSON' }, { status: 400 });
  }

  const { sellerId, sellerSkuId, appKey, appToken, payload } = body;

  if (!sellerId || !sellerSkuId || !appKey || !appToken) {
    return NextResponse.json(
      { ok: false, vtexStatus: 400, message: 'sellerId, sellerSkuId, appKey and appToken are required' },
      { status: 400 },
    );
  }

  const url = `https://${account}.vtexcommercestable.com.br/api/suggestions/${encodeURIComponent(sellerId)}/${encodeURIComponent(sellerSkuId)}`;

  let vtexRes: Response;
  try {
    vtexRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-VTEX-API-AppKey': appKey,
        'X-VTEX-API-AppToken': appToken,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error calling VTEX';
    return NextResponse.json({ ok: false, vtexStatus: 0, message: msg }, { status: 502 });
  }

  const vtexStatus = vtexRes.status;
  let data: unknown;
  try {
    const text = await vtexRes.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (vtexStatus === 200) {
    return NextResponse.json({ ok: true, vtexStatus, message: 'Suggestion sent successfully', data });
  }
  if (vtexStatus === 304) {
    return NextResponse.json({ ok: true, vtexStatus, message: 'SKU already exists in the marketplace catalog', data });
  }

  return NextResponse.json(
    { ok: false, vtexStatus, message: `VTEX returned ${vtexStatus}`, data },
    { status: vtexStatus >= 400 && vtexStatus < 600 ? vtexStatus : 502 },
  );
}
