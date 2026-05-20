import { NextResponse } from 'next/server';
import { handleManifest } from '@/lib/pppHandlers';
import { getPppConfig } from '@/lib/pppStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  getPppConfig(); // ensure store is initialised
  return NextResponse.json(handleManifest(url.pathname, Date.now()));
}
