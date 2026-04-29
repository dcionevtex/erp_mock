// src/lib/hookParser.ts
// Hook payload parsing — VTEX delivers orderId at multiple paths (PITFALL C6).
// Pure function, exhaustive over the known shapes documented in VtexHookPayload.

import type { VtexHookPayload } from '@/types/vtex';

/**
 * Extract orderId from a VTEX hook payload.
 * Tries (in order):
 *   payload.orderId
 *   payload.OrderId        (case variation observed in some VTEX events)
 *   payload.order?.orderId
 *   payload.order?.OrderId
 *   payload.data?.orderId
 *   payload.data?.OrderId
 * Returns undefined if none are non-empty strings.
 */
export function extractOrderId(payload: VtexHookPayload | null | undefined): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;

  const candidates: Array<unknown> = [
    payload.orderId,
    payload.OrderId,
    payload.order?.orderId,
    payload.order?.OrderId,
    payload.data?.orderId,
    payload.data?.OrderId,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return undefined;
}
