import { NextResponse } from 'next/server';
import { handleManifest } from '@/lib/pppHandlers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const url = new URL(request.url);
  return NextResponse.json(handleManifest(account, url.pathname, Date.now()));
}
