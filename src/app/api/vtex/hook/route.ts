// src/app/api/vtex/hook/route.ts
// POST /api/vtex/hook — receives VTEX order notifications and runs the full processing pipeline.
// SECURITY (SEC-05): Optional demo-level hook secret validation via x-demo-hook-secret header.
// See CLAUDE.MD §10 for full hook endpoint requirements.

export const runtime = 'nodejs';

import { getMissingCredentials, isHookSecretValid, buildServerConfig, buildConfigForAccount } from '@/lib/config';
import { upsertOrder, getOrderByOrderId, appendEventLog, appendTimelineEntry, hasProcessedKey, markProcessedKey } from '@/lib/store';
import { createVtexClient } from '@/lib/vtexClient';
import { extractOrderId, extractVtexStatus } from '@/lib/hookParser';
import { processOrder } from '@/lib/orderProcessor';
import type { ErpOrderRecord } from '@/types';


// VTEX validates the hook URL with a GET request before sending notifications.
export async function GET(): Promise<Response> {
  return Response.json({ ok: true, endpoint: 'vtex-hook' });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const accountParam = new URL(request.url).searchParams.get('account');
  const cfg = accountParam
    ? (await buildConfigForAccount(accountParam)) ?? (await buildServerConfig())
    : await buildServerConfig();
  const secret = request.headers.get('x-demo-hook-secret');
  if (!isHookSecretValid(secret, cfg as Parameters<typeof isHookSecretValid>[1])) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const orderId = extractOrderId(body as Record<string, unknown>);
  if (!orderId) {
    // Return 200 so VTEX validation/ping requests are accepted.
    // Unknown payloads (e.g. test pings with no orderId) are logged and ignored.
    await appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'HOOK',
      level: 'WARN',
      message: 'Hook payload received but orderId could not be extracted — ignoring',
      payload: body,
    });
    return Response.json({ received: true, skipped: true, reason: 'no_order_id' });
  }

  const now = new Date().toISOString();
  const hookVtexStatus = extractVtexStatus(body as Record<string, unknown>);

  const existing = await getOrderByOrderId(orderId);
  if (existing) {
    // Order already known — preserve all progress, just add a timeline entry and
    // update vtexStatus from the hook payload if present. processOrder's PIPE-07
    // guard will skip re-processing if startHandlingStatus is already SUCCESS.
    if (hookVtexStatus && hookVtexStatus !== existing.vtexStatus) {
      await upsertOrder({ ...existing, vtexStatus: hookVtexStatus });
    }
    await appendTimelineEntry(existing.id, {
      timestamp: now,
      step: 'EVENT_RECEIVED',
      status: 'INFO',
      message: `Hook re-received for orderId: ${orderId}${hookVtexStatus ? ` — VTEX status: ${hookVtexStatus}` : ''}`,
    });
  } else {
    // New order — create a fresh record
    const record: ErpOrderRecord = {
      id: orderId,
      orderId,
      account: cfg.account || accountParam || undefined,
      source: 'HOOK',
      erpStatus: 'RECEIVED',
      startHandlingStatus: 'NOT_STARTED',
      invoiceStatus: 'NOT_SENT',
      receivedAt: now,
      attempts: 0,
      timeline: [{
        timestamp: now,
        step: 'EVENT_RECEIVED',
        status: 'INFO',
        message: `Hook event received for orderId: ${orderId}${hookVtexStatus ? ` — VTEX status: ${hookVtexStatus}` : ''}`,
      }],
    };
    await upsertOrder(record);
  }

  await appendEventLog({
    timestamp: now,
    source: 'HOOK',
    level: 'INFO',
    message: `Hook received orderId: ${orderId}${hookVtexStatus ? ` (${hookVtexStatus})` : ''}`,
    orderId,
    payload: body,
  });

  const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
  if (missing.length > 0) {
    await appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'HOOK',
      level: 'ERROR',
      message: `VTEX credentials missing: ${missing.join(', ')}`,
      orderId,
    });
    return Response.json({ received: true, orderId, warning: 'credentials_missing' });
  }

  // Skip full pipeline if order is already fully processed.
  const current = await getOrderByOrderId(orderId);
  if (current?.startHandlingStatus === 'SUCCESS') {
    return Response.json({ received: true, orderId, skipped: 'already_handled' });
  }

  // Dedup: mark orderId as in-flight before the delay so a second concurrent hook
  // for the same order (VTEX delivers at-least-once) cannot race into processOrder.
  const processingKey = `hook-processing:${orderId}`;
  if (hasProcessedKey(processingKey)) {
    return Response.json({ received: true, orderId, skipped: 'already_processing' });
  }
  markProcessedKey(processingKey);

  const vtexClient = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);
  await new Promise((r) => setTimeout(r, 5000));
  await processOrder(orderId, 'HOOK', { vtexClient, config: cfg });

  return Response.json({ received: true, orderId });
}
