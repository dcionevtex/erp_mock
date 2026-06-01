import { NextResponse } from 'next/server';
import { getGcConfig, setGcConfig, listCards, listCallLog, clearAll } from '@/lib/giftCardStore';
import type { GcScenario } from '@/types/giftCard';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const config = getGcConfig(account);
  const cards = listCards(account);
  const calls = listCallLog(account);
  return NextResponse.json({ config, cards, calls });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const body = await request.json() as { scenario?: GcScenario; mockBalance?: number; currencyCode?: string; clear?: boolean };

  if (body.clear) {
    clearAll(account);
    return NextResponse.json({ ok: true });
  }

  const current = getGcConfig(account);
  setGcConfig(
    account,
    body.scenario ?? current.scenario,
    body.mockBalance ?? current.mockBalance,
    body.currencyCode ?? current.currencyCode,
  );

  return NextResponse.json({ ok: true, config: getGcConfig(account) });
}
