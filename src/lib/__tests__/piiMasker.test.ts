import { describe, it, expect } from 'vitest';
import {
  maskEmail,
  maskDocument,
  maskPhone,
  maskOrderPayload,
} from '@/lib/piiMasker';

describe('maskEmail', () => {
  it('masks diego.cione@vtex.com to d***@vtex.com', () => {
    expect(maskEmail('diego.cione@vtex.com')).toBe('d***@vtex.com');
  });

  it('returns empty string for null', () => {
    expect(maskEmail(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(maskEmail(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(maskEmail('')).toBe('');
  });

  it('returns *** when @ is at index 0', () => {
    expect(maskEmail('@vtex.com')).toBe('***');
  });

  it('returns *** when no @ is present', () => {
    expect(maskEmail('noatsign')).toBe('***');
  });
});

describe('maskDocument', () => {
  it('masks CPF 123.456.789-09 to ***-09', () => {
    expect(maskDocument('123.456.789-09')).toBe('***-09');
  });

  it('masks CNPJ 12.345.678/0001-90 to ***-90', () => {
    expect(maskDocument('12.345.678/0001-90')).toBe('***-90');
  });

  it('strips non-digits and uses last 2 digits', () => {
    expect(maskDocument('987')).toBe('***');
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(maskDocument(null)).toBe('');
    expect(maskDocument(undefined)).toBe('');
    expect(maskDocument('')).toBe('');
  });

  it('returns *** for fewer than 4 digits', () => {
    expect(maskDocument('12')).toBe('***');
  });
});

describe('maskPhone', () => {
  it('returns the literal placeholder for any non-empty phone', () => {
    expect(maskPhone('+55 11 91234-5678')).toBe('(**) *****-****');
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(maskPhone(null)).toBe('');
    expect(maskPhone(undefined)).toBe('');
    expect(maskPhone('')).toBe('');
  });
});

describe('maskOrderPayload', () => {
  it('masks email and document inside clientProfileData', () => {
    const original = {
      clientProfileData: {
        email: 'diego.cione@vtex.com',
        document: '123.456.789-09',
      },
    };
    const snapshot = JSON.stringify(original);
    const masked = maskOrderPayload(original) as typeof original;
    expect(masked.clientProfileData.email).toBe('d***@vtex.com');
    expect(masked.clientProfileData.document).toBe('***-09');
    // original unchanged
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('masks phone inside clientProfileData to placeholder', () => {
    const original = {
      clientProfileData: { phone: '+55 11 91234-5678' },
    };
    const masked = maskOrderPayload(original) as typeof original;
    expect(masked.clientProfileData.phone).toBe('(**) *****-****');
  });

  it('masks shippingData.address.street to first 4 chars + ***', () => {
    const original = {
      shippingData: { address: { street: 'Avenida Paulista 1000' } },
    };
    const masked = maskOrderPayload(original) as typeof original;
    expect(masked.shippingData.address.street).toBe('Aven***');
  });

  it('masks shippingData.address.receiverName to first word + ***', () => {
    const original = {
      shippingData: { address: { receiverName: 'Diego Cione' } },
    };
    const masked = maskOrderPayload(original) as typeof original;
    expect(masked.shippingData.address.receiverName).toBe('Diego ***');
  });

  it('does NOT mutate the original payload', () => {
    const original = {
      clientProfileData: {
        email: 'test@example.com',
        document: '123.456.789-09',
        phone: '+55 11 99999-9999',
      },
      shippingData: {
        address: {
          street: 'Rua Teste 123',
          receiverName: 'João Silva',
        },
      },
    };
    const snapshot = JSON.stringify(original);
    maskOrderPayload(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('returns null/undefined/primitives unchanged', () => {
    expect(maskOrderPayload(null)).toBeNull();
    expect(maskOrderPayload(undefined)).toBeUndefined();
    expect(maskOrderPayload('string')).toBe('string');
    expect(maskOrderPayload(42)).toBe(42);
  });

  it('leaves non-PII fields unchanged', () => {
    const original = {
      orderId: 'order-123',
      items: [{ name: 'Product A', quantity: 2 }],
      totals: [{ id: 'Items', value: 1000 }],
      clientProfileData: { email: 'test@test.com' },
    };
    const masked = maskOrderPayload(original) as typeof original;
    expect(masked.orderId).toBe('order-123');
    expect(masked.items).toEqual([{ name: 'Product A', quantity: 2 }]);
    expect(masked.totals).toEqual([{ id: 'Items', value: 1000 }]);
  });
});
