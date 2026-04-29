import { describe, it, expect } from 'vitest';
import { extractOrderId } from '@/lib/hookParser';
import type { VtexHookPayload } from '@/types/vtex';

describe('extractOrderId', () => {
  it('extracts from top-level orderId', () => {
    expect(extractOrderId({ orderId: 'o-1' })).toBe('o-1');
  });

  it('extracts from top-level OrderId (capitalized)', () => {
    expect(extractOrderId({ OrderId: 'o-2' })).toBe('o-2');
  });

  it('extracts from nested order.orderId', () => {
    expect(extractOrderId({ order: { orderId: 'o-3' } })).toBe('o-3');
  });

  it('extracts from nested order.OrderId', () => {
    expect(extractOrderId({ order: { OrderId: 'o-4' } })).toBe('o-4');
  });

  it('extracts from nested data.orderId', () => {
    expect(extractOrderId({ data: { orderId: 'o-5' } })).toBe('o-5');
  });

  it('extracts from nested data.OrderId', () => {
    expect(extractOrderId({ data: { OrderId: 'o-6' } })).toBe('o-6');
  });

  it('prefers top-level orderId over nested values', () => {
    expect(extractOrderId({ orderId: 'top', order: { orderId: 'nested' } })).toBe('top');
  });

  it('returns undefined for null', () => {
    expect(extractOrderId(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(extractOrderId(undefined)).toBeUndefined();
  });

  it('returns undefined for empty object', () => {
    expect(extractOrderId({})).toBeUndefined();
  });

  it('returns undefined when orderId is empty string', () => {
    expect(extractOrderId({ orderId: '' })).toBeUndefined();
  });

  it('returns undefined when orderId is non-string', () => {
    expect(extractOrderId({ orderId: 12345 as unknown as string })).toBeUndefined();
  });

  it('handles realistic VTEX hook envelope shape', () => {
    const realistic = {
      State: 'ready-for-handling',
      OrderId: 'v69305315atmc-01',
      Domain: 'Marketplace',
      LastState: 'payment-approved',
      LastChange: '2020-07-13T20:25:13.2304508Z',
    } as unknown as VtexHookPayload;
    expect(extractOrderId(realistic)).toBe('v69305315atmc-01');
  });
});
