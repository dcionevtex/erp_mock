import { NextResponse } from 'next/server';
import { listTaxCallLog } from '@/lib/taxStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  return NextResponse.json(listTaxCallLog(account));
}
