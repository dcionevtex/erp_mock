import { NextRequest, NextResponse } from 'next/server';
import { issueCode, appendIdpCall } from '@/lib/idpStore';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const start = Date.now();

  let email: string, phone: string, state: string, redirectUri: string;
  try {
    const form = await req.formData();
    email = ((form.get('email') as string | null) ?? '').trim();
    phone = ((form.get('phone') as string | null) ?? '').trim();
    state = (form.get('state') as string | null) ?? '';
    redirectUri = (form.get('redirect_uri') as string | null) ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  let effectiveEmail: string;
  let name: string;

  if (phone) {
    // Strip everything except digits — no + in the email local part
    const digits = phone.replace(/\D/g, '');
    if (!digits) {
      const loginUrl = new URL(`/idp/${account}/authorize`, req.url);
      loginUrl.searchParams.set('state', state);
      loginUrl.searchParams.set('redirect_uri', redirectUri);
      loginUrl.searchParams.set('error', 'Enter a valid phone number');
      return NextResponse.redirect(loginUrl, { status: 302 });
    }
    effectiveEmail = `${digits}@${account}.com`;
    name = phone.startsWith('+') ? phone : `+${digits}`;
  } else if (email) {
    effectiveEmail = email;
    name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } else {
    const loginUrl = new URL(`/idp/${account}/authorize`, req.url);
    loginUrl.searchParams.set('state', state);
    loginUrl.searchParams.set('redirect_uri', redirectUri);
    loginUrl.searchParams.set('error', 'Email or phone is required');
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  const email_used = effectiveEmail;

  const code = issueCode(account, {
    email: email_used,
    name,
    userId: email_used,
    state,
    redirectUri,
    createdAt: Date.now(),
  });

  appendIdpCall(account, {
    endpoint: 'authorize',
    method: 'POST',
    account,
    email: email_used,
    success: true,
    statusCode: 302,
    details: `Code issued for ${name} → ${email_used} (${Math.round(Date.now() - start)}ms)`,
  });

  const callback = new URL(redirectUri);
  callback.searchParams.set('code', code);
  callback.searchParams.set('state', state);
  return NextResponse.redirect(callback, { status: 302 });
}
