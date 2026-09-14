// VTEX Tax Service protocol types
// Spec: https://developers.vtex.com/docs/guides/tax-services-specification
// Unlike PPP/Marketplace/Gift Card, this protocol has a single synchronous endpoint —
// no manifest, no hub registration API. Registration happens via the Checkout API's
// orderForm.taxConfiguration (url, authorizationHeader, appId, isMarketplaceResponsibleForTaxes).

export type TaxScenario = 'apply' | 'no-tax' | 'error';

// A single percentage-based tax rule, applied independently to every line item's price.
export type TaxRule = {
  id: string;
  name: string;
  description: string;
  percentage: number; // 0 < percentage <= 100
  active: boolean;
  createdAt: string;
};

export type TaxConfig = {
  scenario: TaxScenario;
  // Shared secret VTEX echoes back verbatim in the `Authorization` header on every call —
  // set once via taxConfiguration.authorizationHeader when registering the provider.
  authorizationHeader: string;
  isMarketplaceResponsibleForTaxes: boolean;
  rules: TaxRule[];
};

// Inbound line item from VTEX Checkout. Docs describe `id`/`shippingDestinationId` as
// numbers, but real Checkout traffic sends opaque strings — accept both to match reality.
export type TaxItem = {
  id: string | number;
  sku?: string | null;
  productId?: string | null;
  ean?: string | null;
  refId?: string | null;
  categoryId?: string | null;
  unitMultiplier?: number | string | null;
  measurementUnit?: string | null;
  targetPrice?: number | string | null;
  itemPrice: number | string;
  quantity: number | string;
  discountPrice?: number | string | null;
  dockId?: string | null;
  freightPrice?: number | string | null;
  brandId?: string | null;
  taxCode?: string | null;
  sellerId?: string | null;
  shippingDestinationId?: string | number | null;
  [key: string]: unknown;
};

export type TaxShippingDestination = {
  id: string | number;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  street?: string | null;
  [key: string]: unknown;
};

export type TaxTotal = {
  id?: string | null;
  name?: string | null;
  value?: number | string | null;
  [key: string]: unknown;
};

// Body sent by VTEX Checkout to the registered tax provider URL.
export type TaxCalculationRequest = {
  orderFormId?: string | null;
  salesChannel?: string | null;
  items: TaxItem[];
  totals?: TaxTotal[] | null;
  clientEmail?: string | null;
  shippingDestinations?: TaxShippingDestination[] | null;
  clientData?: Record<string, unknown> | null;
  paymentData?: Record<string, unknown> | null;
  taxApp?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type TaxLineItemTax = {
  name: string;
  description: string;
  value: number;
};

// Response shape required by the spec: one entry per input item, same order, same id.
// `hooks` is a best-effort addition — see the comment above handleCalculateTax in
// taxHandlers.ts for why its shape isn't taken from a published field table.
export type TaxCalculationResponseItem = {
  id: string | number;
  taxes: TaxLineItemTax[];
  hooks?: { commit?: { url: string } };
};

export type TaxCallLogEntry = {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  requestBody?: unknown;
  responseBody?: unknown;
  httpStatus: number;
  durationMs: number;
};
