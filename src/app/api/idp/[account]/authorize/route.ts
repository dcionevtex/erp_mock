import { NextRequest, NextResponse } from 'next/server';
import { getIdpConfig, issueCode, appendIdpCall } from '@/lib/idpStore';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const start = Date.now();

  let email: string, password: string, state: string, redirectUri: string;
  try {
    const form = await req.formData();
    email = (form.get('email') as string | null) ?? '';
    password = (form.get('password') as string | null) ?? '';
    state = (form.get('state') as string | null) ?? '';
    redirectUri = (form.get('redirect_uri') as string | null) ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const config = getIdpConfig(account);
  const user = config.users.find(u => u.email === email && u.password === password);

  if (!user) {
    appendIdpCall(account, {
      endpoint: 'authorize',
      method: 'POST',
      account,
      email,
      success: false,
      statusCode: 401,
      details: 'Invalid credentials',
    });
    // Redirect back to login page with error
    const loginUrl = new URL(`/idp/${account}/authorize`, req.url);
    loginUrl.searchParams.set('state', state);
    loginUrl.searchParams.set('redirect_uri', redirectUri);
    loginUrl.searchParams.set('error', 'Invalid email or password');
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  const code = issueCode(account, {
    email: user.email,
    name: user.name,
    userId: user.email, // use email as userId for simplicity
    state,
    redirectUri,
    createdAt: Date.now(),
  });

  appendIdpCall(account, {
    endpoint: 'authorize',
    method: 'POST',
    account,
    email: user.email,
    success: true,
    statusCode: 302,
    details: `Code issued for ${user.name} (${Math.round(Date.now() - start)}ms)`,
  });

  const callback = new URL(redirectUri);
  callback.searchParams.set('code', code);
  callback.searchParams.set('state', state);
  return NextResponse.redirect(callback, { status: 302 });
}
