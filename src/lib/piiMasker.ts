// src/lib/piiMasker.ts
// Pure PII masking utilities applied server-side at ingestion time (SEC-03).
// Never display-time masking — raw payloads stored on records must already be sanitized.

/**
 * "diego.cione@vtex.com" -> "d***@vtex.com"
 * Empty/null/undefined -> ""
 * Missing "@" or "@" at index 0 -> "***"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return '***';
  return `${email[0]}***${email.slice(atIdx)}`;
}

/**
 * "123.456.789-09" -> "***-09"
 * "12.345.678/0001-90" -> "***-90"
 * Strips all non-digits before extracting the last 2 digits.
 * Empty/null/undefined -> ""
 * Less than 4 digits after cleaning -> "***"
 */
export function maskDocument(doc: string | null | undefined): string {
  if (!doc) return '';
  const cleaned = doc.replace(/\D/g, '');
  if (cleaned.length < 4) return '***';
  return `***-${cleaned.slice(-2)}`;
}

/**
 * Always returns the literal string "(**) *****-****" for any non-empty input.
 * Empty/null/undefined -> "".
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return '(**) *****-****';
}

/**
 * Mask a VtexShippingAddress-like object IN PLACE on a clone (caller must clone first).
 * Mutates: street -> first 4 chars + "***"; receiverName -> first word + " ***".
 * Other fields (postalCode, city, state, country, neighborhood, complement) untouched.
 * Pure with respect to the original argument when used via maskOrderPayload (which clones).
 */
export function maskAddress(address: Record<string, unknown> | null | undefined): void {
  if (!address || typeof address !== 'object') return;
  if (typeof address['street'] === 'string') {
    address['street'] = `${(address['street'] as string).slice(0, 4)}***`;
  }
  if (typeof address['receiverName'] === 'string') {
    const first = (address['receiverName'] as string).split(' ')[0] ?? '';
    address['receiverName'] = `${first} ***`;
  }
}

/**
 * Deep-clone the payload (structuredClone) and mask PII fields:
 *   clientProfileData.email     -> maskEmail
 *   clientProfileData.document  -> maskDocument
 *   clientProfileData.phone     -> maskPhone
 *   shippingData.address.street -> first 4 chars + "***"
 *   shippingData.address.receiverName -> first word + " ***"
 * The original `payload` is NEVER mutated. Returns the masked clone.
 * Non-object inputs (null, undefined, primitives) are returned unchanged.
 */
export function maskOrderPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = structuredClone(payload) as Record<string, unknown>;

  const profile = clone['clientProfileData'];
  if (profile && typeof profile === 'object') {
    const p = profile as Record<string, unknown>;
    if (typeof p['email'] === 'string') p['email'] = maskEmail(p['email']);
    if (typeof p['document'] === 'string') p['document'] = maskDocument(p['document']);
    if (typeof p['phone'] === 'string') p['phone'] = maskPhone(p['phone']);
  }

  const shipping = clone['shippingData'];
  if (shipping && typeof shipping === 'object') {
    const addr = (shipping as Record<string, unknown>)['address'];
    if (addr && typeof addr === 'object') {
      maskAddress(addr as Record<string, unknown>);
    }
  }

  return clone;
}
