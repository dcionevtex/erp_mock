import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createVtexClient,
  VtexApiError,
  type VtexClientConfig,
} from '@/lib/vtexClient';

const TEST_CONFIG: VtexClientConfig = {
  account: 'demoacct',
  environment: 'vtexcommercestable.com.br',
  appKey: 'test-key',
  appToken: 'SECRET-TOKEN-MUST-NEVER-LEAK',
};

function makeResponse(opts: {
  status?: number;
  ok?: boolean;
  statusText?: string;
  body?: unknown;
}): Response {
  const status = opts.status ?? 200;
  const ok = opts.ok ?? (status >= 200 && status < 300);
  return {
    status,
    statusText: opts.statusText ?? '',
    ok,
    json: async () => opts.body,
    text: async () =>
      typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body ?? ''),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. getOrder
// ---------------------------------------------------------------------------

describe('createVtexClient.getOrder', () => {
  it('calls fetch with the correct URL for an orderId', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ body: { orderId: 'o-123' } }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.getOrder('o-123');
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://demoacct.vtexcommercestable.com.br/api/oms/pvt/orders/o-123',
    );
  });

  it('sends X-VTEX-API-AppKey and X-VTEX-API-AppToken headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ body: {} }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.getOrder('o-123');
    const init = fetcher.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-VTEX-API-AppKey']).toBe('test-key');
    expect(headers['X-VTEX-API-AppToken']).toBe('SECRET-TOKEN-MUST-NEVER-LEAK');
  });

  it('sends Accept and Content-Type as application/json', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ body: {} }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.getOrder('o-123');
    const init = fetcher.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('returns the parsed VtexOrder body on 200', async () => {
    const order = { orderId: 'o-123', status: 'invoiced' };
    const fetcher = vi.fn().mockResolvedValue(makeResponse({ body: order }));
    const client = createVtexClient(TEST_CONFIG, fetcher);
    const result = await client.getOrder('o-123');
    expect(result).toEqual(order);
  });

  it('throws VtexApiError on 404 with status 404 and no token in message', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 404, ok: false, statusText: 'Not Found', body: null }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await expect(client.getOrder('o-123')).rejects.toThrow(VtexApiError);
    try {
      await client.getOrder('o-123');
    } catch (err) {
      expect(err).toBeInstanceOf(VtexApiError);
      const apiErr = err as VtexApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.message).not.toContain('SECRET-TOKEN-MUST-NEVER-LEAK');
    }
  });

  it('throws VtexApiError on 401 with no token in message', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 401, ok: false, statusText: 'Unauthorized', body: null }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    try {
      await client.getOrder('o-123');
    } catch (err) {
      expect(err).toBeInstanceOf(VtexApiError);
      const apiErr = err as VtexApiError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.message).not.toContain('SECRET-TOKEN-MUST-NEVER-LEAK');
    }
  });

  it('throws VtexApiError on 429 with no token in message', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 429, ok: false, statusText: 'Too Many Requests', body: null }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    try {
      await client.getOrder('o-123');
    } catch (err) {
      expect(err).toBeInstanceOf(VtexApiError);
      const apiErr = err as VtexApiError;
      expect(apiErr.status).toBe(429);
      expect(apiErr.message).not.toContain('SECRET-TOKEN-MUST-NEVER-LEAK');
    }
  });

  it('URL-encodes special characters in orderId', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeResponse({ body: {} }));
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.getOrder('a/b');
    expect(fetcher.mock.calls[0][0]).toContain('a%2Fb');
  });
});

// ---------------------------------------------------------------------------
// 2. startHandling
// ---------------------------------------------------------------------------

