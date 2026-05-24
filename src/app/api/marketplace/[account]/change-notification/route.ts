import { NextRequest, NextResponse } from 'next/server';
import type { MktChangeNotifRequest } from '@/types/marketplace';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  let body: MktChangeNotifRequest;

  try {
    body = await req.json() as MktChangeNotifRequest;
  } catch {
    return NextResponse.json({ ok: false, vtexStatus: 400, message: 'Invalid JSON' }, { status: 400 });
  }

  const { skuId, sellerAccount, appKey, appToken } = body;

  if (!skuId || !sellerAccount || !appKey || !appToken) {
    return NextResponse.json(
      { ok: false, vtexStatus: 400, message: 'skuId, sellerAccount, appKey and appToken are required' },
      { status: 400 },
    );
  }

  const url = `https://${account}.vtexcommercestable.com.br/api/catalog_system/pvt/skuseller/changenotification/${encodeURIComponent(skuId)}?an=${encodeURIComponent(sellerAccount)}`;

  let vtexRes: Response;
  try {
    vtexRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-VTEX-API-AppKey': appKey,
        'X-VTEX-API-AppToken': appToken,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error calling VTEX';
    return NextResponse.json({ ok: false, vtexStatus: 0, message: msg }, { status: 502 });
  }

  const vtexStatus = vtexRes.status;
  const rawText = await vtexRes.text();
  let data: unknown;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText || null;
  }

  if (vtexStatus >= 200 && vtexStatus < 300) {
    return NextResponse.json({ ok: true, vtexStatus, message: 'Change notification sent successfully', data });
  }

  return NextResponse.json(
    {
      ok: false,
      vtexStatus,
      message: `VTEX returned ${vtexStatus}`,
      data,
      sentUrl: url,
    },
    { status: vtexStatus >= 400 && vtexStatus < 600 ? vtexStatus : 502 },
  );
}
