import { NextRequest, NextResponse } from 'next/server';
import { lookupToken, appendIdpCall } from '@/lib/idpStore';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const start = Date.now();

  // Bearer token from Authorization header, or access_token query param
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.nextUrl.searchParams.get('access_token') ?? '');

  if (!token) {
    appendIdpCall(account, {
      endpoint: 'userinfo',
      method: 'GET',
      account,
      success: false,
      statusCode: 401,
      details: 'Missing access token',
    });
    return NextResponse.json({ error: 'invalid_token', error_description: 'Missing access token' }, { status: 401 });
  }

  const tokenEntry = lookupToken(account, token);
  if (!tokenEntry) {
    appendIdpCall(account, {
      endpoint: 'userinfo',
      method: 'GET',
      account,
      success: false,
      statusCode: 401,
      details: 'Invalid or expired token',
    });
    return NextResponse.json({ error: 'invalid_token', error_description: 'Token is invalid or expired' }, { status: 401 });
  }

  appendIdpCall(account, {
    endpoint: 'userinfo',
    method: 'GET',
    account,
    email: tokenEntry.email,
    success: true,
    statusCode: 200,
    details: `User info returned for ${tokenEntry.email} (${Math.round(Date.now() - start)}ms)`,
  });

  return NextResponse.json({
    userId: tokenEntry.userId,
    email: tokenEntry.email,
    name: tokenEntry.name,
  });
}

// VTEX may also call userinfo via POST
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ account: string }> },
) {
  return GET(req, context);
}
