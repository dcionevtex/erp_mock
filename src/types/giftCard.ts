// VTEX Gift Card Provider Protocol types
// Spec: https://developers.vtex.com/docs/api-reference/giftcard-provider-protocol

export type GcScenario = 'approved' | 'empty';

export type GcConfig = {
  scenario: GcScenario;
  mockBalance: number; // stored as-is, interpreted as currency units by the store
};

// Internal representation of a gift card stored in memory
export type GiftCardRecord = {
  id: string;
  redemptionCode: string;
  caption: string;
  initialBalance: number;
  expiryDate: string;
  owner: string; // customer email
  account: string;
  createdAt: string;
  currencyCode?: string; // captured from VTEX request, not assumed
};

// A debit transaction created by VTEX at checkout
export type GcTransactionRecord = {
  id: string;
  giftCardId: string;
  value: number;
  description: string;
  date: string;
  settlements: GcOperation[];
  cancellations: GcOperation[];
};

// Shared shape for settlement and cancellation responses
export type GcOperation = {
  oid: string;
  value: number;
  date: string;
};

// Inbound search request from VTEX
export type GcSearchRequest = {
  client?: {
    id?: string;
    email?: string;
    document?: string;
    corporateDocument?: string;
  };
  [key: string]: unknown;
};

// Inbound transaction creation request from VTEX
export type GcTransactionRequest = {
  operation?: string;
  value?: number;
  description?: string;
  redemptionToken?: string;
  redemptionCode?: string;
  requestId?: string;
  [key: string]: unknown;
};

// Call log entry for the dashboard
export type GcCallLogEntry = {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST';
  path: string;
  endpoint: string;
  requestBody?: unknown;
  responseBody?: unknown;
  httpStatus: number;
  durationMs: number;
};
