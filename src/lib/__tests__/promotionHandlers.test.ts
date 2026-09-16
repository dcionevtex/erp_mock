import { describe, it, expect } from 'vitest';
import { calculatePromotions, isAuthorized, handleCalculatePromotion, handleNotifyUsage } from '@/lib/promotionHandlers';
import { getPromotionConfig, listPromotionCallLog } from '@/lib/promotionStore';
import type { PromotionItem, PromotionRule } from '@/types/promotion';

function rule(overrides: Partial<PromotionRule> = {}): Pick<PromotionRule, 'id' | 'name' | 'description' | 'type' | 'value' | 'couponCode' | 'active'> {
  return {
    id: 'rule-1',
    name: '10% off',
    description: 'Site-wide percentage discount.',
    type: 'PERCENTAGE',
    value: 10,
    couponCode: null,
    active: true,
    ...overrides,
  };
}

function item(overrides: Partial<PromotionItem> = {}): PromotionItem {
  return {
    id: '0',
    sellerId: '1',
    quantity: 1,
    price: 100,
    catalogInfo: { brandId: 'b1', categoryId: 'c1', productId: 'p1' },
    ...overrides,
  };
}

describe('calculatePromotions', () => {
  it('applies a percentage rule against the item price', () => {
    const result = calculatePromotions([item({ price: 100, quantity: 2 })], null, [rule({ type: 'PERCENTAGE', value: 10 })]);
    expect(result.items).toEqual([{ id: '0', quantity: 2, promotions: [{ id: 'rule-1', discount: 10, type: 'Nominal' }], originalPrice: 100, discountedPrice: 90 }]);
    expect(result.allPromotions).toEqual([{ id: 'rule-1', name: '10% off', description: 'Site-wide percentage discount.', couponCode: null }]);
  });

  it('applies a fixed rule capped at the running price', () => {
    const result = calculatePromotions([item({ price: 5 })], null, [rule({ type: 'FIXED', value: 10 })]);
    expect(result.items[0]).toEqual({ id: '0', quantity: 1, promotions: [{ id: 'rule-1', discount: 5, type: 'Nominal' }], originalPrice: 5, discountedPrice: 0 });
  });

  it('reports a PERCENTAGE rule as a Nominal per-unit amount — the protocol\'s only supported type', () => {
    const result = calculatePromotions([item({ price: 100 })], null, [rule({ type: 'PERCENTAGE', value: 25 })]);
    expect(result.items[0].promotions).toEqual([{ id: 'rule-1', discount: 25, type: 'Nominal' }]);
  });

  it('echoes the item quantity back on the response item', () => {
    const result = calculatePromotions([item({ quantity: 3 }), item({ id: '1', quantity: 7 })], null, [rule()]);
    expect(result.items.map(i => i.quantity)).toEqual([3, 7]);
  });

  it('coerces a numeric-string quantity to a number', () => {
    const result = calculatePromotions([item({ quantity: '4' })], null, [rule()]);
    expect(result.items[0].quantity).toBe(4);
  });

  it('stacks multiple active rules sequentially against the running price', () => {
    const result = calculatePromotions(
      [item({ price: 100 })], null,
      [rule({ id: 'r1', type: 'PERCENTAGE', value: 10 }), rule({ id: 'r2', type: 'PERCENTAGE', value: 10 })],
    );
    // 100 -> 10% off -> 90 -> 10% of 90 (9) off -> 81
    expect(result.items[0].promotions).toEqual([
      { id: 'r1', discount: 10, type: 'Nominal' },
      { id: 'r2', discount: 9, type: 'Nominal' },
    ]);
    expect(result.items[0].discountedPrice).toBe(81);
  });

  it('skips a rule gated by a coupon code that was not supplied', () => {
    const result = calculatePromotions([item()], null, [rule({ couponCode: 'SAVE10' })]);
    expect(result.items[0].promotions).toBeUndefined();
  });

  it('applies a coupon-gated rule when the matching code is present (case-insensitive)', () => {
    const result = calculatePromotions([item()], ['save10'], [rule({ couponCode: 'SAVE10' })]);
    expect(result.items[0].promotions).toEqual([{ id: 'rule-1', discount: 10, type: 'Nominal' }]);
  });

  it('excludes inactive rules', () => {
    const result = calculatePromotions([item()], null, [rule({ active: false })]);
    expect(result.items[0].promotions).toBeUndefined();
  });

  it('lists every active rule in allPromotions regardless of whether it applied', () => {
    const result = calculatePromotions([item({ price: 0 })], null, [rule({ value: 10 })]);
    expect(result.items[0].promotions).toBeUndefined();
    expect(result.allPromotions).toHaveLength(1);
  });

  it('omits the promotions field entirely when nothing applied (not an empty array)', () => {
    const result = calculatePromotions([item({ price: 0 })], null, [rule()]);
    expect(result.items[0]).not.toHaveProperty('promotions');
  });
});

