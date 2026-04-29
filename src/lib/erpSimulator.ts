// src/lib/erpSimulator.ts
// Pure ERP normalization + simulated ERP acceptance.
// Both functions accept their inputs via parameters — no environment variable reads.
// PII masking is applied at normalization time (SEC-01, SEC-02, SEC-03).

import type { VtexOrder } from '@/types/vtex';
import type { ErpOrderPayload, ErpSimulationResult, AppConfig } from '@/types/erp';
import { maskEmail, maskDocument } from '@/lib/piiMasker';

/**
 * Map a full VTEX Get Order response to the normalized ERP payload.
 *
 * Rules:
 *  - externalOrderId and orderId: vtexOrder.orderId ?? ''
 *  - customer.emailMasked: maskEmail(profile?.email) — always masked
 *  - customer.documentMasked: maskDocument(profile?.document) — always masked
 *  - customer.name: firstName + ' ' + lastName (trimmed), or undefined if both absent
 *  - items[].total: quantity * sellingPrice (both must be non-null numbers), else undefined
 *  - paymentSummary: first transaction's first payment's paymentSystemName
 *  - shippingSummary: logisticsInfo[0].selectedSla
 *  - marketplace: 'MARKETPLACE' if marketplaceOrderId is non-empty, else undefined
 *  - rawSource: always 'VTEX'
 *  - All field accesses use optional chaining (vtexOrder.items?.map, etc.)
 */
export function normalizeOrder(vtexOrder: VtexOrder): ErpOrderPayload {
  const profile = vtexOrder.clientProfileData;
  const items = vtexOrder.items ?? [];
  const logistics = vtexOrder.shippingData?.logisticsInfo ?? [];
  const firstSla = logistics[0]?.selectedSla ?? undefined;
  const payments = vtexOrder.paymentData?.transactions?.[0]?.payments ?? [];
  const firstPayment = payments[0];

  const customerName =
    [profile?.firstName, profile?.lastName]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join(' ') || undefined;

  return {
    externalOrderId: vtexOrder.orderId ?? '',
    orderId: vtexOrder.orderId ?? '',
    sequence: vtexOrder.sequence,
    status: vtexOrder.status,
    creationDate: vtexOrder.creationDate,
    customer: {
      name: customerName,
      emailMasked: profile?.email ? maskEmail(profile.email) : undefined,
      documentMasked: profile?.document ? maskDocument(profile.document) : undefined,
    },
    items: items.map((item) => ({
      skuId: item.id,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      sellingPrice: item.sellingPrice,
      total:
        item.quantity != null && item.sellingPrice != null
          ? item.quantity * item.sellingPrice
          : undefined,
      imageUrl: item.imageUrl,
    })),
    totals: vtexOrder.totals,
    paymentSummary: firstPayment?.paymentSystemName,
    shippingSummary: firstSla,
    logisticsInfo: vtexOrder.shippingData?.logisticsInfo,
    marketplace: vtexOrder.marketplaceOrderId ? 'MARKETPLACE' : undefined,
    rawSource: 'VTEX',
  };
}

/**
 * Simulate ERP acceptance. Returns SUCCESS by default; returns FAILURE when
 * config.simulateErpFailure is true.
 *
 * Never throws — callers can rely on the return value discriminant (status).
 * Config is a parameter — never call getServerConfig() here.
 */
export function simulateErpAcceptance(
  _payload: ErpOrderPayload,
  config: Pick<AppConfig, 'simulateErpFailure'>,
): ErpSimulationResult {
  if (config.simulateErpFailure) {
    return {
      status: 'FAILURE',
      reason: 'ERP failure simulation enabled via config flag',
      failedAt: new Date().toISOString(),
    };
  }
  return {
    status: 'SUCCESS',
    acceptedAt: new Date().toISOString(),
  };
}
