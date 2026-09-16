// Business logic for the External Promotions Protocol's two endpoints.
// Account-scoped — account is always the first argument.
//
// Calculation logic ported from the reference implementation (external-promotion-engine):
// active rules apply sequentially in catalog order, each discounting the price already
// reduced by prior rules ("VTEX's documented layered-discount behavior"), optionally
// gated by a coupon code. A rule that computes a <= 0 discount is skipped entirely.

import { getPromotionConfig, appendPromotionCallLog } from '@/lib/promotionStore';
import type {
  CalculatePromotionRequest,
  CalculatePromotionResponse,
  CalculatePromotionResponseItem,
  NotifyUsageRequest,
  PromotionRule,
} from '@/types/promotion';

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePromotions(
  items: CalculatePromotionRequest['items'],
  couponCodes: string[] | null | undefined,
  rules: Pick<PromotionRule, 'id' | 'name' | 'description' | 'type' | 'value' | 'couponCode' | 'active'>[],
): CalculatePromotionResponse {
  const activeCoupons = new Set((couponCodes ?? []).map(c => c.toUpperCase()));
  const activeRules = rules.filter(r => r.active);

  const responseItems: CalculatePromotionResponseItem[] = items.map(item => {
    const originalPrice = toNumber(item.price);
    const quantity = toNumber(item.quantity);
    let runningPrice = originalPrice;
    const applied: CalculatePromotionResponseItem['promotions'] = [];

    for (const rule of activeRules) {
      if (rule.couponCode && !activeCoupons.has(rule.couponCode.toUpperCase())) continue;

      // A PERCENTAGE rule is only a way to *compute* the amount — the wire contract
      // still carries a fixed per-unit amount typed 'Nominal', the protocol's only
      // supported discount type.
      const unitDiscount =
        rule.type === 'PERCENTAGE'
          ? round2(runningPrice * (rule.value / 100))
          : Math.min(rule.value, runningPrice);

      if (unitDiscount <= 0) continue;

      runningPrice = round2(runningPrice - unitDiscount);
      applied.push({ id: rule.id, discount: unitDiscount, type: 'Nominal' });
    }

    return applied.length
      ? { id: item.id, quantity, promotions: applied, originalPrice, discountedPrice: runningPrice }
      : { id: item.id, quantity, originalPrice, discountedPrice: originalPrice };
  });

  // Every applied promotion id must also appear in allPromotions or VTEX silently drops
  // its discount — listing every active rule considered (not just ones that ended up
  // applying to an item) trivially satisfies that and matches the reference's approach.
  const allPromotions = activeRules.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    couponCode: r.couponCode,
  }));

  return { items: responseItems, allPromotions };
}

// VTEX sends its API key in a header whose NAME is configurable per account (defaults
// "Authorization"), optionally with a prefix such as "Bearer " baked into the value
// itself. Headers.get() is already case-insensitive, so no manual normalization needed.
export function isAuthorized(headers: Headers, authHeaderName: string, expectedValue: string): boolean {
  if (!expectedValue) return true;
  return headers.get(authHeaderName) === expectedValue;
}

export function handleCalculatePromotion(
  account: string,
  body: CalculatePromotionRequest,
  headers: Headers,
  pathname: string,
  start: number,
): { body: unknown; status: number } {
  const config = getPromotionConfig(account);
  const now = new Date().toISOString();
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!isAuthorized(headers, config.authHeaderName, config.authHeaderValue)) {
    const responseBody = { error: 'Unauthorized' };
    appendPromotionCallLog(account, {
      timestamp: now, method: 'POST', path: pathname,
      requestBody: body, responseBody, httpStatus: 401, durationMs: Date.now() - start,
    });
    return { body: responseBody, status: 401 };
  }

  if (config.scenario === 'error') {
    const responseBody = { error: 'Internal Server Error' };
    appendPromotionCallLog(account, {
      timestamp: now, method: 'POST', path: pathname,
      requestBody: body, responseBody, httpStatus: 500, durationMs: Date.now() - start,
    });
    return { body: responseBody, status: 500 };
  }

  const responseBody: CalculatePromotionResponse =
    config.scenario === 'no-promotions'
      ? { items: items.map(item => ({ id: item.id, quantity: toNumber(item.quantity) })), allPromotions: [] }
      : calculatePromotions(items, body?.couponCodes, config.rules);

  appendPromotionCallLog(account, {
    timestamp: now, method: 'POST', path: pathname,
    requestBody: body, responseBody, httpStatus: 200, durationMs: Date.now() - start,
  });

  return { body: responseBody, status: 200 };
}

