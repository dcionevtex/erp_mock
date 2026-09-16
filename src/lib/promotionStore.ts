// In-memory store for the External Promotions Protocol simulator.
// Account-scoped — each VTEX account gets its own rule catalog, auth config, and call log.
// Same globalThis singleton pattern as taxStore.ts / giftCardStore.ts — resets on cold start.

import { randomUUID, createHash } from 'crypto';
import type { PromotionConfig, PromotionRule, PromotionScenario, PromotionCallLogEntry } from '@/types/promotion';

declare global {
  // eslint-disable-next-line no-var
  var __promotionConfig: Map<string, PromotionConfig> | undefined;
  // eslint-disable-next-line no-var
  var __promotionCallLog: Map<string, PromotionCallLogEntry[]> | undefined;
}

function configs(): Map<string, PromotionConfig> {
  return (globalThis.__promotionConfig ??= new Map());
}

function callLogs(): Map<string, PromotionCallLogEntry[]> {
  return (globalThis.__promotionCallLog ??= new Map());
}

// Deterministic default secret per account — survives Vercel cold starts without a
// database. "Regenerate" swaps in a random override, same trick as taxStore.ts/idpStore.ts.
function defaultSecret(account: string): string {
  return createHash('sha256').update(`vtex-promotion-secret:${account}`).digest('hex').slice(0, 32);
}

function defaultRules(): PromotionRule[] {
  const now = new Date().toISOString();
  return [
    { id: randomUUID(), name: 'Site-wide 10% off', description: 'Flat percentage discount on every item.', type: 'PERCENTAGE', value: 10, couponCode: null, active: true, createdAt: now },
    { id: randomUUID(), name: 'WELCOME10 — $10 off', description: 'Flat amount off per unit, requires coupon code WELCOME10.', type: 'FIXED', value: 10, couponCode: 'WELCOME10', active: true, createdAt: now },
  ];
}

function defaultConfig(account: string): PromotionConfig {
  return {
    scenario: 'apply',
    authHeaderName: 'Authorization',
    authHeaderValue: `Bearer ${defaultSecret(account)}`,
    rules: defaultRules(),
  };
}

// ── Config ────────────────────────────────────────────────────────────────────

export function getPromotionConfig(account: string): PromotionConfig {
  if (!configs().has(account)) configs().set(account, defaultConfig(account));
  return configs().get(account)!;
}

export function setPromotionScenario(account: string, scenario: PromotionScenario): PromotionConfig {
  const updated = { ...getPromotionConfig(account), scenario };
  configs().set(account, updated);
  return updated;
}

export function setAuthHeaderName(account: string, authHeaderName: string): PromotionConfig {
  const updated = { ...getPromotionConfig(account), authHeaderName: authHeaderName || 'Authorization' };
  configs().set(account, updated);
  return updated;
}

export function setAuthHeaderValue(account: string, authHeaderValue: string): PromotionConfig {
  const updated = { ...getPromotionConfig(account), authHeaderValue };
  configs().set(account, updated);
  return updated;
}

export function regenerateSecret(account: string): PromotionConfig {
  const updated = { ...getPromotionConfig(account), authHeaderValue: `Bearer ${randomUUID().replace(/-/g, '')}` };
  configs().set(account, updated);
  return updated;
}

// ── Promotion rule catalog ────────────────────────────────────────────────────

export function addPromotionRule(
  account: string,
  rule: { name: string; description?: string; type: PromotionRule['type']; value: number; couponCode?: string | null },
): PromotionConfig {
  const newRule: PromotionRule = {
    id: randomUUID(),
    name: rule.name,
    description: rule.description ?? '',
    type: rule.type,
    value: rule.value,
    couponCode: rule.couponCode?.trim() ? rule.couponCode.trim().toUpperCase() : null,
    active: true,
    createdAt: new Date().toISOString(),
  };
  const cfg = getPromotionConfig(account);
  const updated = { ...cfg, rules: [...cfg.rules, newRule] };
  configs().set(account, updated);
  return updated;
}

export function updatePromotionRule(
  account: string,
  id: string,
  patch: Partial<Pick<PromotionRule, 'name' | 'description' | 'type' | 'value' | 'couponCode' | 'active'>>,
): PromotionConfig {
  const cfg = getPromotionConfig(account);
  const updated = { ...cfg, rules: cfg.rules.map(r => (r.id === id ? { ...r, ...patch } : r)) };
  configs().set(account, updated);
  return updated;
}

export function removePromotionRule(account: string, id: string): PromotionConfig {
  const cfg = getPromotionConfig(account);
  const updated = { ...cfg, rules: cfg.rules.filter(r => r.id !== id) };
  configs().set(account, updated);
  return updated;
}

// ── Call log ──────────────────────────────────────────────────────────────────

export function appendPromotionCallLog(account: string, entry: Omit<PromotionCallLogEntry, 'id'>): PromotionCallLogEntry {
  const logs = callLogs();
  const log = logs.get(account) ?? [];
  const full: PromotionCallLogEntry = { id: randomUUID(), ...entry };
  log.unshift(full);
  if (log.length > 500) log.splice(500);
  logs.set(account, log);
  return full;
}

export function listPromotionCallLog(account: string): PromotionCallLogEntry[] {
  return [...(callLogs().get(account) ?? [])];
}

export function clearPromotionCallLog(account: string): void {
  callLogs().set(account, []);
}
