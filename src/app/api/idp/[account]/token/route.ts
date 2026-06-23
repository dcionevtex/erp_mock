import { NextRequest, NextResponse } from 'next/server';
import { getIdpConfig, consumeCode, issueToken, appendIdpCall } from '@/lib/idpStore';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const start = Date.now();

  let clientId = '', clientSecret = '', code = '', grantType = '';
  const contentType = req.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const body = await req.json() as Record<string, string>;
      clientId = body.client_id ?? '';
      clientSecret = body.client_secret ?? '';
      code = body.code ?? '';
      grantType = body.grant_type ?? '';
    } else {
      const form = await req.formData();
      clientId = (form.get('client_id') as string | null) ?? '';
      clientSecret = (form.get('client_secret') as string | null) ?? '';
      code = (form.get('code') as string | null) ?? '';
      grantType = (form.get('grant_type') as string | null) ?? '';
    }
  } catch (e) {
    appendIdpCall(account, {
      endpoint: 'token',
      method: 'POST',
      account,
      success: false,
      statusCode: 400,
      details: `Body parse error (content-type: ${contentType}): ${String(e)}`,
    });
    return NextResponse.json({ error: 'invalid_request', error_description: 'Could not parse request body' }, { status: 400 });
  }

  // Log every token attempt immediately — so we can see what VTEX sends even on failure
  const received = `grant_type=${grantType || '(empty)'} client_id=${clientId || '(empty)'} code=${code ? code.slice(0, 8) + '…' : '(empty)'}`;

  // grant_type is optional — we're a mock, accept anything or nothing
  if (grantType && grantType !== 'authorization_code') {
    appendIdpCall(account, {
      endpoint: 'token',
      method: 'POST',
      account,
      success: false,
      statusCode: 400,
      details: `Unsupported grant_type: ${grantType}. Received: ${received}`,
    });
    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }

  const config = getIdpConfig(account);

  if (clientId !== config.clientId || clientSecret !== config.clientSecret) {
    appendIdpCall(account, {
      endpoint: 'token',
      method: 'POST',
      account,
      success: false,
      statusCode: 401,
      details: `Invalid credentials. Received clientId="${clientId}". Expected "${config.clientId}". ${received}`,
    });
    return NextResponse.json({ error: 'invalid_client', error_description: 'Invalid client_id or client_secret' }, { status: 401 });
  }

  const codeEntry = consumeCode(account, code);
  if (!codeEntry) {
    appendIdpCall(account, {
      endpoint: 'token',
      method: 'POST',
      account,
      success: false,
      statusCode: 400,
      details: `Invalid or expired code: ${code ? code.slice(0, 8) + '…' : '(empty)'}. ${received}`,
    });
    return NextResponse.json({ error: 'invalid_grant', error_description: 'Code is invalid or expired' }, { status: 400 });
  }

  const accessToken = issueToken(account, {
    email: codeEntry.email,
    name: codeEntry.name,
    userId: codeEntry.userId,
    createdAt: Date.now(),
  });

  appendIdpCall(account, {
    endpoint: 'token',
    method: 'POST',
    account,
    email: codeEntry.email,
    success: true,
    statusCode: 200,
    details: `Token issued for ${codeEntry.email} (${Math.round(Date.now() - start)}ms)`,
  });

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
  });
}
