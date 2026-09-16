import { NextResponse } from 'next/server';
import { listPromotionCallLog } from '@/lib/promotionStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  return NextResponse.json(listPromotionCallLog(account));
}
