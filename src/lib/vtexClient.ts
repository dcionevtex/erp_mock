// src/lib/vtexClient.ts
// VTEX HTTP client. Pure dependency injection — accepts config + optional fetcher.
// SECURITY: appToken is in headers only. Never logged. Never in error messages.

import type { VtexOrder, VtexFeedItem, VtexApiErrorShape } from '@/types/vtex';
import {
  buildVtexBaseUrl,
  VTEX_API_PATHS,
  VTEX_REQUIRED_HEADERS,
} from '@/lib/constants';

/**
 * Typed error thrown on non-2xx responses.
 * Message format: "VTEX API error {status} on {url}" — never includes credentials.
 */
export class VtexApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly url: string;

  constructor(shape: VtexApiErrorShape) {
    super(`VTEX API error ${shape.status} on ${shape.url}`);
    this.name = 'VtexApiError';
    this.status = shape.status;
    this.statusText = shape.statusText ?? '';
    this.body = shape.body;
    this.url = shape.url;
  }
}

export interface VtexClientConfig {
  account: string;
  environment: string;
  appKey: string;
  appToken: string;
}

/** Function-shape compatible with global fetch — the only HTTP surface this module needs. */
export type VtexFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface VtexInvoicePayload {
  type: 'Output' | 'Input';
  invoiceNumber: string;
  invoiceValue: number;
  issuanceDate: string;
  invoiceKey?: string;
  invoiceUrl?: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  items: Array<{ id: string; price: number; quantity: number }>;
}

export interface VtexInvoiceTrackingUpdate {
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

/** Generate a safe invoice number from a VTEX orderId. Strips '/' to avoid VTEX routing bug. */
export function buildInvoiceNumber(orderId: string): string {
  return `NF-${orderId.replace(/\//g, '-')}-${Date.now()}`;
}

export interface VtexClient {
  getOrder(orderId: string): Promise<VtexOrder>;
  getFeedItems(maxLot?: number): Promise<VtexFeedItem[]>;
  commitFeedItems(handles: string[]): Promise<void>;
  startHandling(orderId: string): Promise<void>;
  cancelOrder(orderId: string): Promise<void>;
  sendInvoice(orderId: string, payload: VtexInvoicePayload): Promise<void>;
  updateInvoiceTracking(orderId: string, invoiceNumber: string, tracking: VtexInvoiceTrackingUpdate): Promise<void>;
  getHookConfig(): Promise<unknown>;
  saveHookConfig(payload: unknown): Promise<unknown>;
  getFeedConfig(): Promise<unknown>;
  saveFeedConfig(payload: unknown): Promise<unknown>;
}

/**
 * Create a VtexClient bound to a config and optional fetcher.
 * Tests pass a vi.fn() as the fetcher to assert URL/headers/body without network.
 */
export function createVtexClient(
  config: VtexClientConfig,
  fetcher: VtexFetcher = globalThis.fetch.bind(globalThis),
): VtexClient {
  const baseUrl = buildVtexBaseUrl(config.account, config.environment);

  function buildHeaders(): Record<string, string> {
    return {
      [VTEX_REQUIRED_HEADERS.appKeyHeader]: config.appKey,
      [VTEX_REQUIRED_HEADERS.appTokenHeader]: config.appToken,
      Accept: VTEX_REQUIRED_HEADERS.accept,
      'Content-Type': VTEX_REQUIRED_HEADERS.contentType,
    };
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const res = await fetcher(url, {
      method,
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        try {
          errorBody = await res.text();
        } catch {
          errorBody = null;
        }
      }
      throw new VtexApiError({
        status: res.status,
        statusText: res.statusText,
        body: errorBody,
        url,
      });
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    async getOrder(orderId) {
      return request<VtexOrder>('GET', VTEX_API_PATHS.getOrder(orderId));
    },
    async getFeedItems(maxLot = 10) {
      const path = `${VTEX_API_PATHS.feedItems()}?maxLot=${maxLot}`;
      const data = await request<unknown>('GET', path);
      // Defensive: VTEX may return a raw array or { events: [...] } wrapper
      if (Array.isArray(data)) return data as VtexFeedItem[];
      if (data && typeof data === 'object' && Array.isArray((data as { events?: unknown }).events)) {
        return ((data as { events: unknown[] }).events) as VtexFeedItem[];
      }
      return [];
    },
    async commitFeedItems(handles) {
      if (handles.length === 0) return; // Skip empty commit (PITFALL: VTEX may 400 on empty body)
      await request<void>('POST', VTEX_API_PATHS.feedCommit(), { handles });
    },
    async startHandling(orderId) {
      // Empty body {} required — Content-Type: application/json must still be set (PITFALL M6)
      await request<void>('POST', VTEX_API_PATHS.startHandling(orderId), {});
    },
    async cancelOrder(orderId) {
      await request<void>('POST', VTEX_API_PATHS.cancelOrder(orderId), {});
    },
    async sendInvoice(orderId, payload) {
      await request<void>('POST', VTEX_API_PATHS.sendInvoice(orderId), payload);
    },
    async updateInvoiceTracking(orderId, invoiceNumber, tracking) {
      await request<void>('PATCH', VTEX_API_PATHS.updateInvoiceTracking(orderId, invoiceNumber), tracking);
    },
    async getHookConfig() {
      return request<unknown>('GET', VTEX_API_PATHS.hookConfig());
    },
    async saveHookConfig(payload) {
      return request<unknown>('POST', VTEX_API_PATHS.hookConfig(), payload);
    },
    async getFeedConfig() {
      return request<unknown>('GET', VTEX_API_PATHS.feedConfig());
    },
    async saveFeedConfig(payload) {
      return request<unknown>('POST', VTEX_API_PATHS.feedConfig(), payload);
    },
  };
}
