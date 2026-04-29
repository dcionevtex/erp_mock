// src/types/erp.ts
// ERP domain types — the simulated ERP's view of an order.
// See CLAUDE.MD §12 (ErpOrderPayload) and §15 (ErpOrderRecord, status enums).

export type IntegrationSource = "FEED" | "HOOK";

export type TimelineStatus = "SUCCESS" | "ERROR" | "INFO" | "SKIPPED";

export type ErpStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "ERP_ACCEPTED"
  | "START_HANDLING_SUCCESS"
  | "START_HANDLING_ERROR"
  | "ERROR"
  | "DUPLICATE_IGNORED"
  | "MANUALLY_RESOLVED"
  | "CANCELLED";

export type StartHandlingStatus =
  | "NOT_STARTED"
  | "SUCCESS"
  | "ERROR";

export type PipelineStepName =
  | "EVENT_RECEIVED"
  | "GET_ORDER_REQUESTED"
  | "GET_ORDER_SUCCESS"
  | "GET_ORDER_ERROR"
  | "ERP_PAYLOAD_NORMALIZED"
  | "ERP_SIMULATION_STARTED"
  | "ERP_SIMULATION_SUCCESS"
  | "ERP_SIMULATION_ERROR"
  | "START_HANDLING_REQUESTED"
  | "START_HANDLING_SUCCESS"
  | "START_HANDLING_ERROR"
  | "FEED_ITEM_COMMITTED"
  | "DUPLICATE_IGNORED"
  | "MANUALLY_RESOLVED"
  | "CANCEL_REQUESTED"
  | "CANCEL_SUCCESS"
  | "CANCEL_ERROR"
  | "ERROR";

export type ErpTimelineEntry = {
  timestamp: string; // ISO 8601
  step: PipelineStepName | string; // string fallback for ad-hoc messages
  status: TimelineStatus;
  message?: string;
};

export type ErpOrderItem = {
  skuId?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  price?: number;
  sellingPrice?: number;
  total?: number;
  imageUrl?: string;
};

export type ErpOrderCustomer = {
  name?: string;
  emailMasked?: string;
  documentMasked?: string;
};

// The normalized payload an ERP would consume — see CLAUDE.MD §12.
export type ErpOrderPayload = {
  externalOrderId: string;
  orderId: string;
  sequence?: string;
  status?: string;
  creationDate?: string;
  customer?: ErpOrderCustomer;
  items: ErpOrderItem[];
  totals?: unknown;
  paymentSummary?: string;
  shippingSummary?: string;
  logisticsInfo?: unknown;
  marketplace?: string;
  rawSource?: "VTEX";
};

export type ErpSimulationResult =
  | { status: "SUCCESS"; acceptedAt: string }
  | { status: "FAILURE"; reason: string; failedAt: string };

// The internal record stored in the in-memory store — see CLAUDE.MD §15.
export type ErpOrderRecord = {
  id: string;                         // app-internal id (uuid or orderId)
  orderId: string;                    // VTEX orderId
  sequence?: string;                  // VTEX sequence
  account?: string;                   // VTEX account name the order came from
  source: IntegrationSource;
  vtexStatus?: string;
  erpStatus: ErpStatus;
  startHandlingStatus: StartHandlingStatus;
  customerName?: string;
  customerEmailMasked?: string;
  totalValue?: number;
  itemCount?: number;
  paymentSummary?: string;
  shippingSummary?: string;
  receivedAt: string;                 // ISO 8601
  lastAttemptAt?: string;             // ISO 8601
  attempts: number;
  errorMessage?: string;
  vtexOrderRaw?: unknown;             // PII-masked raw payload (see SEC-03)
  erpPayload?: ErpOrderPayload;
  startHandlingResponse?: unknown;
  timeline: ErpTimelineEntry[];
};

// Event log entry for the technical/debug view (separate from the per-order timeline).
export type EventLogEntry = {
  timestamp: string;
  source: IntegrationSource | "SYSTEM";
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  orderId?: string;
  payload?: unknown; // PII-masked
};

// Configuration shape (used by the in-memory config in Plan 03 and CONFIG-* requirements in Phase 4).
export type IntegrationMode = "FEED" | "HOOK";

export type AppConfig = {
  account: string;
  environment: string;
  appKey: string;
  // appToken is intentionally NOT exposed in this type because it must never be returned in API responses.
  // The store keeps it internally; the API surface uses AppConfigPublic instead.
  integrationMode: IntegrationMode;
  autoCommitFeed: boolean;
  simulateErpFailure: boolean;
};

// Public-safe config (returned by GET /api/config — never includes the token).
export type AppConfigPublic = AppConfig & {
  appTokenConfigured: boolean;
};
