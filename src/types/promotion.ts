// VTEX External Promotions Protocol types (protocol v1.1)
// Spec: https://developers.vtex.com/docs/api-reference/external-promotions-protocol-api
// Unlike Tax/PPP/Gift Card, this protocol has no self-service registration API — VTEX
// activates it per account via a support ticket where the merchant shares the two
// endpoint URLs (calculatePromotion, notifyUsage) and the auth header value.

export type PromotionScenario = 'apply' | 'no-promotions' | 'error';

export type PromotionDiscountType = 'PERCENTAGE' | 'FIXED';

// A single promotion rule. Percentage/fixed discounts stack sequentially (each rule
// discounts the price already reduced by prior rules), optionally gated by a coupon code.
export type PromotionRule = {
  id: string;
  name: string;
  description: string;
  type: PromotionDiscountType;
  value: number; // percent (0-100) for PERCENTAGE, flat per-unit amount for FIXED
  couponCode: string | null; // null = always applies when active; set = requires this coupon
  active: boolean;
  createdAt: string;
};

export type PromotionConfig = {
  scenario: PromotionScenario;
  // VTEX sends its API key in a header whose NAME is configurable per account (defaults
  // "Authorization"), optionally with a prefix such as "Bearer ". Both are configurable
  // here since the real protocol lets VTEX support set either independently.
  authHeaderName: string;
  authHeaderValue: string;
  rules: PromotionRule[];
};

// ── Inbound request (POST /calculatePromotion) ───────────────────────────────

export type PromotionCatalogInfo = {
  brandId: string;
  categoryId: string;
  productId: string;
  ean?: string | null;
  refId?: string | null;
  collectionIds?: string[] | null;
  [key: string]: unknown;
};

export type PromotionPaymentInfo = { id: string; value: number | string };

// Hybrid orchestration (protocol v1.1) — how native VTEX promotions already changed this
// line before the external engine runs. Accepted but not used in calculation (see
// promotionHandlers.ts comment) — same deliberate scope limit as the Avalara jurisdiction
// fields in the Tax Provider simulator.
export type PromotionNativeLayer = {
  priceBeforeLayer: number | string;
  priceAfterLayer: number | string;
  appliedPromotions?: Array<{ id: string; type: 'Nominal'; discount: number | string }> | null;
};

export type PromotionItem = {
  id: string;
  sellerId: string;
  quantity: number | string;
  price: number | string;
  catalogInfo: PromotionCatalogInfo;
  paymentInfo?: PromotionPaymentInfo[] | null;
  nativePromotionLayer?: PromotionNativeLayer | null;
  [key: string]: unknown;
};

export type CalculatePromotionRequest = {
  correlationId: string;
  origin: 'Marketplace' | 'Fulfillment';
  salesChannelId: string;
  items: PromotionItem[];
  couponCodes?: string[] | null;
  utms?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    internalCampaign?: string | null;
  } | null;
  customFields?: Record<string, Record<string, string>> | null;
  shopperProfileId?: string | null;
  [key: string]: unknown;
};

// ── Response (POST /calculatePromotion) ───────────────────────────────────────
// Per the spec: the discount VTEX actually applies comes only from
// items[].promotions[].discount (x quantity), and only when that promotion's id is
// also present in allPromotions. originalPrice/discountedPrice are informational only.

// The protocol supports Nominal external promotions ONLY — a fixed monetary amount off
// the item price. The spec is explicit that Percentual and Shipping types "are not
// supported. Do not return those types; they are outside this contract and will not be
// applied." A percentage-based rule in this simulator is therefore resolved to a
// concrete per-unit amount and still reported as Nominal.
export type PromotionAppliedDiscountType = 'Nominal';

export type CalculatePromotionResponseItem = {
  id: string;
  quantity?: number;
  promotions?: Array<{ id: string; discount: number; type: PromotionAppliedDiscountType }>;
  originalPrice?: number;
  discountedPrice?: number;
};

export type CalculatePromotionResponse = {
  items: CalculatePromotionResponseItem[];
  allPromotions: Array<{ id: string; name: string; description: string; couponCode: string | null }>;
};

// ── Inbound request (POST /notifyUsage) ───────────────────────────────────────

export type NotifyUsageRequest = {
  orderId: string;
  type: 'NewOrder' | 'OrderCancellation';
  correlationId?: string | null;
  promotionUsages: Array<{ promotionId: string; discount: number | string; couponCode?: string | null }>;
  [key: string]: unknown;
};

export type PromotionCallLogEntry = {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  requestBody?: unknown;
  responseBody?: unknown;
  httpStatus: number;
  durationMs: number;
};
