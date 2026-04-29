// src/lib/deduplicator.ts
// Idempotency-key construction and lookup, backed by store.processedKeys.
// PITFALL S5 (research): NEVER deduplicate on orderId alone — VTEX legitimately re-delivers
// events for the same order in different states. Use eventId when present, else
// orderId+state+timestamp composite.

import { hasProcessedKey, markProcessedKey } from '@/lib/store';

export interface DeduplicatorInput {
  eventId?: string | null;
  orderId?: string | null;
  /** From VtexFeedItem.currentState (preferred) or hook payload currentState/state */
  state?: string | null;
  /** From VtexFeedItem.currentChangeDate (preferred) or hook payload timestamp */
  timestamp?: string | null;
}

/**
 * Build an idempotency key for an event.
 * Priority: eventId (if non-empty) → composite of orderId + state + timestamp.
 * Format:
 *   eventId present: "eventId:{value}"
 *   composite:       "composite:{orderId|unknown}:{state|unknown}:{timestamp|unknown}"
 */
export function buildDeduplicationKey(input: DeduplicatorInput): string {
  if (input.eventId && input.eventId.length > 0) {
    return `eventId:${input.eventId}`;
  }
  const orderId = input.orderId ?? 'unknown';
  const state = input.state ?? 'unknown';
  const ts = input.timestamp ?? 'unknown';
  return `composite:${orderId}:${state}:${ts}`;
}

/** True iff the key has previously been marked processed in this process. */
export function isDuplicate(input: DeduplicatorInput): boolean {
  return hasProcessedKey(buildDeduplicationKey(input));
}

/** Record the key as processed. Subsequent isDuplicate() calls return true. */
export function markProcessed(input: DeduplicatorInput): void {
  markProcessedKey(buildDeduplicationKey(input));
}