describe('createVtexClient.startHandling', () => {
  it('sends POST with empty body {} JSON-stringified', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 204, ok: true }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.startHandling('o-123');
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('{}');
  });

  it('sets Content-Type: application/json even on empty body (PITFALL M6)', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 204, ok: true }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.startHandling('o-123');
    const init = fetcher.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('uses correct path /api/oms/pvt/orders/{id}/start-handling', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 204, ok: true }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.startHandling('o-123');
    expect(fetcher.mock.calls[0][0]).toContain('/api/oms/pvt/orders/o-123/start-handling');
  });

  it('resolves on 204 No Content without parsing JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 204, ok: true }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await expect(client.startHandling('o-123')).resolves.toBeUndefined();
  });

  it('resolves on 200 with body', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 200, ok: true, body: { receipt: 'abc' } }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await expect(client.startHandling('o-123')).resolves.not.toThrow();
  });

  it('throws VtexApiError on 4xx', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 400, ok: false, statusText: 'Bad Request', body: null }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await expect(client.startHandling('o-123')).rejects.toThrow(VtexApiError);
  });
});

// ---------------------------------------------------------------------------
// 3. getFeedItems
// ---------------------------------------------------------------------------

describe('createVtexClient.getFeedItems', () => {
  it('uses /api/orders/feed?maxLot=10 by default', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeResponse({ body: [] }));
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.getFeedItems();
    expect(fetcher.mock.calls[0][0]).toContain('/api/orders/feed?maxLot=10');
  });

  it('honors a custom maxLot parameter', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeResponse({ body: [] }));
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.getFeedItems(5);
    expect(fetcher.mock.calls[0][0]).toContain('maxLot=5');
  });

  it('returns array as-is when response is a raw array', async () => {
    const items = [{ handle: 'h1', orderId: 'o-1' }, { handle: 'h2', orderId: 'o-2' }];
    const fetcher = vi.fn().mockResolvedValue(makeResponse({ body: items }));
    const client = createVtexClient(TEST_CONFIG, fetcher);
    const result = await client.getFeedItems();
    expect(result).toEqual(items);
  });

  it('extracts events array when response is wrapped { events: [...] }', async () => {
    const items = [{ handle: 'h1', orderId: 'o-1' }];
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ body: { events: items } }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    const result = await client.getFeedItems();
    expect(result).toEqual(items);
  });

  it('returns empty array on unexpected shape', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeResponse({ body: {} }));
    const client = createVtexClient(TEST_CONFIG, fetcher);
    const result = await client.getFeedItems();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. commitFeedItems
// ---------------------------------------------------------------------------

describe('createVtexClient.commitFeedItems', () => {
  it('makes NO HTTP call when handles array is empty', async () => {
    const fetcher = vi.fn();
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.commitFeedItems([]);
    expect(fetcher.mock.calls.length).toBe(0);
  });

  it('POSTs { handles } to /api/orders/feed when handles non-empty', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 204, ok: true }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    await client.commitFeedItems(['h1', 'h2']);
    expect(fetcher.mock.calls[0][0]).toContain('/api/orders/feed');
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    const parsed = JSON.parse(init.body as string);
    expect(parsed).toEqual({ handles: ['h1', 'h2'] });
  });
});

// ---------------------------------------------------------------------------
// 5. VtexApiError safety
// ---------------------------------------------------------------------------

describe('VtexApiError safety', () => {
  it('does not include appToken in toString()', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      makeResponse({ status: 401, ok: false, statusText: 'Unauthorized', body: null }),
    );
    const client = createVtexClient(TEST_CONFIG, fetcher);
    try {
      await client.getOrder('o-123');
    } catch (err) {
      expect(String(err)).not.toContain('SECRET-TOKEN-MUST-NEVER-LEAK');
      expect((err as VtexApiError).message).not.toContain('SECRET-TOKEN-MUST-NEVER-LEAK');
    }
  });

  it('exposes status, statusText, body, url as readonly properties', () => {
    const err = new VtexApiError({
      status: 404,
      statusText: 'Not Found',
      body: { error: 'not found' },
      url: 'https://example.com/api/oms/pvt/orders/o-1',
    });
    expect(err.status).toBe(404);
    expect(err.statusText).toBe('Not Found');
    expect(err.body).toEqual({ error: 'not found' });
    expect(err.url).toBe('https://example.com/api/oms/pvt/orders/o-1');
  });
});
