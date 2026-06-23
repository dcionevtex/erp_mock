import { NextRequest, NextResponse } from 'next/server';
import { listIdpCalls, clearIdpCalls } from '@/lib/idpStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  return NextResponse.json({ calls: listIdpCalls(account) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  clearIdpCalls(account);
  return NextResponse.json({ ok: true });
}
