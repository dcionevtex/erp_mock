// Server-side proxy for registering this simulator as the account's Tax Service provider.
// Keeps VTEX admin credentials server-side and avoids CORS issues — same pattern as the
// Gift Card Hub proxy (src/app/api/gift-card/[account]/hub/route.ts).
//
// Unlike PPP/Gift Card/Marketplace, the Tax Service protocol has no dedicated hub API —
// registration happens by reading and rewriting orderForm.taxConfiguration via the
// Checkout API. The spec requires sending the *entire* orderForm config back on update,
// so 'register' fetches the current config first and merges in taxConfiguration only.
//
// POST body shape:
//   action: 'get'       → GET  /api/checkout/pvt/configuration/orderForm
//   action: 'register'  → GET current config, merge taxConfiguration, POST it back
//   appKey, appToken     → VTEX admin credentials
//   environment           → defaults to vtexcommercestable.com.br
//   serviceUrl, authorizationHeader, isMarketplaceResponsibleForTaxes → for register

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RegisterRequest = {
  action: 'get' | 'register';
  appKey: string;
  appToken: string;
  environment?: string;
  serviceUrl?: string;
  authorizationHeader?: string;
  isMarketplaceResponsibleForTaxes?: boolean;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;

  let body: RegisterRequest;
  try {
    body = (await request.json()) as RegisterRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, appKey, appToken, environment = 'vtexcommercestable.com.br' } = body;

  if (!appKey || !appToken) {
    return NextResponse.json({ error: 'appKey and appToken are required' }, { status: 400 });
  }

  const configUrl = `https://${account}.${environment}/api/checkout/pvt/configuration/orderForm`;
  const headers: Record<string, string> = {
    'X-VTEX-API-AppKey': appKey,
    'X-VTEX-API-AppToken': appToken,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (action === 'get') {
    const res = await fetch(configUrl, { headers });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    return NextResponse.json({ ok: res.ok, status: res.status, data });
  }

  if (action === 'register') {
    const { serviceUrl, authorizationHeader, isMarketplaceResponsibleForTaxes } = body;
    if (!serviceUrl || !authorizationHeader) {
      return NextResponse.json(
        { error: 'serviceUrl and authorizationHeader are required for register' },
        { status: 400 },
      );
    }

    const currentRes = await fetch(configUrl, { headers });
    if (!currentRes.ok) {
      const text = await currentRes.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = text; }
      return NextResponse.json({ ok: false, status: currentRes.status, data, step: 'get-current-config' });
    }
    const current = (await currentRes.json()) as Record<string, unknown>;

    const taxConfiguration = {
      url: serviceUrl,
      authorizationHeader,
      appId: `${account}-TaxMock`,
      isMarketplaceResponsibleForTaxes: isMarketplaceResponsibleForTaxes ?? true,
    };

    // Spec: "You must send the entire orderForm in the request body" — merge, don't replace.
    const updated = { ...current, taxConfiguration };

    const res = await fetch(configUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(updated),
    });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    return NextResponse.json({ ok: res.ok, status: res.status, data, sentBody: taxConfiguration });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
