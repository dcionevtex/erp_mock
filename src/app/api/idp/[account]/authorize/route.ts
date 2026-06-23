import { NextRequest, NextResponse } from 'next/server';
import { issueCode, appendIdpCall } from '@/lib/idpStore';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const start = Date.now();

  let email: string, state: string, redirectUri: string;
  try {
    const form = await req.formData();
    email = ((form.get('email') as string | null) ?? '').trim();
    state = (form.get('state') as string | null) ?? '';
    redirectUri = (form.get('redirect_uri') as string | null) ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  if (!email) {
    const loginUrl = new URL(`/idp/${account}/authorize`, req.url);
    loginUrl.searchParams.set('state', state);
    loginUrl.searchParams.set('redirect_uri', redirectUri);
    loginUrl.searchParams.set('error', 'Email is required');
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  // Any email accepted — derive a display name from the local part
  const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const code = issueCode(account, {
    email,
    name,
    userId: email,
    state,
    redirectUri,
    createdAt: Date.now(),
  });

  appendIdpCall(account, {
    endpoint: 'authorize',
    method: 'POST',
    account,
    email,
    success: true,
    statusCode: 302,
    details: `Code issued for ${name} (${Math.round(Date.now() - start)}ms)`,
  });

  const callback = new URL(redirectUri);
  callback.searchParams.set('code', code);
  callback.searchParams.set('state', state);
  return NextResponse.redirect(callback, { status: 302 });
}
