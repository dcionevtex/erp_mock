// src/lib/__tests__/orderProcessor.test.ts
// TEST-06: Vitest suite for orderProcessor — all guard scenarios + happy path.
// Uses injected mock VtexClient objects — never vi.stubGlobal.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processOrder } from '@/lib/orderProcessor';
import { upsertOrder, getOrderByOrderId, __resetStoreForTests } from '@/lib/store';
import { VtexApiError } from '@/lib/vtexClient';
import type { VtexClient } from '@/lib/vtexClient';
import type { ErpOrderRecord } from '@/types/erp';
import type { VtexOrder } from '@/types/vtex';

/** Minimal ErpOrderRecord for test seeding */
function makeRecord(overrides: Partial<ErpOrderRecord> = {}): ErpOrderRecord {
  return {
    id: 'rec-001',
    orderId: 'vtex-001',
    source: 'HOOK',
    erpStatus: 'RECEIVED',
    startHandlingStatus: 'NOT_STARTED',
    receivedAt: new Date().toISOString(),
    attempts: 0,
    timeline: [],
    ...overrides,
  };
}

/** Minimal VtexOrder returned by mock getOrder */
const MOCK_VTEX_ORDER: VtexOrder = {
  orderId: 'vtex-001',
  status: 'ready-for-handling',
  items: [],
  clientProfileData: {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    document: '12345678909',
  },
  shippingData: null,
  paymentData: null,
};

/** Create a mock VtexClient with all methods as vi.fn() — override as needed */
function makeMockVtexClient(overrides: Partial<VtexClient> = {}): VtexClient {
  return {
    getOrder: vi.fn().mockResolvedValue(MOCK_VTEX_ORDER),
    getFeedItems: vi.fn().mockResolvedValue([]),
    commitFeedItems: vi.fn().mockResolvedValue(undefined),
    startHandling: vi.fn().mockResolvedValue(undefined),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  __resetStoreForTests();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. PIPE-07: Guard against double Start Handling
// ---------------------------------------------------------------------------
describe('processOrder — PIPE-07: guard against double Start Handling', () => {
  it('does NOT call getOrder when startHandlingStatus is already SUCCESS', async () => {
    const record = makeRecord({ startHandlingStatus: 'SUCCESS' });
    await upsertOrder(record);
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(mockClient.getOrder).not.toHaveBeenCalled();
  });

  it('does NOT call startHandling when startHandlingStatus is already SUCCESS', async () => {
    const record = makeRecord({ startHandlingStatus: 'SUCCESS' });
    await upsertOrder(record);
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(mockClient.startHandling).not.toHaveBeenCalled();
  });

  it('writes a SKIPPED timeline entry when startHandlingStatus is already SUCCESS', async () => {
    const record = makeRecord({ startHandlingStatus: 'SUCCESS' });
    await upsertOrder(record);
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    const stored = await getOrderByOrderId('vtex-001');
    expect(
      stored?.timeline.some(
        (e) => e.step === 'START_HANDLING_REQUESTED' && e.status === 'SKIPPED',
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. PIPE-06: Guard when Get Order fails
// ---------------------------------------------------------------------------
describe('processOrder — PIPE-06: guard when Get Order fails', () => {
  it('does NOT call startHandling when getOrder throws VtexApiError 404', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient({
      getOrder: vi.fn().mockRejectedValue(
        new VtexApiError({ status: 404, url: '/orders/vtex-001' }),
      ),
    });
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(mockClient.startHandling).not.toHaveBeenCalled();
  });

  it('does NOT call startHandling when getOrder throws VtexApiError 401', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient({
      getOrder: vi.fn().mockRejectedValue(
        new VtexApiError({ status: 401, url: '/orders/vtex-001' }),
      ),
    });
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(mockClient.startHandling).not.toHaveBeenCalled();
  });

  it('does NOT call startHandling when getOrder throws a generic Error', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient({
      getOrder: vi.fn().mockRejectedValue(new Error('Network timeout')),
    });
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(mockClient.startHandling).not.toHaveBeenCalled();
  });

  it('sets erpStatus to ERROR on the record when getOrder throws', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient({
      getOrder: vi.fn().mockRejectedValue(
        new VtexApiError({ status: 404, url: '/orders/vtex-001' }),
      ),
    });
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect((await getOrderByOrderId('vtex-001'))?.erpStatus).toBe('ERROR');
  });

  it('writes GET_ORDER_ERROR timeline entry when getOrder throws', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient({
      getOrder: vi.fn().mockRejectedValue(
        new VtexApiError({ status: 404, url: '/orders/vtex-001' }),
      ),
    });
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    const stored = await getOrderByOrderId('vtex-001');
    expect(
      stored?.timeline.some((e) => e.step === 'GET_ORDER_ERROR' && e.status === 'ERROR'),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. PIPE-05: Guard when ERP simulation fails
// ---------------------------------------------------------------------------
describe('processOrder — PIPE-05: guard when ERP simulation fails', () => {
  it('does NOT call startHandling when simulateErpFailure config is true', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: true },
    });
    expect(mockClient.startHandling).not.toHaveBeenCalled();
  });

  it('sets erpStatus to ERROR on the record when ERP simulation fails', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: true },
    });
    expect((await getOrderByOrderId('vtex-001'))?.erpStatus).toBe('ERROR');
  });

  it('writes ERP_SIMULATION_ERROR timeline entry when ERP simulation fails', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: true },
    });
    const stored = await getOrderByOrderId('vtex-001');
    expect(
      stored?.timeline.some(
        (e) => e.step === 'ERP_SIMULATION_ERROR' && e.status === 'ERROR',
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. PIPE-04 + PIPE-08: Happy path
// ---------------------------------------------------------------------------
describe('processOrder — PIPE-04 + PIPE-08: happy path', () => {
  it('calls startHandling after successful ERP simulation', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(mockClient.startHandling).toHaveBeenCalledOnce();
    expect(mockClient.startHandling).toHaveBeenCalledWith('vtex-001');
  });

  it('sets erpStatus to START_HANDLING_SUCCESS on the record after successful full pipeline', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect((await getOrderByOrderId('vtex-001'))?.erpStatus).toBe('START_HANDLING_SUCCESS');
  });

  it('sets startHandlingStatus to SUCCESS on the record', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect((await getOrderByOrderId('vtex-001'))?.startHandlingStatus).toBe('SUCCESS');
  });

  it('records GET_ORDER_REQUESTED timeline entry', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(
      (await getOrderByOrderId('vtex-001'))?.timeline.some((e) => e.step === 'GET_ORDER_REQUESTED'),
    ).toBe(true);
  });

  it('records GET_ORDER_SUCCESS timeline entry', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(
      (await getOrderByOrderId('vtex-001'))?.timeline.some((e) => e.step === 'GET_ORDER_SUCCESS'),
    ).toBe(true);
  });

  it('records ERP_PAYLOAD_NORMALIZED timeline entry', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(
      (await getOrderByOrderId('vtex-001'))?.timeline.some((e) => e.step === 'ERP_PAYLOAD_NORMALIZED'),
    ).toBe(true);
  });

  it('records ERP_SIMULATION_STARTED timeline entry', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(
      (await getOrderByOrderId('vtex-001'))?.timeline.some((e) => e.step === 'ERP_SIMULATION_STARTED'),
    ).toBe(true);
  });

  it('records ERP_SIMULATION_SUCCESS timeline entry', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(
      (await getOrderByOrderId('vtex-001'))?.timeline.some((e) => e.step === 'ERP_SIMULATION_SUCCESS'),
    ).toBe(true);
  });

  it('records START_HANDLING_REQUESTED timeline entry', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(
      (await getOrderByOrderId('vtex-001'))?.timeline.some((e) => e.step === 'START_HANDLING_REQUESTED'),
    ).toBe(true);
  });

  it('records START_HANDLING_SUCCESS timeline entry', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect(
      (await getOrderByOrderId('vtex-001'))?.timeline.some((e) => e.step === 'START_HANDLING_SUCCESS'),
    ).toBe(true);
  });

  it('stores masked vtexOrderRaw — email is masked in the stored raw payload (SEC-03)', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient();
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    const stored = await getOrderByOrderId('vtex-001');
    const rawAsString = JSON.stringify(stored?.vtexOrderRaw ?? {});
    expect(rawAsString).not.toContain('test@example.com');
  });
});

