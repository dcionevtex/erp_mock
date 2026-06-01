// Server-side proxy for the VTEX Gift Card Hub API.
// Keeps VTEX credentials server-side and avoids CORS issues.
//
// POST body shape:
//   action: 'list'         → GET /api/giftcardproviders
//   action: 'register'     → PUT /api/giftcardproviders/{providerId}
//   appKey, appToken       → VTEX admin credentials
//   environment            → defaults to vtexcommercestable.com.br
//   serviceUrl             → provider service URL (for register)
//   providerId             → provider ID (for register)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Hardcoded provider-side credentials — what VTEX uses to authenticate
// TO our mock endpoints. Fixed values just for this demo exercise.
const PROVIDER_APP_KEY   = 'accountkey';
const PROVIDER_APP_TOKEN = 'accountoken';

type HubRequest = {
  action: 'list' | 'register';
  appKey: string;
  appToken: string;
  environment?: string;
  serviceUrl?: string;
  providerId?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;

  let body: HubRequest;
  try {
    body = await request.json() as HubRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, appKey, appToken, environment = 'vtexcommercestable.com.br' } = body;

  if (!appKey || !appToken) {
    return NextResponse.json({ error: 'appKey and appToken are required' }, { status: 400 });
  }

  const baseVtex = `https://${account}.${environment}/api/giftcardproviders`;
  const headers: Record<string, string> = {
    'X-VTEX-API-AppKey':   appKey,
    'X-VTEX-API-AppToken': appToken,
    'Content-Type':        'application/json',
    'Accept':              'application/json',
  };

  if (action === 'list') {
    const res = await fetch(baseVtex, { headers });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    return NextResponse.json({ ok: res.ok, status: res.status, data });
  }

  if (action === 'register') {
    const { serviceUrl, providerId } = body;
    if (!serviceUrl || !providerId) {
      return NextResponse.json({ error: 'serviceUrl and providerId are required for register' }, { status: 400 });
    }

    const providerBody = {
      serviceUrl,
      appKey:           PROVIDER_APP_KEY,
      appToken:         PROVIDER_APP_TOKEN,
      oauthProvider:    'vtex',
      preAuthEnabled:   false,
      cancelEnabled:    true,
    };

    const res = await fetch(`${baseVtex}/${encodeURIComponent(providerId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(providerBody),
    });

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    return NextResponse.json({ ok: res.ok, status: res.status, data, sentBody: providerBody });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
