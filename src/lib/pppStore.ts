// In-memory store for the Payment Provider Protocol simulator.
// Same globalThis singleton pattern as store.ts — resets on cold start, fine for demo.

import { randomUUID } from 'crypto';
import type { PppPaymentRecord, PppCallLogEntry, PppConfig, PppScenario } from '@/types/ppp';

// ── Singleton guards ──────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __pppPayments: Map<string, PppPaymentRecord> | undefined;
  // eslint-disable-next-line no-var
  var __pppCallLog: PppCallLogEntry[] | undefined;
  // eslint-disable-next-line no-var
  var __pppConfig: PppConfig | undefined;
}

function getPayments(): Map<string, PppPaymentRecord> {
  if (!globalThis.__pppPayments) globalThis.__pppPayments = new Map();
  return globalThis.__pppPayments;
}

function getCallLog(): PppCallLogEntry[] {
  if (!globalThis.__pppCallLog) globalThis.__pppCallLog = [];
  return globalThis.__pppCallLog;
}

function getConfig(): PppConfig {
  if (!globalThis.__pppConfig) globalThis.__pppConfig = { scenario: 'approved' };
  return globalThis.__pppConfig;
}

// ── Config ────────────────────────────────────────────────────────────────────

export function getPppConfig(): PppConfig {
  return { ...getConfig() };
}

export function setPppScenario(scenario: PppScenario): void {
  getConfig().scenario = scenario;
}

// ── Payment records ───────────────────────────────────────────────────────────

export function upsertPayment(record: PppPaymentRecord): void {
  getPayments().set(record.paymentId, record);
}

export function getPayment(paymentId: string): PppPaymentRecord | undefined {
  return getPayments().get(paymentId);
}

export function listPayments(): PppPaymentRecord[] {
  return Array.from(getPayments().values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function clearPayments(): void {
  getPayments().clear();
}

// ── Call log ──────────────────────────────────────────────────────────────────

export function appendCallLog(entry: Omit<PppCallLogEntry, 'id'>): PppCallLogEntry {
  const log = getCallLog();
  const full: PppCallLogEntry = { id: randomUUID(), ...entry };
  log.unshift(full);
  if (log.length > 500) log.splice(500);
  return full;
}

export function listCallLog(): PppCallLogEntry[] {
  return [...getCallLog()];
}

export function clearCallLog(): void {
  globalThis.__pppCallLog = [];
}
