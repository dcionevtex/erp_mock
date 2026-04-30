export const runtime = 'nodejs';

import { buildServerConfig, getMissingCredentials, buildConfigForAccount } from '@/lib/config';
import { createVtexClient } from '@/lib/vtexClient';

async function getConfig(request: Request) {
  const account = new URL(request.url).searchParams.get('account');
  const cfg = account
    ? (await buildConfigForAccount(account)) ?? (await buildServerConfig())
    : await buildServerConfig();
  return cfg;
}

export async function GET(request: Request): Promise<Response> {
  const cfg = await getConfig(request);
  const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
  if (missing.length > 0) {
    return Response.json({ error: 'VTEX credentials not configured', missing }, { status: 401 });
  }
  try {
    const client = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);
    const data = await client.getFeedConfig();
    return Response.json({ ok: true, data });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    return Response.json({ error: e.message ?? 'VTEX error', status: e.status }, { status: e.status ?? 502 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const cfg = await getConfig(request);
  const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
  if (missing.length > 0) {
    return Response.json({ error: 'VTEX credentials not configured', missing }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    const client = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);
    const data = await client.saveFeedConfig(payload);
    return Response.json({ ok: true, data: data ?? null });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    return Response.json({ error: e.message ?? 'VTEX error', status: e.status }, { status: e.status ?? 502 });
  }
}
