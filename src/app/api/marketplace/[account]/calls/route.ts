import { NextRequest, NextResponse } from 'next/server';
import { listCallLog, clearAll } from '@/lib/marketplaceStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  return NextResponse.json({ calls: listCallLog(account) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  clearAll(account);
  return NextResponse.json({ ok: true });
}
