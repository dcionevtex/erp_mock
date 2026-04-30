// src/lib/config.ts
// Server-side configuration reader. Single source of truth for VTEX credentials and demo toggles.
//
// SECURITY (CONFIG-05, SEC-04):
//   - The app token is read here and stored in memory only.
//   - Never log it. Never return it from any API route. Never put it on a type that gets serialized to a client.
//   - Use `getPublicConfig()` to expose configuration to API responses or client code.

import type { AppConfig, AppConfigPublic, IntegrationMode } from '@/types';
import { VTEX_DEFAULT_ENVIRONMENT } from './constants';
import { getConfigOverrides, getServerSecrets, getPersistedConfig } from '@/lib/store';
import { getSession } from '@/lib/session';

// Internal-only: extends AppConfig with the secret token. NEVER export this type.
type ServerAppConfig = AppConfig & {
  appToken: string;
  demoHookSecret: string;
};

function readBoolEnv(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v.toLowerCase() === 'true' || v === '1';
}

function readIntegrationMode(): IntegrationMode {
  // Default to HOOK; if explicitly set to FEED, honor it.
  const v = process.env.INTEGRATION_MODE;
  return v === 'FEED' ? 'FEED' : 'HOOK';
}

/**
 * Read the full server-side config from process.env.
 * Includes the app token — for use ONLY by server-side modules (vtexClient, store).
 * Never call this from a client component or pass the result to a client.
 */
export function getServerConfig(): ServerAppConfig {
  return {
    account: process.env.VTEX_ACCOUNT ?? '',
    environment: process.env.VTEX_ENVIRONMENT ?? VTEX_DEFAULT_ENVIRONMENT,
    appKey: process.env.VTEX_APP_KEY ?? '',
    appToken: process.env.VTEX_APP_TOKEN ?? '',
    demoHookSecret: process.env.DEMO_HOOK_SECRET ?? '',
    integrationMode: readIntegrationMode(),
    autoCommitFeed: readBoolEnv('AUTO_COMMIT_FEED', false),
    simulateErpFailure: readBoolEnv('SIMULATE_ERP_FAILURE', false),
  };
}

/**
 * Build the public-safe config view returned by GET /api/config (Phase 4).
 * Strips appToken and demoHookSecret. Reports their configured-or-not state as booleans.
 */
export function getPublicConfig(serverConfig: ServerAppConfig = getServerConfig()): AppConfigPublic {
  const { appToken, demoHookSecret, ...rest } = serverConfig;
  return {
    ...rest,
    appTokenConfigured: appToken.length > 0,
  };
}

/**
 * Mask a token for safe display in error messages or audit logs.
 * Returns `'***'` for empty input, otherwise first 4 chars + `***` + last 2 chars.
 * NEVER use this to "log the token" — only for diagnostic UI strings.
 */
export function maskToken(token: string | undefined | null): string {
  if (!token) return '***';
  if (token.length <= 6) return '***';
  return `${token.slice(0, 4)}***${token.slice(-2)}`;
}

/**
 * Validate that all required VTEX credentials are present.
 * Returns a list of missing field names; empty list means fully configured.
 */
export function getMissingCredentials(cfg: ServerAppConfig = getServerConfig()): Array<keyof Pick<ServerAppConfig, 'account' | 'environment' | 'appKey' | 'appToken'>> {
  const missing: Array<keyof Pick<ServerAppConfig, 'account' | 'environment' | 'appKey' | 'appToken'>> = [];
  if (!cfg.account) missing.push('account');
  if (!cfg.environment) missing.push('environment');
  if (!cfg.appKey) missing.push('appKey');
  if (!cfg.appToken) missing.push('appToken');
  return missing;
}

/**
 * Build the full server config for use in API route handlers.
 * Merges: env vars → session cookie (persisted UI config) → in-memory overrides (current process).
 * Priority: in-memory wins over cookie wins over env vars — so saves during a session still take
 * immediate effect, and the cookie ensures they survive Vercel cold starts.
 * NEVER pass the result to a client or log it (it contains appToken).
 */
export async function buildServerConfig(): Promise<ReturnType<typeof getServerConfig>> {
  const base = getServerConfig();
  const overrides = getConfigOverrides();
  const secrets = getServerSecrets();

  // Read persisted config from the encrypted session cookie (browser requests).
  // Gracefully skipped if called outside a request context (e.g. unit tests).
  let saved: Partial<ReturnType<typeof getServerConfig>> = {};
  try {
    const session = await getSession();
    const { account, environment, appKey, appToken, integrationMode, autoCommitFeed, simulateErpFailure } = session;
    saved = { account, environment, appKey, appToken, integrationMode, autoCommitFeed, simulateErpFailure };
    // Remove undefined keys so they don't overwrite base values.
    (Object.keys(saved) as Array<keyof typeof saved>).forEach((k) => {
      if (saved[k] === undefined) delete saved[k];
    });
  } catch {
    // Outside request context — ignore.
  }

  // For server-to-server calls (e.g. VTEX webhook) there is no browser cookie.
  // Fall back to credentials persisted in Neon DB so the hook endpoint can authenticate.
  if (!saved.appToken || !saved.appKey) {
    try {
      const persisted = await getPersistedConfig();
      if (!saved.appToken && persisted.appToken) saved.appToken = persisted.appToken as string;
      if (!saved.appKey && persisted.appKey) saved.appKey = persisted.appKey as string;
      if (!saved.account && persisted.account) saved.account = persisted.account as string;
      if (!saved.environment && persisted.environment) saved.environment = persisted.environment as string;
    } catch {
      // DB not available — ignore.
    }
  }

  return {
    ...base,
    ...saved,
    ...overrides,
    appToken: secrets.appToken ?? (saved.appToken as string | undefined) ?? base.appToken,
    appKey: secrets.appKey ?? (saved.appKey as string | undefined) ?? base.appKey,
  };
}

/**
 * Build a full server config for a specific account from the registry.
 * Used by the hook endpoint when ?account= param is present.
 * Returns null if no config is found for the given account.
 */
export async function buildConfigForAccount(account: string): Promise<ReturnType<typeof getServerConfig> | null> {
  const { getAccountConfig } = await import('@/lib/accountRegistry');
  const acct = await getAccountConfig(account);
  if (!acct) return null;
  const base = getServerConfig();
  return {
    ...base,
    account: acct.account,
    environment: acct.environment || base.environment,
    appKey: acct.appKey,
    appToken: acct.appToken,
    integrationMode: (acct.integrationMode as ReturnType<typeof getServerConfig>['integrationMode']) ?? base.integrationMode,
    autoCommitFeed: acct.autoCommitFeed ?? base.autoCommitFeed,
    simulateErpFailure: acct.simulateErpFailure ?? base.simulateErpFailure,
  };
}

/**
 * Demo-hook-secret check.
 * - If DEMO_HOOK_SECRET is unset (empty string), validation is disabled — return `true`.
 * - If set, the provided header value must match exactly.
 */
export function isHookSecretValid(providedHeader: string | null, cfg: ServerAppConfig = getServerConfig()): boolean {
  if (!cfg.demoHookSecret) return true;
  return providedHeader === cfg.demoHookSecret;
}
