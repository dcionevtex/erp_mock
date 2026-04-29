// src/lib/orderProcessor.ts
// Full pipeline orchestration: Get Order → PII mask → normalize → ERP simulate → Start Handling.
// All three Start Handling guards live here (PIPE-05, PIPE-06, PIPE-07).
// Accepts injected dependencies for testability — never calls getServerConfig() directly.

import type { IntegrationSource, AppConfig } from '@/types/erp';
import type { VtexClient } from '@/lib/vtexClient';
import {
  upsertOrder,
  getOrderByOrderId,
  setOrderStatus,
  appendTimelineEntry,
  incrementAttempts,
} from '@/lib/store';
import { normalizeOrder, simulateErpAcceptance } from '@/lib/erpSimulator';
import { maskOrderPayload } from '@/lib/piiMasker';

export interface ProcessOrderDeps {
  vtexClient: VtexClient;
  config: Pick<AppConfig, 'simulateErpFailure'>;
}

/**
 * Run the full processing pipeline for a given orderId.
 * The record must already exist in the store before this is called (created by the caller).
 *
 * Guard ordering:
 *   1. PIPE-07: If startHandlingStatus === 'SUCCESS' → write SKIPPED timeline entry and return.
 *   2. PIPE-06: If getOrder throws → write GET_ORDER_ERROR timeline entry and return.
 *   3. PIPE-05: If ERP simulation returns FAILURE → write ERP_SIMULATION_ERROR timeline entry and return.
 *
 * Timeline entries are written for every pipeline step (PIPE-08).
 * vtexOrderRaw stored on the record is always PII-masked via maskOrderPayload (SEC-03).
 */
export async function processOrder(
  orderId: string,
  _source: IntegrationSource,
  deps: ProcessOrderDeps,
): Promise<void> {
  const record = getOrderByOrderId(orderId);
  if (!record) return;

  // PIPE-07 guard: already successfully handled — skip entire pipeline
  if (record.startHandlingStatus === 'SUCCESS') {
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_REQUESTED',
      status: 'SKIPPED',
      message: 'Order already has startHandlingStatus SUCCESS — pipeline skipped (PIPE-07)',
    });
    return;
  }

  incrementAttempts(record.id);
  setOrderStatus(record.id, 'PROCESSING');

  // Step 1: Get Order
  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'GET_ORDER_REQUESTED',
    status: 'INFO',
    message: `Calling VTEX Get Order for orderId: ${orderId}`,
  });

  let vtexOrder;
  try {
    vtexOrder = await deps.vtexClient.getOrder(orderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setOrderStatus(record.id, 'ERROR');
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'GET_ORDER_ERROR',
      status: 'ERROR',
      message,
    });
    // PIPE-06: Do NOT proceed to Start Handling
    return;
  }

  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'GET_ORDER_SUCCESS',
    status: 'SUCCESS',
    message: `Get Order succeeded for orderId: ${orderId}`,
  });

  // Step 2: Normalize + store PII-masked raw payload (SEC-03)
  const erpPayload = normalizeOrder(vtexOrder);
  const maskedRaw = maskOrderPayload(vtexOrder);

  // Re-fetch the record to get the latest state before upsert
  const freshRecord = getOrderByOrderId(orderId);
  if (freshRecord) {
    upsertOrder({
      ...freshRecord,
      vtexOrderRaw: maskedRaw,
      erpPayload,
      vtexStatus: vtexOrder.status,
      customerName: erpPayload.customer?.name,
      customerEmailMasked: erpPayload.customer?.emailMasked,
      totalValue: vtexOrder.value,
      itemCount: vtexOrder.items?.length,
      paymentSummary: erpPayload.paymentSummary,
      shippingSummary: erpPayload.shippingSummary,
    });
  }

  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'ERP_PAYLOAD_NORMALIZED',
    status: 'SUCCESS',
  });

  // Step 3: ERP simulation
  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'ERP_SIMULATION_STARTED',
    status: 'INFO',
  });

  const erpResult = simulateErpAcceptance(erpPayload, deps.config);

  if (erpResult.status !== 'SUCCESS') {
    setOrderStatus(record.id, 'ERROR');
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'ERP_SIMULATION_ERROR',
      status: 'ERROR',
      message: erpResult.reason,
    });
    // PIPE-05: Do NOT proceed to Start Handling
    return;
  }

  setOrderStatus(record.id, 'ERP_ACCEPTED');
  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'ERP_SIMULATION_SUCCESS',
    status: 'SUCCESS',
    message: erpResult.acceptedAt,
  });

  // Step 4: Start Handling (PIPE-04)
  appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'START_HANDLING_REQUESTED',
    status: 'INFO',
  });

  try {
    await deps.vtexClient.startHandling(orderId);
    const r = getOrderByOrderId(orderId);
    if (r) upsertOrder({ ...r, startHandlingStatus: 'SUCCESS' });
    setOrderStatus(record.id, 'START_HANDLING_SUCCESS');
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_SUCCESS',
      status: 'SUCCESS',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const r = getOrderByOrderId(orderId);
    if (r) upsertOrder({ ...r, startHandlingStatus: 'ERROR', errorMessage: message });
    setOrderStatus(record.id, 'START_HANDLING_ERROR');
    appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_ERROR',
      status: 'ERROR',
      message,
    });
  }
}
