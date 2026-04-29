// src/lib/orderProcessor.ts
// Full pipeline orchestration: Get Order → PII mask → normalize → ERP simulate → Start Handling.
// All three Start Handling guards live here (PIPE-05, PIPE-06, PIPE-07).
// Accepts injected dependencies for testability — never calls getServerConfig() directly.

import type { IntegrationSource, AppConfig } from '@/types/erp';
import type { VtexClient } from '@/lib/vtexClient';

// VTEX statuses that mean Start Handling already happened upstream
const SH_DONE = new Set(['handling', 'verifying-invoice', 'invoiced', 'canceled']);
// VTEX statuses that mean the invoice was already accepted by VTEX
const INVOICE_DONE = new Set(['verifying-invoice', 'invoiced']);
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

export async function processOrder(
  orderId: string,
  _source: IntegrationSource,
  deps: ProcessOrderDeps,
): Promise<void> {
  const record = await getOrderByOrderId(orderId);
  if (!record) return;

  // PIPE-07: already successfully handled — skip
  if (record.startHandlingStatus === 'SUCCESS') {
    await appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_REQUESTED',
      status: 'SKIPPED',
      message: 'Order already has startHandlingStatus SUCCESS — pipeline skipped (PIPE-07)',
    });
    return;
  }

  await incrementAttempts(record.id);
  await setOrderStatus(record.id, 'PROCESSING');

  // Step 1: Get Order
  await appendTimelineEntry(record.id, {
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
    await setOrderStatus(record.id, 'ERROR');
    await appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'GET_ORDER_ERROR',
      status: 'ERROR',
      message,
    });
    // PIPE-06: Do NOT proceed to Start Handling
    return;
  }

  await appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'GET_ORDER_SUCCESS',
    status: 'SUCCESS',
    message: `Get Order succeeded for orderId: ${orderId}`,
  });

  // Step 2: Normalize + store PII-masked raw payload (SEC-03)
  const erpPayload = normalizeOrder(vtexOrder);
  const maskedRaw = maskOrderPayload(vtexOrder);

  const freshRecord = await getOrderByOrderId(orderId);
  if (freshRecord) {
    await upsertOrder({
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

  await appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'ERP_PAYLOAD_NORMALIZED',
    status: 'SUCCESS',
  });

  // Step 3: ERP simulation
  await appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'ERP_SIMULATION_STARTED',
    status: 'INFO',
  });

  const erpResult = simulateErpAcceptance(erpPayload, deps.config);

  if (erpResult.status !== 'SUCCESS') {
    await setOrderStatus(record.id, 'ERROR');
    await appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'ERP_SIMULATION_ERROR',
      status: 'ERROR',
      message: erpResult.reason,
    });
    // PIPE-05: Do NOT proceed to Start Handling
    return;
  }

  await setOrderStatus(record.id, 'ERP_ACCEPTED');
  await appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'ERP_SIMULATION_SUCCESS',
    status: 'SUCCESS',
    message: erpResult.acceptedAt,
  });

  // Step 4: Start Handling (PIPE-04)
  // If VTEX already advanced to 'handling' or beyond, skip the API call and reflect reality.
  const vtexStatus = vtexOrder.status ?? '';
  const shAlreadyDone = SH_DONE.has(vtexStatus);
  const invoiceAlreadyDone = INVOICE_DONE.has(vtexStatus);

  if (shAlreadyDone) {
    const r = await getOrderByOrderId(orderId);
    if (r) {
      await upsertOrder({
        ...r,
        startHandlingStatus: 'SUCCESS',
        ...(invoiceAlreadyDone ? { invoiceStatus: 'SUCCESS' } : {}),
      });
    }
    await setOrderStatus(record.id, invoiceAlreadyDone ? 'INVOICED' : 'START_HANDLING_SUCCESS');
    await appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_SUCCESS',
      status: 'SUCCESS',
      message: `VTEX status is '${vtexStatus}' — Start Handling already completed`,
    });
    if (invoiceAlreadyDone) {
      await appendTimelineEntry(record.id, {
        timestamp: new Date().toISOString(),
        step: 'INVOICE_SUCCESS',
        status: 'SUCCESS',
        message: `VTEX status is '${vtexStatus}' — Invoice already accepted`,
      });
    }
    return;
  }

  await appendTimelineEntry(record.id, {
    timestamp: new Date().toISOString(),
    step: 'START_HANDLING_REQUESTED',
    status: 'INFO',
  });

  try {
    await deps.vtexClient.startHandling(orderId);
    const r = await getOrderByOrderId(orderId);
    if (r) await upsertOrder({ ...r, startHandlingStatus: 'SUCCESS' });
    await setOrderStatus(record.id, 'START_HANDLING_SUCCESS');
    await appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_SUCCESS',
      status: 'SUCCESS',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const r = await getOrderByOrderId(orderId);
    if (r) await upsertOrder({ ...r, startHandlingStatus: 'ERROR', errorMessage: message });
    await setOrderStatus(record.id, 'START_HANDLING_ERROR');
    await appendTimelineEntry(record.id, {
      timestamp: new Date().toISOString(),
      step: 'START_HANDLING_ERROR',
      status: 'ERROR',
      message,
    });
  }
  // Invoice is a manual operator action — see BL-008-D/E
}
