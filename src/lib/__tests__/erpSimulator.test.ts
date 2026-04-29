import { describe, it, expect } from 'vitest';
import { normalizeOrder, simulateErpAcceptance } from '@/lib/erpSimulator';
import type { VtexOrder } from '@/types/vtex';
import type { ErpOrderPayload } from '@/types/erp';

/** Minimal valid VtexOrder for tests that only care about one field */
function makeOrder(overrides: Partial<VtexOrder> = {}): VtexOrder {
  return {
    orderId: 'v123-01',
    sequence: '501234',
    status: 'ready-for-handling',
    creationDate: '2026-04-28T10:00:00Z',
    items: [],
    clientProfileData: {
      firstName: 'Diego',
      lastName: 'Cione',
      email: 'diego.cione@vtex.com',
      document: '123.456.789-09',
      phone: '(11) 91234-5678',
    },
    shippingData: {
      logisticsInfo: [{ selectedSla: 'Normal' }],
      address: {
        street: 'Avenida Paulista',
        receiverName: 'Diego Cione',
        city: 'São Paulo',
      },
    },
    paymentData: {
      transactions: [
        {
          payments: [{ paymentSystemName: 'Visa', installments: 1, value: 10000 }],
        },
      ],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Required fields
// ---------------------------------------------------------------------------
describe('normalizeOrder — required fields', () => {
  it('sets externalOrderId and orderId from vtexOrder.orderId', () => {
    const result = normalizeOrder(makeOrder());
    expect(result.externalOrderId).toBe('v123-01');
    expect(result.orderId).toBe('v123-01');
  });

  it('sets orderId to empty string when vtexOrder.orderId is undefined', () => {
    const result = normalizeOrder(makeOrder({ orderId: undefined }));
    expect(result.orderId).toBe('');
    expect(result.externalOrderId).toBe('');
  });

  it('sets sequence, status, creationDate', () => {
    const result = normalizeOrder(makeOrder());
    expect(result.sequence).toBe('501234');
    expect(result.status).toBe('ready-for-handling');
    expect(result.creationDate).toBe('2026-04-28T10:00:00Z');
  });

  it('sets rawSource to VTEX', () => {
    const result = normalizeOrder(makeOrder());
    expect(result.rawSource).toBe('VTEX');
  });
});

// ---------------------------------------------------------------------------
// 2. Customer PII masking (SEC-01, SEC-02)
// ---------------------------------------------------------------------------
describe('normalizeOrder — customer PII masking (SEC-01, SEC-02)', () => {
  it('masks customer email in emailMasked', () => {
    const result = normalizeOrder(makeOrder());
    expect(result.customer?.emailMasked).toBe('d***@vtex.com');
  });

  it('masks customer document in documentMasked', () => {
    const result = normalizeOrder(makeOrder());
    expect(result.customer?.documentMasked).toBe('***-09');
  });

  it('sets customer.name from firstName + lastName', () => {
    const result = normalizeOrder(makeOrder());
    expect(result.customer?.name).toBe('Diego Cione');
  });

  it('sets customer.name to undefined when both firstName and lastName are absent', () => {
    const result = normalizeOrder(makeOrder({ clientProfileData: {} }));
    expect(result.customer?.name).toBeUndefined();
  });

  it('sets emailMasked to undefined when email is absent', () => {
    const result = normalizeOrder(makeOrder({ clientProfileData: { firstName: 'A' } }));
    expect(result.customer?.emailMasked).toBeUndefined();
  });

  it('returns customer object even when clientProfileData is null', () => {
    const result = normalizeOrder(makeOrder({ clientProfileData: null }));
    expect(result.customer).toBeDefined();
    expect(typeof result.customer).toBe('object');
    expect(result.customer?.name).toBeUndefined();
    expect(result.customer?.emailMasked).toBeUndefined();
    expect(result.customer?.documentMasked).toBeUndefined();
  });

  it('returns customer object when clientProfileData is absent', () => {
    expect(() => normalizeOrder(makeOrder({ clientProfileData: undefined }))).not.toThrow();
    const result = normalizeOrder(makeOrder({ clientProfileData: undefined }));
    expect(result.customer).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Items
// ---------------------------------------------------------------------------
describe('normalizeOrder — items', () => {
  it('maps items array with skuId, productId, name, quantity, price, sellingPrice', () => {
    const order = makeOrder({
      items: [
        {
          id: 'sku-1',
          productId: 'prod-1',
          name: 'Widget',
          quantity: 2,
          price: 6000,
          sellingPrice: 5000,
        },
      ],
    });
    const result = normalizeOrder(order);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.skuId).toBe('sku-1');
    expect(item.productId).toBe('prod-1');
    expect(item.name).toBe('Widget');
    expect(item.quantity).toBe(2);
    expect(item.price).toBe(6000);
    expect(item.sellingPrice).toBe(5000);
  });

  it('computes item.total as quantity * sellingPrice', () => {
    const order = makeOrder({
      items: [{ id: 'sku-2', quantity: 2, sellingPrice: 5000 }],
    });
    const result = normalizeOrder(order);
    expect(result.items[0].total).toBe(10000);
  });

  it('sets item.total to undefined when quantity is missing', () => {
    const order = makeOrder({
      items: [{ id: 'sku-3', sellingPrice: 5000 }],
    });
    const result = normalizeOrder(order);
    expect(result.items[0].total).toBeUndefined();
  });

  it('sets item.total to undefined when sellingPrice is missing', () => {
    const order = makeOrder({
      items: [{ id: 'sku-4', quantity: 2 }],
    });
    const result = normalizeOrder(order);
    expect(result.items[0].total).toBeUndefined();
  });

  it('maps empty items array to empty result array', () => {
    const result = normalizeOrder(makeOrder({ items: [] }));
    expect(result.items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Logistics and payment
// ---------------------------------------------------------------------------
describe('normalizeOrder — logistics and payment', () => {
  it('sets shippingSummary from logisticsInfo[0].selectedSla', () => {
    const result = normalizeOrder(makeOrder());
    expect(result.shippingSummary).toBe('Normal');
  });

  it('sets paymentSummary from first payment paymentSystemName', () => {
    const result = normalizeOrder(makeOrder());
    expect(result.paymentSummary).toBe('Visa');
  });

  it('sets shippingSummary to undefined when shippingData is null', () => {
    const result = normalizeOrder(makeOrder({ shippingData: null }));
    expect(result.shippingSummary).toBeUndefined();
  });

  it('sets paymentSummary to undefined when paymentData is null', () => {
    const result = normalizeOrder(makeOrder({ paymentData: null }));
    expect(result.paymentSummary).toBeUndefined();
  });

  it('sets marketplace to MARKETPLACE when marketplaceOrderId is present', () => {
    const result = normalizeOrder(makeOrder({ marketplaceOrderId: 'ext-456' }));
    expect(result.marketplace).toBe('MARKETPLACE');
  });

  it('sets marketplace to undefined when marketplaceOrderId is absent', () => {
    const result = normalizeOrder(makeOrder({ marketplaceOrderId: undefined }));
    expect(result.marketplace).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. simulateErpAcceptance (TEST-04)
// ---------------------------------------------------------------------------
describe('simulateErpAcceptance — TEST-04', () => {
  const payload = normalizeOrder(makeOrder());

  it('returns SUCCESS when simulateErpFailure is false', () => {
    const result = simulateErpAcceptance(payload, { simulateErpFailure: false });
    expect(result.status).toBe('SUCCESS');
    expect('acceptedAt' in result).toBe(true);
  });

  it('returns FAILURE when simulateErpFailure is true', () => {
    const result = simulateErpAcceptance(payload, { simulateErpFailure: true });
    expect(result.status).toBe('FAILURE');
    expect('reason' in result).toBe(true);
    expect('failedAt' in result).toBe(true);
  });

  it('SUCCESS result acceptedAt is a valid ISO 8601 date string', () => {
    const result = simulateErpAcceptance(payload, { simulateErpFailure: false });
    if (result.status !== 'SUCCESS') throw new Error('Expected SUCCESS');
    expect(new Date(result.acceptedAt).toString()).not.toBe('Invalid Date');
  });

  it('FAILURE result failedAt is a valid ISO 8601 date string', () => {
    const result = simulateErpAcceptance(payload, { simulateErpFailure: true });
    if (result.status !== 'FAILURE') throw new Error('Expected FAILURE');
    expect(new Date(result.failedAt).toString()).not.toBe('Invalid Date');
  });

  it('does not throw regardless of config value', () => {
    expect(() => simulateErpAcceptance(payload, { simulateErpFailure: false })).not.toThrow();
    expect(() => simulateErpAcceptance(payload, { simulateErpFailure: true })).not.toThrow();
  });

  it('the _payload parameter is not read — same result for any payload', () => {
    const emptyResult = simulateErpAcceptance({} as ErpOrderPayload, { simulateErpFailure: false });
    const fullResult = simulateErpAcceptance(payload, { simulateErpFailure: false });
    expect(emptyResult.status).toBe(fullResult.status);
  });
});
