export type MktScenario = 'available' | 'unavailable' | 'partial';

export type MktSimulationItem = {
  id: string;
  quantity: number;
  seller?: string;
};

export type MktSimulationRequest = {
  items: MktSimulationItem[];
  postalCode?: string;
  country?: string;
  geoCoordinates?: number[];
  [key: string]: unknown;
};

export type MktOrderRequest = {
  marketplaceOrderId?: string;
  marketplaceServicesEndpoint?: string;
  clientProfileData?: unknown;
  shippingData?: unknown;
  items?: unknown[];
  [key: string]: unknown;
};

export type MktFulfillRequest = {
  marketplaceOrderId?: string;
  [key: string]: unknown;
};

export type MktCancellationRequest = {
  marketplaceOrderId?: string;
  reason?: string;
  [key: string]: unknown;
};

export type MktOrderRecord = {
  orderId: string;
  sellerOrderId: string;
  account: string;
  status: 'placed' | 'authorized' | 'cancelled';
  placedAt: string;
  authorizedAt?: string;
  cancelledAt?: string;
  requestBody?: unknown;
};

export type MktCallEndpoint = 'simulation' | 'placement' | 'fulfill' | 'cancel';

export type MktCallLogEntry = {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  account: string;
  orderId?: string;
  endpoint: MktCallEndpoint;
  requestBody?: unknown;
  responseBody: unknown;
  httpStatus: number;
  durationMs: number;
};

export type MktConfig = {
  scenario: MktScenario;
};