// Per the spec: "Type of notification. NewOrder indicates a new order was placed, and
// OrderCancellation indicates an order was cancelled. Allowed: NewOrder | OrderCancellation"
const NOTIFY_USAGE_TYPES = ['NewOrder', 'OrderCancellation'] as const;

function isValidNotifyUsageType(type: unknown): type is NotifyUsageRequest['type'] {
  return (NOTIFY_USAGE_TYPES as readonly unknown[]).includes(type);
}

// Validates the notifyUsage request against the protocol's required fields
// (orderId, type, promotionUsages[].promotionId/.discount). Returns a human-readable
// message describing the first violation found, or null when the body is valid.
function validateNotifyUsageRequest(body: unknown): string | null {
  const b = body as Partial<NotifyUsageRequest> | null | undefined;

  if (typeof b?.orderId !== 'string' || !b.orderId) {
    return 'orderId is required and must be a non-empty string';
  }
  if (!isValidNotifyUsageType(b?.type)) {
    return `type must be one of ${NOTIFY_USAGE_TYPES.join(' | ')}, received: ${JSON.stringify(b?.type)}`;
  }
  if (!Array.isArray(b?.promotionUsages)) {
    return 'promotionUsages is required and must be an array';
  }
  for (const usage of b.promotionUsages) {
    if (typeof usage?.promotionId !== 'string' || !usage.promotionId) {
      return 'promotionUsages[].promotionId is required and must be a non-empty string';
    }
    if (usage?.discount === undefined || usage.discount === null || Number.isNaN(Number(usage.discount))) {
      return 'promotionUsages[].discount is required and must be a number';
    }
  }
  return null;
}

// POST /notifyUsage — called back when an order is placed or cancelled, so the provider
// can reconcile promotion/coupon usage. VTEX retries up to 3x with backoff and treats
// any 2xx as success, so a real integration MUST process this idempotently, keyed by
// (orderId, type) — this is the place where a real integration would record redemptions
// and enforce usage limits against the actual promotion engine. The simulator has no
// real engine or usage limits to enforce, so it just acknowledges the call.
export function handleNotifyUsage(
  account: string,
  body: unknown,
  headers: Headers,
  pathname: string,
  start: number,
): { body: unknown; status: number } {
  const config = getPromotionConfig(account);
  const now = new Date().toISOString();

  if (!isAuthorized(headers, config.authHeaderName, config.authHeaderValue)) {
    const responseBody = { error: 'Unauthorized' };
    appendPromotionCallLog(account, {
      timestamp: now, method: 'POST', path: pathname,
      requestBody: body, responseBody, httpStatus: 401, durationMs: Date.now() - start,
    });
    return { body: responseBody, status: 401 };
  }

  const validationError = validateNotifyUsageRequest(body);
  if (validationError) {
    const responseBody = { error: 'Bad Request', message: validationError };
    appendPromotionCallLog(account, {
      timestamp: now, method: 'POST', path: pathname,
      requestBody: body, responseBody, httpStatus: 400, durationMs: Date.now() - start,
    });
    return { body: responseBody, status: 400 };
  }

  const responseBody = {};
  appendPromotionCallLog(account, {
    timestamp: now, method: 'POST', path: pathname,
    requestBody: body, responseBody, httpStatus: 200, durationMs: Date.now() - start,
  });

  return { body: responseBody, status: 200 };
}
