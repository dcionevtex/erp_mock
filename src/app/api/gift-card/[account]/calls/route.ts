import { NextResponse } from 'next/server';
import { listCallLog } from '@/lib/giftCardStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  return NextResponse.json(listCallLog(account));
}
