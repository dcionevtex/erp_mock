import { NextResponse } from 'next/server';
import { listCallLog, listPayments, clearAll } from '@/lib/pppStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  return NextResponse.json({
    calls: listCallLog(account),
    payments: listPayments(account),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  clearAll(account);
  return NextResponse.json({ ok: true });
}
