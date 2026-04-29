import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildDeduplicationKey,
  isDuplicate,
  markProcessed,
} from '@/lib/deduplicator';
import { __resetStoreForTests } from '@/lib/store';

beforeEach(() => {
  __resetStoreForTests();
});

describe('buildDeduplicationKey', () => {
  it('uses eventId when present and non-empty', () => {
    expect(buildDeduplicationKey({ eventId: 'evt-123' })).toBe('eventId:evt-123');
  });

  it('falls back to composite when eventId is undefined', () => {
    expect(
      buildDeduplicationKey({ orderId: 'o-1', state: 'ready-for-handling', timestamp: '2026-04-28T00:00:00Z' }),
    ).toBe('composite:o-1:ready-for-handling:2026-04-28T00:00:00Z');
  });

  it('falls back to composite when eventId is empty string', () => {
    expect(
      buildDeduplicationKey({ eventId: '', orderId: 'o-1', state: 'x', timestamp: 't' }),
    ).toBe('composite:o-1:x:t');
  });

  it('falls back to composite when eventId is null', () => {
    expect(
      buildDeduplicationKey({ eventId: null, orderId: 'o-1', state: 'x', timestamp: 't' }),
    ).toBe('composite:o-1:x:t');
  });

  it('uses unknown placeholders for missing composite parts', () => {
    expect(buildDeduplicationKey({})).toBe('composite:unknown:unknown:unknown');
  });

  it('different states for the same orderId produce DIFFERENT keys (PITFALL S5)', () => {
    const a = buildDeduplicationKey({ orderId: 'o-1', state: 'payment-approved', timestamp: 't1' });
    const b = buildDeduplicationKey({ orderId: 'o-1', state: 'ready-for-handling', timestamp: 't2' });
    expect(a).not.toBe(b);
  });
});

describe('isDuplicate / markProcessed', () => {
  it('returns false before markProcessed has been called', () => {
    expect(isDuplicate({ eventId: 'evt-1' })).toBe(false);
  });

  it('returns true after markProcessed has been called for the same input', () => {
    markProcessed({ eventId: 'evt-1' });
    expect(isDuplicate({ eventId: 'evt-1' })).toBe(true);
  });

  it('does not mark unrelated events as duplicate', () => {
    markProcessed({ eventId: 'evt-1' });
    expect(isDuplicate({ eventId: 'evt-2' })).toBe(false);
  });

  it('treats composite-key inputs with same orderId+state+timestamp as duplicates', () => {
    markProcessed({ orderId: 'o-1', state: 's', timestamp: 't' });
    expect(isDuplicate({ orderId: 'o-1', state: 's', timestamp: 't' })).toBe(true);
  });

  it('treats composite-key inputs with same orderId but different state as non-duplicate', () => {
    markProcessed({ orderId: 'o-1', state: 'payment-approved', timestamp: 't1' });
    expect(isDuplicate({ orderId: 'o-1', state: 'ready-for-handling', timestamp: 't2' })).toBe(false);
  });

  it('store reset clears all processed keys', () => {
    markProcessed({ eventId: 'evt-1' });
    __resetStoreForTests();
    expect(isDuplicate({ eventId: 'evt-1' })).toBe(false);
  });
});
