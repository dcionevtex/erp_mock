import { randomUUID } from 'crypto';
import type { MktCallLogEntry, MktOrderRecord, MktConfig, MktScenario } from '@/types/marketplace';

declare global {
  var __mktCallLogs: Map<string, MktCallLogEntry[]> | undefined;
  var __mktOrders: Map<string, Map<string, MktOrderRecord>> | undefined;
  var __mktConfigs: Map<string, MktConfig> | undefined;
}

function getCallLogs(): Map<string, MktCallLogEntry[]> {
  if (!globalThis.__mktCallLogs) globalThis.__mktCallLogs = new Map();
  return globalThis.__mktCallLogs;
}

function getOrderMaps(): Map<string, Map<string, MktOrderRecord>> {
  if (!globalThis.__mktOrders) globalThis.__mktOrders = new Map();
  return globalThis.__mktOrders;
}

function getConfigs(): Map<string, MktConfig> {
  if (!globalThis.__mktConfigs) globalThis.__mktConfigs = new Map();
  return globalThis.__mktConfigs;
}

// Config
export function getMktConfig(account: string): MktConfig {
  return getConfigs().get(account) ?? { scenario: 'available' };
}

export function setMktScenario(account: string, scenario: MktScenario): void {
  getConfigs().set(account, { scenario });
}

// Orders
export function upsertOrder(record: MktOrderRecord): void {
  const maps = getOrderMaps();
  if (!maps.has(record.account)) maps.set(record.account, new Map());
  maps.get(record.account)!.set(record.orderId, record);
}

export function getOrder(account: string, orderId: string): MktOrderRecord | undefined {
  return getOrderMaps().get(account)?.get(orderId);
}

export function listOrders(account: string): MktOrderRecord[] {
  const map = getOrderMaps().get(account);
  if (!map) return [];
  return Array.from(map.values()).sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

// Call log
export function appendCallLog(account: string, entry: Omit<MktCallLogEntry, 'id'>): void {
  const logs = getCallLogs();
  const accountLog = logs.get(account) ?? [];
  accountLog.push({ ...entry, id: randomUUID() });
  if (accountLog.length > 500) accountLog.splice(0, accountLog.length - 500);
  logs.set(account, accountLog);
}

export function listCallLog(account: string): MktCallLogEntry[] {
  return [...(getCallLogs().get(account) ?? [])];
}

export function clearAll(account: string): void {
  getCallLogs().set(account, []);
  getOrderMaps().delete(account);
}
