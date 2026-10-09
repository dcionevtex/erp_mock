// Business logic for the Tax Service protocol's calculation endpoint.
// Account-scoped — account is always the first argument.
//
// Calculation rule ported from the reference implementation (external-taxes-engine):
// each active tax rule is computed independently against the item's own itemPrice
// (taxes are not compounded), rounded to 2 decimals with an epsilon guard against
// floating-point artifacts, and omitted from the response when the value is <= 0.

import { getTaxConfig, appendTaxCallLog } from '@/lib/taxStore';
import type {
  TaxCalculationRequest,
  TaxCalculationResponseItem,
  TaxLineItemTax,
  TaxRule,
} from '@/types/tax';

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTaxes(
  items: TaxCalculationRequest['items'],
  rules: Pick<TaxRule, 'name' | 'description' | 'percentage' | 'active'>[],
): TaxCalculationResponseItem[] {
  const activeRules = rules.filter(r => r.active);
  return items.map(item => {
    const itemPrice = toNumber(item.itemPrice);
    const taxes: TaxLineItemTax[] = activeRules
      .map(rule => ({
        name: rule.name,
        description: rule.description,
        value: round2(itemPrice * (rule.percentage / 100)),
      }))
      .filter(t => t.value > 0);
    return { id: item.id, taxes };
  });
}

// VTEX echoes back whatever string was configured as taxConfiguration.authorizationHeader,
// verbatim, in the Authorization header of every call. Empty/unset means validation is
// disabled (demo-permissive default, same convention as isHookSecretValid in config.ts).
export function isAuthorized(providedHeader: string | null, expected: string): boolean {
  if (!expected) return true;
  return providedHeader === expected;
}

export async function handleCalculateTax(
  account: string,
  body: TaxCalculationRequest,
  authHeader: string | null,
  pathname: string,
  start: number,
  serviceUrl: string,
): Promise<{ body: unknown; status: number }> {
  const config = await getTaxConfig(account);
  const now = new Date().toISOString();
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!isAuthorized(authHeader, config.authorizationHeader)) {
    const responseBody = { error: 'Unauthorized' };
    appendTaxCallLog(account, {
      timestamp: now, method: 'POST', path: pathname,
      requestBody: body, responseBody, httpStatus: 401, durationMs: Date.now() - start,
    });
    return { body: responseBody, status: 401 };
  }

  if (config.scenario === 'error') {
    const responseBody = { error: 'Internal Server Error' };
    appendTaxCallLog(account, {
      timestamp: now, method: 'POST', path: pathname,
      requestBody: body, responseBody, httpStatus: 500, durationMs: Date.now() - start,
    });
    return { body: responseBody, status: 500 };
  }

  // Per the Tax Service recipe, a successful calculation response can carry a `hooks`
  // object pointing to the "commit" route VTEX calls back when the order status changes
  // (e.g. once invoiced), so the provider can finalize taxes against its real engine.
  // The public docs never publish this object's exact JSON shape — only prose mentions
  // it, with no field table or example like the rest of the protocol gets. This is a
  // best-effort placement (attached per item, since the documented response is a bare
  // array with no top-level slot for it) — extra unknown fields are harmless to
  // Checkout's parsing of the required { id, taxes } shape either way.
  const hooks = { commit: { url: `${serviceUrl}/commit-tax` } };

  const responseBody: TaxCalculationResponseItem[] =
    config.scenario === 'no-tax'
      ? items.map(item => ({ id: item.id, taxes: [], hooks }))
      : calculateTaxes(items, config.rules).map(entry => ({ ...entry, hooks }));

  appendTaxCallLog(account, {
    timestamp: now, method: 'POST', path: pathname,
    requestBody: body, responseBody, httpStatus: 200, durationMs: Date.now() - start,
  });

  return { body: responseBody, status: 200 };
}

// POST target of the `hooks.commit.url` above — called by VTEX when the order's status
// changes (e.g. once invoiced) to confirm the previously-calculated taxes should be
// finalized. This is the place where a real integration would commit those taxes
// against the actual tax engine — e.g. mark the quote final, post the transaction to
// the provider's ledger, or trigger whatever "confirm this calculation" call the real
// tax engine's API expects. The simulator has no real engine to commit against, so it
// just acknowledges the call.
export function handleCommitTax(
  account: string,
  body: unknown,
  pathname: string,
  start: number,
): { body: unknown; status: number } {
  const now = new Date().toISOString();
  const responseBody = {};

  appendTaxCallLog(account, {
    timestamp: now, method: 'POST', path: pathname,
    requestBody: body, responseBody, httpStatus: 200, durationMs: Date.now() - start,
  });

  return { body: responseBody, status: 200 };
}
