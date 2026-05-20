import { NextResponse } from 'next/server';
import { listCallLog, clearCallLog, listPayments, clearPayments } from '@/lib/pppStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    calls: listCallLog(),
    payments: listPayments(),
  });
}

export async function DELETE() {
  clearCallLog();
  clearPayments();
  return NextResponse.json({ ok: true });
}
