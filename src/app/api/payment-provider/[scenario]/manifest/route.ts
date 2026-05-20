import { NextResponse } from 'next/server';
import { handleManifest } from '@/lib/pppHandlers';
import type { PppScenario } from '@/types/ppp';

export const dynamic = 'force-dynamic';

const VALID: PppScenario[] = ['approved', 'denied', 'pending', 'undefined'];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ scenario: string }> }
) {
  const { scenario } = await params;
  if (!VALID.includes(scenario as PppScenario)) {
    return NextResponse.json({ error: `Unknown scenario: ${scenario}` }, { status: 404 });
  }
  const url = new URL(request.url);
  return NextResponse.json(handleManifest(url.pathname, Date.now()));
}
