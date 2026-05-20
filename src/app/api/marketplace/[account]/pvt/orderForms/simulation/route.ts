import { NextRequest, NextResponse } from 'next/server';
import { getMktConfig } from '@/lib/marketplaceStore';
import { handleSimulation } from '@/lib/marketplaceHandlers';
import type { MktSimulationRequest } from '@/types/marketplace';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> },
) {
  const start = Date.now();
  const { account } = await params;
  const body = await req.json() as MktSimulationRequest;
  const { scenario } = getMktConfig(account);
  const responseBody = handleSimulation(account, body, new URL(req.url).pathname, scenario, start);
  return NextResponse.json(responseBody);
}
