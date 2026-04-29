// src/types/vtex.ts
// VTEX OMS wire-format types — the shapes the VTEX API actually returns.
// All fields default to optional to defend against partial responses (PITFALL S4).

export type VtexClientProfileData = {
  email?: string;
  firstName?: string;
  lastName?: string;
  document?: string;
  documentType?: string;
  phone?: string;
  corporateName?: string;
  isCorporate?: boolean;
};

export type VtexShippingAddress = {
  addressId?: string;
  addressType?: string;
  receiverName?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  complement?: string;
  reference?: string;
};

export type VtexLogisticsInfo = {
  itemIndex?: number;
  selectedSla?: string;
  selectedDeliveryChannel?: string;
  shippingEstimate?: string;
  shippingEstimateDate?: string;
  deliveryCompany?: string;
  deliveryWindow?: unknown;
  price?: number;
  listPrice?: number;
  sellingPrice?: number;
};

export type VtexShippingData = {
  address?: VtexShippingAddress;
  logisticsInfo?: VtexLogisticsInfo[];
};

export type VtexOrderItem = {
  uniqueId?: string;
  id?: string;       // skuId
  productId?: string;
  ean?: string;
  refId?: string;
  name?: string;
  quantity?: number;
  price?: number;
  listPrice?: number;
  sellingPrice?: number;
  measurementUnit?: string;
  unitMultiplier?: number;
  imageUrl?: string;
};

export type VtexPaymentTransaction = {
  transactionId?: string;
  paymentSystemName?: string;
  installments?: number;
  value?: number;
  status?: string;
  group?: string;
};

export type VtexPaymentData = {
  transactions?: Array<{
    transactionId?: string;
    payments?: VtexPaymentTransaction[];
  }>;
};

export type VtexTotal = {
  id?: string;        // "Items" | "Discounts" | "Shipping" | "Tax" | ...
  name?: string;
  value?: number;
};

// Top-level VTEX Get Order response.
export type VtexOrder = {
  orderId?: string;
  sequence?: string;
  status?: string;
  statusDescription?: string;
  creationDate?: string;
  lastChange?: string;
  marketplaceOrderId?: string;
  marketplaceServicesEndpoint?: string;
  origin?: string;
  affiliateId?: string;
  salesChannel?: string;
  storePreferencesData?: unknown;
  value?: number;
  totals?: VtexTotal[];
  items?: VtexOrderItem[];
  clientProfileData?: VtexClientProfileData | null;
  shippingData?: VtexShippingData | null;
  paymentData?: VtexPaymentData | null;
  hostname?: string;
  customData?: unknown;
};

// VTEX Feed item (the queue entry — see CLAUDE.MD §11, PITFALL M4).
// `handle` is the commit identifier; for dedup prefer composite of orderId+currentState+currentChangeDate.
// VTEX Feed v3 confirmed fields: handle, orderId, currentState, lastState, currentChangeDate, lastChangeDate, domain.
export type VtexFeedItem = {
  handle: string;             // REQUIRED — used by commitFeedItems
  eventId?: string;           // Forward compat — not always present in Feed v3
  id?: string;                // Forward compat
  orderId?: string;
  state?: string;             // Legacy field name (kept for backward compat)
  currentState?: string;      // VTEX Feed v3 primary state field
  lastState?: string;         // VTEX Feed v3 previous state
  currentChangeDate?: string; // ISO 8601 — used as dedup timestamp
  lastChangeDate?: string;    // ISO 8601
  domain?: string;            // e.g., "Marketplace"
  parentAccountName?: string;
  date?: string;              // Legacy field name (kept for backward compat)
};

// VTEX Hook payload — orderId may live at multiple paths (PITFALL C6).
// Typed as a discriminated grab-bag; extraction logic in Phase 3 handles the variants.
export type VtexHookPayload = {
  orderId?: string;
  OrderId?: string;
  state?: string;
  State?: string;          // VTEX OMS hook uses capital-S State
  domain?: string;
  Domain?: string;
  lastState?: string;
  LastState?: string;
  currentState?: string;
  CurrentState?: string;
  lastChange?: string;
  vtexAccount?: string;
  order?: { orderId?: string; OrderId?: string; state?: string };
  data?: { orderId?: string; OrderId?: string; state?: string };
  // Catch-all for unforeseen shapes — extraction is best-effort.
  [key: string]: unknown;
};

// Start Handling response — VTEX returns no body on success; minimal type.
export type VtexStartHandlingResponse = {
  date?: string;
  receipt?: string;
};

// Typed VTEX error wrapper (thrown by vtexClient on non-2xx).
export type VtexApiErrorShape = {
  status: number;
  statusText?: string;
  body?: unknown;
  url: string;
};