// ---------------------------------------------------------------------------
// 5. Start Handling error handling
// ---------------------------------------------------------------------------
describe('processOrder — Start Handling error handling', () => {
  it('sets startHandlingStatus to ERROR when startHandling throws', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient({
      startHandling: vi.fn().mockRejectedValue(
        new VtexApiError({ status: 500, url: '/orders/vtex-001/start-handling' }),
      ),
    });
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect((await getOrderByOrderId('vtex-001'))?.startHandlingStatus).toBe('ERROR');
  });

  it('sets erpStatus to START_HANDLING_ERROR when startHandling throws', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient({
      startHandling: vi.fn().mockRejectedValue(
        new VtexApiError({ status: 500, url: '/orders/vtex-001/start-handling' }),
      ),
    });
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    expect((await getOrderByOrderId('vtex-001'))?.erpStatus).toBe('START_HANDLING_ERROR');
  });

  it('writes START_HANDLING_ERROR timeline entry when startHandling throws', async () => {
    await upsertOrder(makeRecord());
    const mockClient = makeMockVtexClient({
      startHandling: vi.fn().mockRejectedValue(
        new VtexApiError({ status: 500, url: '/orders/vtex-001/start-handling' }),
      ),
    });
    await processOrder('vtex-001', 'HOOK', {
      vtexClient: mockClient,
      config: { simulateErpFailure: false },
    });
    const stored = await getOrderByOrderId('vtex-001');
    expect(
      stored?.timeline.some(
        (e) => e.step === 'START_HANDLING_ERROR' && e.status === 'ERROR',
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. No-op when record not found
// ---------------------------------------------------------------------------
describe('processOrder — no-op when record not found', () => {
  it('does nothing when orderId does not exist in the store', async () => {
    const mockClient = makeMockVtexClient();
    await expect(
      processOrder('nonexistent-order', 'HOOK', {
        vtexClient: mockClient,
        config: { simulateErpFailure: false },
      }),
    ).resolves.toBeUndefined();
    expect(mockClient.getOrder).not.toHaveBeenCalled();
    expect(mockClient.startHandling).not.toHaveBeenCalled();
  });
});
