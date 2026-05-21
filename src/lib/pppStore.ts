// In-memory store for the Payment Provider Protocol simulator.
// Account-scoped — each VTEX account gets an isolated call log, payment records, and config.
// Same globalThis singleton pattern as marketplaceStore.ts — resets on cold start, fine for demo.

import { randomUUID } from 'crypto';
import type { PppPaymentRecord, PppCallLogEntry, PppConfig, PppScenario } from '@/types/ppp';

// ── Singleton guards ──────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __pppPayments: Map<string, Map<string, PppPaymentRecord>> | undefined;
  // eslint-disable-next-line no-var
  var __pppCallLog: Map<string, PppCallLogEntry[]> | undefined;
  // eslint-disable-next-line no-var
  var __pppConfig: Map<string, PppConfig> | undefined;
}

function getPaymentMaps(): Map<string, Map<string, PppPaymentRecord>> {
  if (!globalThis.__pppPayments) globalThis.__pppPayments = new Map();
  return globalThis.__pppPayments;
}

function getCallLogs(): Map<string, PppCallLogEntry[]> {
  if (!globalThis.__pppCallLog) globalThis.__pppCallLog = new Map();
  return globalThis.__pppCallLog;
}

function getConfigs(): Map<string, PppConfig> {
  if (!globalThis.__pppConfig) globalThis.__pppConfig = new Map();
  return globalThis.__pppConfig;
}

// ── Config ────────────────────────────────────────────────────────────────────

export function getPppConfig(account: string): PppConfig {
  return getConfigs().get(account) ?? { scenario: 'approved' };
}

export function setPppScenario(account: string, scenario: PppScenario): void {
  getConfigs().set(account, { scenario });
}

// ── Payment records ───────────────────────────────────────────────────────────

export function upsertPayment(account: string, record: PppPaymentRecord): void {
  const maps = getPaymentMaps();
  if (!maps.has(account)) maps.set(account, new Map());
  maps.get(account)!.set(record.paymentId, record);
}

export function getPayment(account: string, paymentId: string): PppPaymentRecord | undefined {
  return getPaymentMaps().get(account)?.get(paymentId);
}

export function listPayments(account: string): PppPaymentRecord[] {
  const map = getPaymentMaps().get(account);
  if (!map) return [];
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ── Call log ──────────────────────────────────────────────────────────────────

export function appendCallLog(account: string, entry: Omit<PppCallLogEntry, 'id'>): PppCallLogEntry {
  const logs = getCallLogs();
  const log = logs.get(account) ?? [];
  const full: PppCallLogEntry = { id: randomUUID(), ...entry };
  log.unshift(full);
  if (log.length > 500) log.splice(500);
  logs.set(account, log);
  return full;
}

export function listCallLog(account: string): PppCallLogEntry[] {
  return [...(getCallLogs().get(account) ?? [])];
}

// ── Clear ─────────────────────────────────────────────────────────────────────

export function clearAll(account: string): void {
  getCallLogs().set(account, []);
  getPaymentMaps().delete(account);
}
