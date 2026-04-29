export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { buildServerConfig, getPublicConfig } from '@/lib/config';
import { setConfigOverrides, setServerSecrets } from '@/lib/store';
import type { IntegrationMode } from '@/types';

export async function GET(_request: Request): Promise<Response> {
  const publicConfig = getPublicConfig(buildServerConfig());
  return Response.json({ config: publicConfig });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // Save non-secret overrides
  const configUpdate: Record<string, unknown> = {};
  if (typeof b.account === 'string') configUpdate.account = b.account;
  if (typeof b.environment === 'string') configUpdate.environment = b.environment;
  if (b.integrationMode === 'FEED' || b.integrationMode === 'HOOK') {
    configUpdate.integrationMode = b.integrationMode as IntegrationMode;
  }
  if (typeof b.autoCommitFeed === 'boolean') configUpdate.autoCommitFeed = b.autoCommitFeed;
  if (typeof b.simulateErpFailure === 'boolean') configUpdate.simulateErpFailure = b.simulateErpFailure;
  setConfigOverrides(configUpdate as Parameters<typeof setConfigOverrides>[0]);

  // Save secret overrides (server-only, never returned to client)
  const secrets: { appToken?: string; appKey?: string } = {};
  if (typeof b.appToken === 'string' && b.appToken.length > 0) secrets.appToken = b.appToken;
  if (typeof b.appKey === 'string' && b.appKey.length > 0) secrets.appKey = b.appKey;
  if (Object.keys(secrets).length > 0) setServerSecrets(secrets);

  return Response.json({ ok: true, config: getPublicConfig(buildServerConfig()) });
}
