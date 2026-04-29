// src/lib/__tests__/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  upsertOrder,
  getOrder,
  getOrderByOrderId,
  getAllOrders,
  setOrderStatus,
  appendTimelineEntry,
  incrementAttempts,
  deleteOrder,
  appendEventLog,
  getEventLog,
  hasProcessedKey,
  markProcessedKey,
  getConfigOverrides,
  setConfigOverrides,
  __resetStoreForTests,
  __getRawCounts,
} from '@/lib/store';
import type { ErpOrderRecord, EventLogEntry } from '@/types';

const baseRecord = (id: string, orderId: string, receivedAt: string): ErpOrderRecord => ({
  id,
  orderId,
  source: 'HOOK',
  erpStatus: 'RECEIVED',
  startHandlingStatus: 'NOT_STARTED',
  invoiceStatus: 'NOT_SENT',
  receivedAt,
  attempts: 0,
  timeline: [],
});

describe('store — order CRUD', () => {
  beforeEach(() => __resetStoreForTests());

  it('upsertOrder + getOrder roundtrip', async () => {
    const rec = baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z');
    await upsertOrder(rec);
    expect((await getOrder('a'))?.orderId).toBe('v1');
  });

  it('upsertOrder replaces existing record by id', async () => {
    await upsertOrder(baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'));
    await upsertOrder({ ...baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'), erpStatus: 'PROCESSING' });
    expect((await getOrder('a'))?.erpStatus).toBe('PROCESSING');
    expect(__getRawCounts().orders).toBe(1);
  });

  it('getOrderByOrderId finds by VTEX orderId', async () => {
    await upsertOrder(baseRecord('a', 'v-find', '2026-04-28T00:00:00.000Z'));
    expect((await getOrderByOrderId('v-find'))?.id).toBe('a');
    expect(await getOrderByOrderId('missing')).toBeUndefined();
  });

  it('getAllOrders returns newest-first by receivedAt (INBOX-03)', async () => {
    await upsertOrder(baseRecord('old', 'v-old', '2026-04-01T00:00:00.000Z'));
    await upsertOrder(baseRecord('new', 'v-new', '2026-04-28T00:00:00.000Z'));
    await upsertOrder(baseRecord('mid', 'v-mid', '2026-04-15T00:00:00.000Z'));
    const ids = (await getAllOrders()).map((r) => r.id);
    expect(ids).toEqual(['new', 'mid', 'old']);
  });

  it('setOrderStatus updates erpStatus and lastAttemptAt', async () => {
    await upsertOrder(baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'));
    const updated = await setOrderStatus('a', 'ERP_ACCEPTED', '2026-04-28T01:00:00.000Z');
    expect(updated?.erpStatus).toBe('ERP_ACCEPTED');
    expect(updated?.lastAttemptAt).toBe('2026-04-28T01:00:00.000Z');
  });

  it('setOrderStatus on missing id is a no-op', async () => {
    expect(await setOrderStatus('missing', 'ERROR')).toBeUndefined();
  });

  it('appendTimelineEntry appends to timeline', async () => {
    await upsertOrder(baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'));
    await appendTimelineEntry('a', { timestamp: 't1', step: 'EVENT_RECEIVED', status: 'SUCCESS' });
    await appendTimelineEntry('a', { timestamp: 't2', step: 'GET_ORDER_REQUESTED', status: 'INFO' });
    expect((await getOrder('a'))?.timeline).toHaveLength(2);
    expect((await getOrder('a'))?.timeline[1]?.step).toBe('GET_ORDER_REQUESTED');
  });

  it('incrementAttempts increments and updates lastAttemptAt', async () => {
    await upsertOrder(baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'));
    await incrementAttempts('a');
    await incrementAttempts('a');
    const rec = await getOrder('a');
    expect(rec?.attempts).toBe(2);
    expect(rec?.lastAttemptAt).toBeDefined();
  });

  it('deleteOrder removes the record and returns true', async () => {
    await upsertOrder(baseRecord('a', 'v1', '2026-04-28T00:00:00.000Z'));
    expect(await deleteOrder('a')).toBe(true);
    expect(await getOrder('a')).toBeUndefined();
    expect(await deleteOrder('a')).toBe(false);
  });
});

describe('store — event log', () => {
  beforeEach(() => __resetStoreForTests());

  it('appendEventLog + getEventLog returns newest-first', async () => {
    const e1: EventLogEntry = { timestamp: '2026-04-28T00:00:00.000Z', source: 'HOOK', level: 'INFO', message: 'first' };
    const e2: EventLogEntry = { timestamp: '2026-04-28T01:00:00.000Z', source: 'FEED', level: 'INFO', message: 'second' };
    await appendEventLog(e1);
    await appendEventLog(e2);
    const log = await getEventLog();
    expect(log).toHaveLength(2);
    expect(log[0]?.message).toBe('second');
    expect(log[1]?.message).toBe('first');
  });

  it('event log caps at 1000 entries', async () => {
    for (let i = 0; i < 1100; i++) {
      await appendEventLog({ timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(), source: 'SYSTEM', level: 'INFO', message: `m${i}` });
    }
    expect(__getRawCounts().eventLog).toBe(1000);
  });
});

describe('store — dedup keys', () => {
  beforeEach(() => __resetStoreForTests());

  it('hasProcessedKey returns false for unseen key', () => {
    expect(hasProcessedKey('k1')).toBe(false);
  });

  it('markProcessedKey + hasProcessedKey roundtrip', () => {
    markProcessedKey('k1');
    expect(hasProcessedKey('k1')).toBe(true);
  });

  it('processed-key set is bounded', () => {
    for (let i = 0; i < 5500; i++) markProcessedKey(`k${i}`);
    expect(__getRawCounts().processedKeys).toBeLessThanOrEqual(5000);
  });
});

describe('store — config overrides', () => {
  beforeEach(() => __resetStoreForTests());

  it('starts empty', () => {
    expect(getConfigOverrides()).toEqual({});
  });

  it('setConfigOverrides merges partial overrides', () => {
    setConfigOverrides({ account: 'demo' });
    setConfigOverrides({ simulateErpFailure: true });
    expect(getConfigOverrides()).toEqual({ account: 'demo', simulateErpFailure: true });
  });
});
