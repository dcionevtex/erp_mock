import { describe, it, expect } from 'vitest';
import { calculateTaxes, isAuthorized, handleCalculateTax, handleCommitTax } from '@/lib/taxHandlers';
import { getTaxConfig } from '@/lib/taxStore';
import type { TaxItem, TaxRule } from '@/types/tax';

function rule(overrides: Partial<TaxRule> = {}): Pick<TaxRule, 'name' | 'description' | 'percentage' | 'active'> {
  return {
    name: 'ICMS',
    description: 'State VAT',
    percentage: 18,
    active: true,
    ...overrides,
  };
}

function item(overrides: Partial<TaxItem> = {}): TaxItem {
  return { id: '0', itemPrice: 100, quantity: 1, ...overrides };
}

describe('calculateTaxes', () => {
  it('applies each active rule independently against itemPrice, rounded to 2 decimals', () => {
    const result = calculateTaxes([item({ itemPrice: 100 })], [rule({ percentage: 18 }), rule({ name: 'PIS/COFINS', percentage: 9.25 })]);
    expect(result).toEqual([
      { id: '0', taxes: [
        { name: 'ICMS', description: 'State VAT', value: 18 },
        { name: 'PIS/COFINS', description: 'State VAT', value: 9.25 },
      ] },
    ]);
  });

  it('coerces a string itemPrice to a number', () => {
    const result = calculateTaxes([item({ itemPrice: '50' })], [rule({ percentage: 10 })]);
    expect(result[0].taxes).toEqual([{ name: 'ICMS', description: 'State VAT', value: 5 }]);
  });

  it('excludes inactive rules', () => {
    const result = calculateTaxes([item()], [rule({ active: false })]);
    expect(result[0].taxes).toEqual([]);
  });

  it('omits zero-value taxes rather than returning a 0', () => {
    const result = calculateTaxes([item({ itemPrice: 0 })], [rule({ percentage: 18 })]);
    expect(result[0].taxes).toEqual([]);
  });

  it('preserves item id and order across multiple items', () => {
    const result = calculateTaxes(
      [item({ id: 'a', itemPrice: 10 }), item({ id: 'b', itemPrice: 20 })],
      [rule({ percentage: 10 })],
    );
    expect(result.map(r => r.id)).toEqual(['a', 'b']);
    expect(result[0].taxes[0].value).toBe(1);
    expect(result[1].taxes[0].value).toBe(2);
  });

  it('avoids floating-point rounding artifacts', () => {
    const result = calculateTaxes([item({ itemPrice: 8.2 })], [rule({ percentage: 9.25 })]);
    expect(result[0].taxes[0].value).toBe(0.76);
  });
});

describe('isAuthorized', () => {
  it('allows any header when no secret is configured', () => {
    expect(isAuthorized(null, '')).toBe(true);
  });

  it('requires an exact match when a secret is configured', () => {
    expect(isAuthorized('secret-123', 'secret-123')).toBe(true);
    expect(isAuthorized('wrong', 'secret-123')).toBe(false);
    expect(isAuthorized(null, 'secret-123')).toBe(false);
  });
});

describe('handleCalculateTax', () => {
  it('returns 401 when the Authorization header does not match', async () => {
    const result = await handleCalculateTax(
      'demoaccount-401-test', { items: [item()] }, 'wrong-secret',
      '/api/tax/demoaccount/calculate-tax', Date.now(), 'http://localhost:3000/api/tax/demoaccount-401-test',
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: 'Unauthorized' });
  });

  it('attaches a hooks.commit.url pointing at commit-tax on every item', async () => {
    const { authorizationHeader } = await getTaxConfig('demoaccount-hooks-test');
    const result = await handleCalculateTax(
      'demoaccount-hooks-test', { items: [item({ id: 'a' }), item({ id: 'b' })] }, authorizationHeader,
      '/api/tax/demoaccount/calculate-tax', Date.now(), 'http://localhost:3000/api/tax/demoaccount-hooks-test',
    );
    expect(result.status).toBe(200);
    const body = result.body as Array<{ hooks?: { commit?: { url: string } } }>;
    expect(body).toHaveLength(2);
    for (const entry of body) {
      expect(entry.hooks?.commit?.url).toBe('http://localhost:3000/api/tax/demoaccount-hooks-test/commit-tax');
    }
  });
});

describe('handleCommitTax', () => {
  it('always acknowledges with 200', () => {
    const result = handleCommitTax('demoaccount-commit-test', { orderId: 'o1' }, '/api/tax/demoaccount/commit-tax', Date.now());
    expect(result.status).toBe(200);
    expect(result.body).toEqual({});
  });
});
