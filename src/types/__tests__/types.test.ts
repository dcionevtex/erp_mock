// src/types/__tests__/types.test.ts
// Compile-time + runtime smoke test for the shared types.
// Catches accidental rename, removal, or import-path breakage.

import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  AppConfig,
  AppConfigPublic,
  ErpOrderCustomer,
  ErpOrderItem,
  ErpOrderPayload,
  ErpOrderRecord,
  ErpSimulationResult,
  ErpStatus,
  ErpTimelineEntry,
  EventLogEntry,
  IntegrationMode,
  IntegrationSource,
  PipelineStepName,
  StartHandlingStatus,
  TimelineStatus,
  VtexFeedItem,
  VtexHookPayload,
  VtexOrder,
  VtexStartHandlingResponse,
} from '@/types';

describe('shared types', () => {
  it('constructs a minimal ErpOrderRecord', () => {
    const record: ErpOrderRecord = {
      id: 'rec-1',
      orderId: 'v1234',
      source: 'HOOK',
      erpStatus: 'RECEIVED',
      startHandlingStatus: 'NOT_STARTED',
      invoiceStatus: 'NOT_SENT',
      receivedAt: '2026-04-28T00:00:00.000Z',
      attempts: 0,
      timeline: [],
    };
    expect(record.orderId).toBe('v1234');
    expect(record.timeline).toHaveLength(0);
  });

  it('constructs a minimal ErpOrderPayload', () => {
    const payload: ErpOrderPayload = {
      externalOrderId: 'v1234',
      orderId: 'v1234',
      items: [],
    };
    expect(payload.items).toEqual([]);
  });

  it('accepts every ErpStatus literal', () => {
    const statuses: ErpStatus[] = [
      'RECEIVED',
      'PROCESSING',
      'ERP_ACCEPTED',
      'START_HANDLING_SUCCESS',
      'START_HANDLING_ERROR',
      'ERROR',
      'DUPLICATE_IGNORED',
      'MANUALLY_RESOLVED',
    ];
    expect(statuses).toHaveLength(8);
  });

  it('accepts every StartHandlingStatus literal', () => {
    const statuses: StartHandlingStatus[] = ['NOT_STARTED', 'SUCCESS', 'ERROR'];
    expect(statuses).toHaveLength(3);
  });

  it('accepts every IntegrationSource literal', () => {
    const sources: IntegrationSource[] = ['FEED', 'HOOK'];
    expect(sources).toHaveLength(2);
  });

  it('accepts every TimelineStatus literal', () => {
    const statuses: TimelineStatus[] = ['SUCCESS', 'ERROR', 'INFO', 'SKIPPED'];
    expect(statuses).toHaveLength(4);
  });

  it('VtexFeedItem requires handle', () => {
    const item: VtexFeedItem = { handle: 'h-1' };
    expect(item.handle).toBe('h-1');
    // Type-level check: handle is a required string
    expectTypeOf<VtexFeedItem>().toHaveProperty('handle').toBeString();
  });

  it('VtexOrder.clientProfileData is optional and nullable', () => {
    const o1: VtexOrder = {};
    const o2: VtexOrder = { clientProfileData: null };
    const o3: VtexOrder = { clientProfileData: { email: 'x@y.z' } };
    expect(o1.clientProfileData).toBeUndefined();
    expect(o2.clientProfileData).toBeNull();
    expect(o3.clientProfileData?.email).toBe('x@y.z');
  });

  it('AppConfigPublic carries appTokenConfigured but not appToken', () => {
    const cfg: AppConfigPublic = {
      account: 'demo',
      environment: 'vtexcommercestable.com.br',
      appKey: 'k',
      integrationMode: 'HOOK',
      autoCommitFeed: false,
      simulateErpFailure: false,
      appTokenConfigured: true,
    };
    expect(cfg.appTokenConfigured).toBe(true);
    // @ts-expect-error appToken must NOT be a property of AppConfigPublic
    const _shouldNotCompile: string = cfg.appToken;
  });

  it('ErpSimulationResult is a discriminated union', () => {
    const ok: ErpSimulationResult = { status: 'SUCCESS', acceptedAt: 'now' };
    const fail: ErpSimulationResult = { status: 'FAILURE', reason: 'simulated', failedAt: 'now' };
    expect(ok.status).toBe('SUCCESS');
    expect(fail.status).toBe('FAILURE');
  });

  it('PipelineStepName covers expected steps', () => {
    const steps: PipelineStepName[] = [
      'EVENT_RECEIVED',
      'GET_ORDER_REQUESTED',
      'GET_ORDER_SUCCESS',
      'ERP_PAYLOAD_NORMALIZED',
      'ERP_SIMULATION_SUCCESS',
      'START_HANDLING_SUCCESS',
    ];
    expect(steps).toHaveLength(6);
  });
});
