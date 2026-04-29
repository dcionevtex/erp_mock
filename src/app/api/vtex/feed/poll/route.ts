// src/app/api/vtex/feed/poll/route.ts
// POST /api/vtex/feed/poll — retrieves pending VTEX Feed items and runs the processing pipeline for each.
// Module-level lock prevents concurrent poll invocations (PITFALL M3).
// Feed items are processed sequentially with for...of (never Promise.all) to preserve VTEX rate limits.
// See CLAUDE.MD §11 for full feed consumer requirements.

export const runtime = 'nodejs';

// Module-level lock: prevents concurrent poll invocations on the same server instance.
// Reset happens in the finally block so a crash or error never leaves the lock permanently held.
let pollInProgress = false;

import { getMissingCredentials, buildServerConfig } from '@/lib/config';
import { upsertOrder, getOrderByOrderId, appendEventLog } from '@/lib/store';
import { createVtexClient } from '@/lib/vtexClient';
import { processOrder } from '@/lib/orderProcessor';
import { isDuplicate, markProcessed } from '@/lib/deduplicator';
import { FEED_POLL_MAX_EVENTS } from '@/lib/constants';
import type { ErpOrderRecord } from '@/types';


export async function POST(_request: Request): Promise<Response> {
  if (pollInProgress) {
    return Response.json(
      { error: 'Feed poll already in progress', code: 'POLL_LOCKED' },
      { status: 409 },
    );
  }
  pollInProgress = true;
  try {
    return await runPoll();
  } finally {
    pollInProgress = false;
  }
}

async function runPoll(): Promise<Response> {
  const cfg = await buildServerConfig();
  const missing = getMissingCredentials(cfg as Parameters<typeof getMissingCredentials>[0]);
  if (missing.length > 0) {
    return Response.json({ error: 'VTEX credentials not configured', missing }, { status: 401 });
  }

  const vtexClient = createVtexClient(cfg as Parameters<typeof createVtexClient>[0]);
  let items;
  try {
    items = await vtexClient.getFeedItems(FEED_POLL_MAX_EVENTS);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await appendEventLog({
      timestamp: new Date().toISOString(),
      source: 'FEED',
      level: 'ERROR',
      message: `getFeedItems failed: ${message}`,
    });
    return Response.json({ error: 'Failed to retrieve feed items', message }, { status: 502 });
  }

  if (items.length === 0) {
    return Response.json({ processed: 0, duplicates: 0, errors: 0, total: 0 });
  }

  let processed = 0;
  let duplicates = 0;
  let errors = 0;

  for (const item of items.slice(0, FEED_POLL_MAX_EVENTS)) {
    const orderId = item.orderId;
    if (!orderId) continue;

    const dedupInput = {
      eventId: item.eventId ?? item.id,
      orderId,
      state: item.currentState ?? item.state,
      timestamp: item.currentChangeDate ?? item.date,
    };

    if (isDuplicate(dedupInput)) {
      duplicates++;
      // Only create a store record if the order has never been seen before.
      // This ensures duplicates that arrive after the primary event are ignored silently.
      if (!await getOrderByOrderId(orderId)) {
        const now = new Date().toISOString();
        const dupRecord: ErpOrderRecord = {
          id: `dup-${orderId}-${Date.now()}`,
          orderId,
          account: cfg.account || undefined,
          source: 'FEED',
          erpStatus: 'DUPLICATE_IGNORED',
          startHandlingStatus: 'NOT_STARTED',
          receivedAt: now,
          attempts: 0,
          timeline: [{
            timestamp: now,
            step: 'DUPLICATE_IGNORED',
            status: 'INFO',
            message: `Duplicate feed event ignored for orderId: ${orderId}`,
          }],
        };
        await upsertOrder(dupRecord);
      }
      await appendEventLog({
        timestamp: new Date().toISOString(),
        source: 'FEED',
        level: 'INFO',
        message: `Duplicate feed event ignored: orderId=${orderId}`,
        orderId,
      });
      continue;
    }

    markProcessed(dedupInput);

    const itemNow = new Date().toISOString();
    const record: ErpOrderRecord = {
      id: orderId,
      orderId,
      account: cfg.account || undefined,
      source: 'FEED',
      erpStatus: 'RECEIVED',
      startHandlingStatus: 'NOT_STARTED',
      receivedAt: itemNow,
      attempts: 0,
      timeline: [{
        timestamp: itemNow,
        step: 'EVENT_RECEIVED',
        status: 'INFO',
        message: `Feed event received for orderId: ${orderId}`,
      }],
    };
    await upsertOrder(record);

    try {
      await processOrder(orderId, 'FEED', { vtexClient, config: cfg });

      // Auto-commit the feed handle if configured and the order did not error out (CLAUDE.MD §11).
      const finalRecord = await getOrderByOrderId(orderId);
      if (cfg.autoCommitFeed && item.handle && finalRecord && finalRecord.erpStatus !== 'ERROR') {
        try {
          await vtexClient.commitFeedItems([item.handle]);
        } catch {
          await appendEventLog({
            timestamp: new Date().toISOString(),
            source: 'FEED',
            level: 'WARN',
            message: `Failed to commit feed handle for orderId: ${orderId}`,
            orderId,
          });
        }
      }
      processed++;
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      await appendEventLog({
        timestamp: new Date().toISOString(),
        source: 'FEED',
        level: 'ERROR',
        message: `processOrder failed for orderId=${orderId}: ${message}`,
        orderId,
      });
    }
  }

  return Response.json({ processed, duplicates, errors, total: items.length });
}
