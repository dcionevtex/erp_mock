// VTEX Payment Provider Protocol types
// Spec: https://developers.vtex.com/docs/guides/payment-provider-protocol

export type PppScenario = 'approved' | 'denied' | 'pending' | 'undefined';

// Inbound request from VTEX test suite — POST /payments
export type PppCreatePaymentRequest = {
  reference?: string;
  orderId?: string;
  transactionId?: string;
  paymentId: string;
  paymentMethod?: string;
  merchantName?: string;
  value?: number;
  currency?: string;
  installments?: number;
  card?: unknown;
  miniCart?: unknown;
  callbackUrl?: string;
  returnUrl?: string;
  [key: string]: unknown;
};

export type PppPaymentStatus = 'approved' | 'denied' | 'pending' | 'undefined';

// Internal record per payment — stored in pppStore
export type PppPaymentRecord = {
  paymentId: string;
  orderId?: string;
  transactionId?: string;
  paymentMethod?: string;
  value?: number;
  currency?: string;
  installments?: number;
  callbackUrl?: string;
  status: PppPaymentStatus;
  scenario: PppScenario;
  authorizationId?: string;
  settleId?: string;
  cancellationId?: string;
  refundId?: string;
  createdAt: string;
  settledAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
  requestBody?: unknown;
};

// Each call received by the simulator — drives the dashboard call log
export type PppCallLogEntry = {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST';
  path: string;
  paymentId?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  httpStatus: number;
  durationMs: number;
};

// Runtime config for the payment provider simulator
export type PppConfig = {
  scenario: PppScenario;
};

// Manifest response — GET /payment-methods/manifest
export type PppManifest = {
  paymentMethods: Array<{
    name: string;
    allowsSplit: string;
  }>;
  customFields: unknown[];
  autoSettleDelay?: {
    minimum: string;
    maximum: string;
  };
};
