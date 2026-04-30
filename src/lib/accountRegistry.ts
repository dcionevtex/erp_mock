import { encryptValue, decryptValue } from './crypto';
import { getSql, ensureSchema } from './db';
import type { IntegrationMode } from '@/types';

export interface AccountConfig {
  account: string;
  environment: string;
  appKey: string;
  appToken: string;
  integrationMode?: IntegrationMode;
  autoCommitFeed?: boolean;
  simulateErpFailure?: boolean;
}

// In-memory fallback when DATABASE_URL is not set
declare global {
  // eslint-disable-next-line no-var
  var __accountRegistry: Map<string, string> | undefined;
}
const registry: Map<string, string> =
  globalThis.__accountRegistry ?? (globalThis.__accountRegistry = new Map());

async function sql() {
  const s = getSql();
  if (s) await ensureSchema(s);
  return s;
}

export async function saveAccountConfig(config: AccountConfig): Promise<void> {
  if (!config.account || !config.appToken) return;
  const { appToken, ...rest } = config;
  const entry = JSON.stringify({ ...rest, _t: encryptValue(appToken) });
  const db = await sql();
  if (db) {
    await db`
      INSERT INTO account_configs (account, data, updated_at)
      VALUES (${config.account}, ${entry}, NOW())
      ON CONFLICT (account) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
  } else {
    registry.set(config.account, entry);
  }
}

export async function getAccountConfig(account: string): Promise<AccountConfig | null> {
  let raw: string | undefined;
  const db = await sql();
  if (db) {
    const rows = await db`SELECT data FROM account_configs WHERE account = ${account} LIMIT 1`;
    raw = rows[0]?.data as string | undefined;
  } else {
    raw = registry.get(account);
  }
  if (!raw) return null;
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const { _t, ...rest } = data;
    return { ...rest, appToken: decryptValue(_t as string) } as AccountConfig;
  } catch {
    return null;
  }
}

export async function listAccountNames(): Promise<string[]> {
  const db = await sql();
  if (db) {
    const rows = await db`SELECT account FROM account_configs ORDER BY updated_at DESC`;
    return rows.map((r) => (r as { account: string }).account);
  }
  return Array.from(registry.keys());
}
