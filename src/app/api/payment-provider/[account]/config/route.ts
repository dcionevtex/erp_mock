import { NextResponse } from 'next/server';
import { getPppConfig, setPppScenario } from '@/lib/pppStore';
import type { PppScenario } from '@/types/ppp';

export const dynamic = 'force-dynamic';

const VALID_SCENARIOS: PppScenario[] = ['approved', 'denied', 'pending', 'undefined'];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  return NextResponse.json(getPppConfig(account));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  let body: { scenario?: string };
  try {
    body = await request.json() as { scenario?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const scenario = body.scenario as PppScenario;
  if (!VALID_SCENARIOS.includes(scenario)) {
    return NextResponse.json(
      { error: `Invalid scenario. Must be one of: ${VALID_SCENARIOS.join(', ')}` },
      { status: 400 },
    );
  }

  setPppScenario(account, scenario);
  return NextResponse.json(getPppConfig(account));
}
