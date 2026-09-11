// In-memory store for the Tax Service simulator.
// Account-scoped — each VTEX account gets its own tax rule catalog, scenario, and call log.
// Same globalThis singleton pattern as pppStore.ts / giftCardStore.ts — resets on cold start.

import { randomUUID, createHash } from 'crypto';
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

export function getTaxConfig(account: string): TaxConfig {
  if (!configs().has(account)) configs().set(account, defaultConfig(account));
  return configs().get(account)!;
}

export function setTaxScenario(account: string, scenario: TaxScenario): TaxConfig {
  const updated = { ...getTaxConfig(account), scenario };
  configs().set(account, updated);
  return updated;
}

export function setMarketplaceResponsible(account: string, isMarketplaceResponsibleForTaxes: boolean): TaxConfig {
  const updated = { ...getTaxConfig(account), isMarketplaceResponsibleForTaxes };
  configs().set(account, updated);
  return updated;
}

export function regenerateSecret(account: string): TaxConfig {
  const updated = { ...getTaxConfig(account), authorizationHeader: randomUUID().replace(/-/g, '') };
  configs().set(account, updated);
  return updated;
}

// ── Tax rule catalog (percentage-based, applied to every item — mirrors the reference
// implementation's model) ─────────────────────────────────────────────────────

export function addTaxRule(
  account: string,
  rule: { name: string; description?: string; percentage: number },
): TaxConfig {
  const newRule: TaxRule = {
    id: randomUUID(),
    name: rule.name,
    description: rule.description ?? '',
    percentage: rule.percentage,
    active: true,
    createdAt: new Date().toISOString(),
  };
  const cfg = getTaxConfig(account);
  const updated = { ...cfg, rules: [...cfg.rules, newRule] };
  configs().set(account, updated);
  return updated;
}

export function updateTaxRule(
  account: string,
  id: string,
  patch: Partial<Pick<TaxRule, 'name' | 'description' | 'percentage' | 'active'>>,
): TaxConfig {
  const cfg = getTaxConfig(account);
  const updated = { ...cfg, rules: cfg.rules.map(r => (r.id === id ? { ...r, ...patch } : r)) };
  configs().set(account, updated);
  return updated;
}

export function removeTaxRule(account: string, id: string): TaxConfig {
  const cfg = getTaxConfig(account);
  const updated = { ...cfg, rules: cfg.rules.filter(r => r.id !== id) };
  configs().set(account, updated);
  return updated;
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
