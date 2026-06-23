import { NextRequest, NextResponse } from 'next/server';
import { getIdpConfig, setIdpUsers, resetIdpSecret } from '@/lib/idpStore';
import type { IdpUser } from '@/types/idp';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  return NextResponse.json(getIdpConfig(account));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  let body: { action?: string; users?: IdpUser[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.action === 'resetSecret') {
    return NextResponse.json(resetIdpSecret(account));
  }

  if (Array.isArray(body.users)) {
    return NextResponse.json(setIdpUsers(account, body.users));
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
