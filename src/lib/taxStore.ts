// Store for the Tax Service simulator.
// Account-scoped — each VTEX account gets its own tax rule catalog, scenario, and call log.
//
// Config (scenario, rule catalog, secret) is persisted to Neon (`tax_configs`) when
// DATABASE_URL is set, so it survives cold starts and is shared across serverless
// instances. Without a database it falls back to a globalThis Map (resets on cold start).
// The call log stays in memory — it's a short-lived debugging aid, not configuration.

import { randomUUID, createHash } from 'crypto';
import { getSql, ensureSchema } from '@/lib/db';
import type { TaxConfig, TaxRule, TaxScenario, TaxCallLogEntry } from '@/types/tax';

declare global {
  // eslint-disable-next-line no-var
  var __taxConfig: Map<string, TaxConfig> | undefined;
  // eslint-disable-next-line no-var
  var __taxCallLog: Map<string, TaxCallLogEntry[]> | undefined;
}

function configs(): Map<string, TaxConfig> {
  return (globalThis.__taxConfig ??= new Map());
}

function callLogs(): Map<string, TaxCallLogEntry[]> {
  return (globalThis.__taxCallLog ??= new Map());
}

// Deterministic default secret per account — survives Vercel cold starts without a
// database. "Regenerate" swaps in a random override, same trick as idpStore.ts.
function defaultSecret(account: string): string {
  return createHash('sha256').update(`vtex-tax-secret:${account}`).digest('hex').slice(0, 32);
}

function defaultRules(): TaxRule[] {
  const now = new Date().toISOString();
  return [
    { id: randomUUID(), name: 'ICMS', description: 'State VAT applied to the item price.', percentage: 18, active: true, createdAt: now },
    { id: randomUUID(), name: 'PIS/COFINS', description: 'Federal social contribution taxes.', percentage: 9.25, active: true, createdAt: now },
  ];
}

function defaultConfig(account: string): TaxConfig {
  return {
    scenario: 'apply',
    authorizationHeader: defaultSecret(account),
    isMarketplaceResponsibleForTaxes: true,
    rules: defaultRules(),
  };
}

// ── Config ────────────────────────────────────────────────────────────────────

async function loadFromDb(account: string): Promise<TaxConfig | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureSchema(sql);
  const rows = await sql`SELECT data FROM tax_configs WHERE account = ${account} LIMIT 1`;
  return rows.length ? (rows[0].data as TaxConfig) : null;
}

async function saveConfig(account: string, config: TaxConfig): Promise<TaxConfig> {
  const sql = getSql();
  if (!sql) {
    configs().set(account, config);
    return config;
  }
  await ensureSchema(sql);
  await sql`
    INSERT INTO tax_configs (account, data, updated_at)
    VALUES (${account}, ${JSON.stringify(config)}::jsonb, NOW())
    ON CONFLICT (account) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
  return config;
}

export async function getTaxConfig(account: string): Promise<TaxConfig> {
  const sql = getSql();
  if (!sql) {
    if (!configs().has(account)) configs().set(account, defaultConfig(account));
    return configs().get(account)!;
  }
  const existing = await loadFromDb(account);
  if (existing) return existing;
  // First access: persist the defaults so rule ids stay stable across requests.
  // DO NOTHING + re-read keeps this safe if two requests race on a new account.
  await ensureSchema(sql);
  await sql`
    INSERT INTO tax_configs (account, data)
    VALUES (${account}, ${JSON.stringify(defaultConfig(account))}::jsonb)
    ON CONFLICT (account) DO NOTHING
  `;
  return (await loadFromDb(account))!;
}

export async function setTaxScenario(account: string, scenario: TaxScenario): Promise<TaxConfig> {
  return saveConfig(account, { ...(await getTaxConfig(account)), scenario });
}

export async function setMarketplaceResponsible(account: string, isMarketplaceResponsibleForTaxes: boolean): Promise<TaxConfig> {
  return saveConfig(account, { ...(await getTaxConfig(account)), isMarketplaceResponsibleForTaxes });
}

export async function regenerateSecret(account: string): Promise<TaxConfig> {
  return saveConfig(account, { ...(await getTaxConfig(account)), authorizationHeader: randomUUID().replace(/-/g, '') });
}

// ── Tax rule catalog (percentage-based, applied to every item — mirrors the reference
// implementation's model) ─────────────────────────────────────────────────────

export async function addTaxRule(
  account: string,
  rule: { name: string; description?: string; percentage: number },
): Promise<TaxConfig> {
  const newRule: TaxRule = {
    id: randomUUID(),
    name: rule.name,
    description: rule.description ?? '',
    percentage: rule.percentage,
    active: true,
    createdAt: new Date().toISOString(),
  };
  const cfg = await getTaxConfig(account);
  return saveConfig(account, { ...cfg, rules: [...cfg.rules, newRule] });
}

export async function updateTaxRule(
  account: string,
  id: string,
  patch: Partial<Pick<TaxRule, 'name' | 'description' | 'percentage' | 'active'>>,
): Promise<TaxConfig> {
  const cfg = await getTaxConfig(account);
  return saveConfig(account, { ...cfg, rules: cfg.rules.map(r => (r.id === id ? { ...r, ...patch } : r)) });
}

export async function removeTaxRule(account: string, id: string): Promise<TaxConfig> {
  const cfg = await getTaxConfig(account);
  return saveConfig(account, { ...cfg, rules: cfg.rules.filter(r => r.id !== id) });
}

// ── Call log ──────────────────────────────────────────────────────────────────

export function appendTaxCallLog(account: string, entry: Omit<TaxCallLogEntry, 'id'>): TaxCallLogEntry {
  const logs = callLogs();
  const log = logs.get(account) ?? [];
  const full: TaxCallLogEntry = { id: randomUUID(), ...entry };
  log.unshift(full);
  if (log.length > 500) log.splice(500);
  logs.set(account, log);
  return full;
}

export function listTaxCallLog(account: string): TaxCallLogEntry[] {
  return [...(callLogs().get(account) ?? [])];
}

export function clearTaxCallLog(account: string): void {
  callLogs().set(account, []);
}
