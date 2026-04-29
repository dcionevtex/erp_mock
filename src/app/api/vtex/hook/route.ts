// src/app/api/vtex/hook/route.ts
// POST /api/vtex/hook — receives VTEX order notifications and runs the full processing pipeline.
// SECURITY (SEC-05): Optional demo-level hook secret validation via x-demo-hook-secret header.
// See CLAUDE.MD §10 for full hook endpoint requirements.

export const runtime = 'nodejs';

import { getMissingCredentials, isHookSecretValid, buildServerConfig } from '@/lib/config';
import { upsertOrder, appendEventLog } from '@/lib/store';
import { createVtexClient } from '@/lib/vtexClient';
import { extractOrderId } from '@/lib/hookParser';
import { processOrder } from '@/lib/orderProcessor';
import type { ErpOrderRecord } from '@/types';


export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const cfg = buildServerConfig();
  const secret = request.headers.get('x-demo-hook-secret');
  if (!isHookSecretValid(secret, cfg as Parameters<typeof isHookSecretValid>[1])) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const orderId = extractOrderId(body as Record<string, unknown>);
  if (!orderId) {
    appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'HOOK',
      level: 'WARN',
      message: 'Hook payload received but orderId could not be extracted',
      payload: body,
    });
    return Response.json({ error: 'Cannot extract orderId from payload' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const record: ErpOrderRecord = {
    id: orderId,
    orderId,
    source: 'HOOK',
    erpStatus: 'RECEIVED',
    startHandlingStatus: 'NOT_STARTED',
    receivedAt: now,
    attempts: 0,
    timeline: [{
      timestamp: now,
      step: 'EVENT_RECEIVED',
      status: 'INFO',
      message: `Hook event received for orderId: ${orderId}`,
    }],
  };
  upsertOrder(record);

  appendEventLog({
    timestamp: now,
    source: 'HOOK',
    level: 'INFO',
    message: `Hook received orderId: ${orderId}`,
    orderId,
  });

  const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
  if (missing.length > 0) {
    appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'HOOK',
      level: 'ERROR',
      message: `VTEX credentials missing: ${missing.join(', ')}`,
      orderId,
    });
    return Response.json({ received: true, orderId, warning: 'credentials_missing' });
  }

  const vtexClient = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);
  await processOrder(orderId, 'HOOK', { vtexClient, config: cfg });

  return Response.json({ received: true, orderId });
}
