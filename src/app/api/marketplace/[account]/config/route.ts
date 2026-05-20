import { NextRequest, NextResponse } from 'next/server';
import { getMktConfig, setMktScenario } from '@/lib/marketplaceStore';
import type { MktScenario } from '@/types/marketplace';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  return NextResponse.json(getMktConfig(account));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const { scenario } = await req.json() as { scenario: MktScenario };
  setMktScenario(account, scenario);
  return NextResponse.json({ ok: true });
}