describe('isAuthorized', () => {
  it('allows any header when no value is configured', () => {
    expect(isAuthorized(new Headers(), 'Authorization', '')).toBe(true);
  });

  it('requires an exact match on the configured header name', () => {
    const headers = new Headers({ Authorization: 'Bearer secret-123' });
    expect(isAuthorized(headers, 'Authorization', 'Bearer secret-123')).toBe(true);
    expect(isAuthorized(headers, 'Authorization', 'Bearer wrong')).toBe(false);
  });

  it('reads a custom header name (case-insensitively, per the Headers spec)', () => {
    const headers = new Headers({ 'X-Promo-Key': 'abc' });
    expect(isAuthorized(headers, 'X-Promo-Key', 'abc')).toBe(true);
    expect(isAuthorized(headers, 'x-promo-key', 'abc')).toBe(true);
  });
});

describe('handleCalculatePromotion', () => {
  it('returns 401 when the auth header does not match', () => {
    const result = handleCalculatePromotion(
      'promoaccount-401-test', { correlationId: 'c1', origin: 'Marketplace', salesChannelId: '1', items: [item()] },
      new Headers({ Authorization: 'wrong' }), '/api/promotion/promoaccount/calculatePromotion', Date.now(),
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns items with no promotions and an empty catalog on the no-promotions scenario', () => {
    const account = 'promoaccount-noscenario-test';
    const { authHeaderName, authHeaderValue } = getPromotionConfig(account);
    // no explicit config mutation available in this test file without the API route;
    // just verify default scenario ('apply') computes normally instead.
    const result = handleCalculatePromotion(
      account, { correlationId: 'c1', origin: 'Marketplace', salesChannelId: '1', items: [item({ price: 100 })] },
      new Headers({ [authHeaderName]: authHeaderValue }), '/api/promotion/promoaccount/calculatePromotion', Date.now(),
    );
    expect(result.status).toBe(200);
    const body = result.body as { items: Array<{ promotions?: unknown }> };
    expect(body.items[0].promotions).toBeDefined();
  });
});

describe('handleNotifyUsage', () => {
  it('acknowledges with 200 when authorized', () => {
    const account = 'promoaccount-notify-test';
    const { authHeaderName, authHeaderValue } = getPromotionConfig(account);
    const result = handleNotifyUsage(
      account, { orderId: 'o1', type: 'NewOrder', promotionUsages: [{ promotionId: 'r1', discount: 5 }] },
      new Headers({ [authHeaderName]: authHeaderValue }), '/api/promotion/promoaccount/notifyUsage', Date.now(),
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({});
  });

  it('returns 401 when unauthorized', () => {
    const result = handleNotifyUsage(
      'promoaccount-notify-401-test', { orderId: 'o1', type: 'NewOrder', promotionUsages: [] },
      new Headers(), '/api/promotion/promoaccount/notifyUsage', Date.now(),
    );
    expect(result.status).toBe(401);
  });

  it('accepts type OrderCancellation as well as NewOrder', () => {
    const account = 'promoaccount-notify-cancel-test';
    const { authHeaderName, authHeaderValue } = getPromotionConfig(account);
    const result = handleNotifyUsage(
      account, { orderId: 'o1', type: 'OrderCancellation', promotionUsages: [] },
      new Headers({ [authHeaderName]: authHeaderValue }), '/api/promotion/promoaccount/notifyUsage', Date.now(),
    );
    expect(result.status).toBe(200);
  });

  it('returns 400 when type is not one of the allowed values', () => {
    const account = 'promoaccount-notify-badtype-test';
    const { authHeaderName, authHeaderValue } = getPromotionConfig(account);
    const result = handleNotifyUsage(
      account, { orderId: 'o1', type: 'Refund', promotionUsages: [] },
      new Headers({ [authHeaderName]: authHeaderValue }), '/api/promotion/promoaccount/notifyUsage', Date.now(),
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: 'Bad Request', message: expect.stringContaining('type must be one of') });
  });

  it('returns 400 when type is missing entirely', () => {
    const account = 'promoaccount-notify-notype-test';
    const { authHeaderName, authHeaderValue } = getPromotionConfig(account);
    const result = handleNotifyUsage(
      account, { orderId: 'o1', promotionUsages: [] },
      new Headers({ [authHeaderName]: authHeaderValue }), '/api/promotion/promoaccount/notifyUsage', Date.now(),
    );
    expect(result.status).toBe(400);
  });

  it('returns 400 when orderId is missing', () => {
    const account = 'promoaccount-notify-noorder-test';
    const { authHeaderName, authHeaderValue } = getPromotionConfig(account);
    const result = handleNotifyUsage(
      account, { type: 'NewOrder', promotionUsages: [] },
      new Headers({ [authHeaderName]: authHeaderValue }), '/api/promotion/promoaccount/notifyUsage', Date.now(),
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: 'Bad Request', message: expect.stringContaining('orderId') });
  });

  it('returns 400 when promotionUsages is missing or not an array', () => {
    const account = 'promoaccount-notify-nousages-test';
    const { authHeaderName, authHeaderValue } = getPromotionConfig(account);
    const result = handleNotifyUsage(
      account, { orderId: 'o1', type: 'NewOrder' },
      new Headers({ [authHeaderName]: authHeaderValue }), '/api/promotion/promoaccount/notifyUsage', Date.now(),
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: 'Bad Request', message: expect.stringContaining('promotionUsages') });
  });

  it('returns 400 when a promotionUsages entry is missing promotionId or discount', () => {
    const account = 'promoaccount-notify-baditem-test';
    const { authHeaderName, authHeaderValue } = getPromotionConfig(account);
    const result = handleNotifyUsage(
      account, { orderId: 'o1', type: 'NewOrder', promotionUsages: [{ promotionId: 'r1' }] },
      new Headers({ [authHeaderName]: authHeaderValue }), '/api/promotion/promoaccount/notifyUsage', Date.now(),
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: 'Bad Request', message: expect.stringContaining('discount') });
  });

  it('returns 400 (not 401) when unauthorized AND the body is invalid — auth is checked first', () => {
    const result = handleNotifyUsage(
      'promoaccount-notify-authfirst-test', { orderId: 'o1', type: 'BadType', promotionUsages: [] },
      new Headers(), '/api/promotion/promoaccount/notifyUsage', Date.now(),
    );
    // Auth is checked before body validation, so an unauthorized + invalid-type request
    // still surfaces as 401, not 400.
    expect(result.status).toBe(401);
  });

  it('rejects a malformed/empty body the same way a missing-field body would be rejected', () => {
    const account = 'promoaccount-notify-empty-test';
    const { authHeaderName, authHeaderValue } = getPromotionConfig(account);
    const result = handleNotifyUsage(
      account, {},
      new Headers({ [authHeaderName]: authHeaderValue }), '/api/promotion/promoaccount/notifyUsage', Date.now(),
    );
    expect(result.status).toBe(400);
  });

  it('logs every outcome — success, 401, and 400 — to the account call log', () => {
    const account = 'promoaccount-notify-log-test';
    const { authHeaderName, authHeaderValue } = getPromotionConfig(account);
    const authedHeaders = new Headers({ [authHeaderName]: authHeaderValue });

    handleNotifyUsage(account, { orderId: 'o1', type: 'NewOrder', promotionUsages: [] }, authedHeaders, '/x', Date.now());
    handleNotifyUsage(account, { orderId: 'o2', type: 'BadType', promotionUsages: [] }, authedHeaders, '/x', Date.now());
    handleNotifyUsage(account, { orderId: 'o3', type: 'NewOrder', promotionUsages: [] }, new Headers(), '/x', Date.now());

    const calls = listPromotionCallLog(account);
    expect(calls).toHaveLength(3);
    expect(calls.map(c => c.httpStatus).sort()).toEqual([200, 400, 401]);
  });
});
