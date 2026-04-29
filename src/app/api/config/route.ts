export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { buildServerConfig, getPublicConfig } from '@/lib/config';
import { setConfigOverrides, setServerSecrets, savePersistedConfig } from '@/lib/store';
import { getSession } from '@/lib/session';
import type { IntegrationMode } from '@/types';

export async function GET(_request: Request): Promise<Response> {
  const publicConfig = getPublicConfig(await buildServerConfig());
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
  const session = await getSession();

  // Non-secret overrides — persisted to session cookie and in-memory store.
  const configUpdate: Record<string, unknown> = {};
  if (typeof b.account === 'string') { configUpdate.account = b.account; session.account = b.account; }
  if (typeof b.environment === 'string') { configUpdate.environment = b.environment; session.environment = b.environment; }
  if (b.integrationMode === 'FEED' || b.integrationMode === 'HOOK') {
    configUpdate.integrationMode = b.integrationMode as IntegrationMode;
    session.integrationMode = b.integrationMode as IntegrationMode;
  }
  if (typeof b.autoCommitFeed === 'boolean') { configUpdate.autoCommitFeed = b.autoCommitFeed; session.autoCommitFeed = b.autoCommitFeed; }
  if (typeof b.simulateErpFailure === 'boolean') { configUpdate.simulateErpFailure = b.simulateErpFailure; session.simulateErpFailure = b.simulateErpFailure; }
  setConfigOverrides(configUpdate as Parameters<typeof setConfigOverrides>[0]);

  // Secrets — encrypted in the session cookie; never returned to client.
  const secrets: { appToken?: string; appKey?: string } = {};
  if (typeof b.appToken === 'string' && b.appToken.length > 0) { secrets.appToken = b.appToken; session.appToken = b.appToken; }
  if (typeof b.appKey === 'string' && b.appKey.length > 0) { secrets.appKey = b.appKey; session.appKey = b.appKey; }
  if (Object.keys(secrets).length > 0) setServerSecrets(secrets);

  await session.save();

  // Persist credentials to DB so server-to-server calls (VTEX webhook) can authenticate
  // without relying on the browser session cookie which VTEX doesn't send.
  const dbFields: Record<string, unknown> = { ...configUpdate };
  if (secrets.appKey) dbFields.appKey = secrets.appKey;
  if (secrets.appToken) dbFields.appToken = secrets.appToken;
  await savePersistedConfig(dbFields);

  return Response.json({ ok: true, config: getPublicConfig(await buildServerConfig()) });
}
