// In-memory store for the Gift Card Provider Protocol simulator.
// Account-scoped — each VTEX account gets isolated cards, transactions, call log, and config.
// Same globalThis singleton pattern as pppStore.ts — resets on cold start, fine for demo.

import { randomUUID } from 'crypto';
import type {
  GiftCardRecord,
  GcTransactionRecord,
  GcCallLogEntry,
  GcConfig,
  GcScenario,
  GcOperation,
} from '@/types/giftCard';

// ── Singleton guards ──────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __gcCards: Map<string, Map<string, GiftCardRecord>> | undefined;
  // eslint-disable-next-line no-var
  var __gcTransactions: Map<string, Map<string, GcTransactionRecord>> | undefined;
  // eslint-disable-next-line no-var
  var __gcCallLog: Map<string, GcCallLogEntry[]> | undefined;
  // eslint-disable-next-line no-var
  var __gcConfig: Map<string, GcConfig> | undefined;
}

function getCardMaps(): Map<string, Map<string, GiftCardRecord>> {
  if (!globalThis.__gcCards) globalThis.__gcCards = new Map();
  return globalThis.__gcCards;
}

function getTransactionMaps(): Map<string, Map<string, GcTransactionRecord>> {
  if (!globalThis.__gcTransactions) globalThis.__gcTransactions = new Map();
  return globalThis.__gcTransactions;
}

function getCallLogs(): Map<string, GcCallLogEntry[]> {
  if (!globalThis.__gcCallLog) globalThis.__gcCallLog = new Map();
  return globalThis.__gcCallLog;
}

function getConfigs(): Map<string, GcConfig> {
  if (!globalThis.__gcConfig) globalThis.__gcConfig = new Map();
  return globalThis.__gcConfig;
}

// ── Config ────────────────────────────────────────────────────────────────────

export const DEFAULT_MOCK_BALANCE = 9999;

export function getGcConfig(account: string): GcConfig {
  return getConfigs().get(account) ?? { scenario: 'approved', mockBalance: DEFAULT_MOCK_BALANCE };
}

export function setGcConfig(account: string, scenario: GcScenario, mockBalance: number): void {
  getConfigs().set(account, { scenario, mockBalance });
}

// ── Gift cards ────────────────────────────────────────────────────────────────

export function upsertCard(account: string, record: GiftCardRecord): void {
  const maps = getCardMaps();
  if (!maps.has(account)) maps.set(account, new Map());
  maps.get(account)!.set(record.id, record);
}

export function getCard(account: string, cardId: string): GiftCardRecord | undefined {
  return getCardMaps().get(account)?.get(cardId);
}

export function listCards(account: string): GiftCardRecord[] {
  const map = getCardMaps().get(account);
  if (!map) return [];
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ── Transactions ──────────────────────────────────────────────────────────────

export function upsertTransaction(account: string, record: GcTransactionRecord): void {
  const maps = getTransactionMaps();
  if (!maps.has(account)) maps.set(account, new Map());
  maps.get(account)!.set(record.id, record);
}

export function getTransaction(
  account: string,
  transactionId: string
): GcTransactionRecord | undefined {
  return getTransactionMaps().get(account)?.get(transactionId);
}

export function listTransactionsForCard(
  account: string,
  cardId: string
): GcTransactionRecord[] {
  const map = getTransactionMaps().get(account);
  if (!map) return [];
  return Array.from(map.values()).filter(t => t.giftCardId === cardId);
}

export function appendSettlement(
  account: string,
  transactionId: string,
  op: GcOperation
): GcTransactionRecord | undefined {
  const tx = getTransaction(account, transactionId);
  if (!tx) return undefined;
  const updated = { ...tx, settlements: [...tx.settlements, op] };
  upsertTransaction(account, updated);
  return updated;
}

export function appendCancellation(
  account: string,
  transactionId: string,
  op: GcOperation
): GcTransactionRecord | undefined {
  const tx = getTransaction(account, transactionId);
  if (!tx) return undefined;
  const updated = { ...tx, cancellations: [...tx.cancellations, op] };
  upsertTransaction(account, updated);
  return updated;
}

// ── Call log ──────────────────────────────────────────────────────────────────

export function appendCallLog(
  account: string,
  entry: Omit<GcCallLogEntry, 'id'>
): GcCallLogEntry {
  const logs = getCallLogs();
  const log = logs.get(account) ?? [];
  const full: GcCallLogEntry = { id: randomUUID(), ...entry };
  log.unshift(full);
  if (log.length > 500) log.splice(500);
  logs.set(account, log);
  return full;
}

export function listCallLog(account: string): GcCallLogEntry[] {
  return [...(getCallLogs().get(account) ?? [])];
}

// ── Clear ─────────────────────────────────────────────────────────────────────

export function clearAll(account: string): void {
  getCallLogs().set(account, []);
  getCardMaps().delete(account);
  getTransactionMaps().delete(account);
}
