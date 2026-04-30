'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ConfigPanel } from '@/components/ConfigPanel';
import { OrderRow } from '@/components/OrderRow';
import { Footer } from '@/components/Footer';
import { DASHBOARD_POLL_INTERVAL_MS, ERP_STATUS_VALUES } from '@/lib/constants';
import type { ErpOrderRecord, AppConfigPublic, EventLogEntry } from '@/types';

type Tab = 'inbox' | 'events';
type SortKey = 'receivedAt_desc' | 'receivedAt_asc';

export default function DashboardPage() {
  const [orders, setOrders] = useState<ErpOrderRecord[]>([]);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [config, setConfig] = useState<AppConfigPublic | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [filterSource, setFilterSource] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterAccounts, setFilterAccounts] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('receivedAt_desc');
  const [polling, setPolling] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterSource !== 'ALL') params.set('source', filterSource);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      if (search) params.set('search', search);
      if (sort !== 'receivedAt_desc') params.set('sort', sort);
      const res = await fetch(`/api/erp/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json() as { orders: ErpOrderRecord[] };
        setOrders(data.orders);
        setLastFetch(new Date());
      }
    } catch {
      // polling failure is non-fatal
    }
  }, [filterSource, filterStatus, search, sort]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/erp/events');
      if (res.ok) {
        const data = await res.json() as { events: EventLogEntry[] };
        setEvents(data.events);
      }
    } catch {}
  }, []);

  async function handleClearEvents() {
    if (!confirm('Clear all event log entries? This cannot be undone.')) return;
    await fetch('/api/erp/events', { method: 'DELETE' }).catch(() => {});
    setEvents([]);
  }

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json() as { config: AppConfigPublic };
        setConfig(data.config);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchConfig();
  }, [fetchOrders, fetchConfig]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchOrders();
      if (activeTab === 'events') fetchEvents();
    }, DASHBOARD_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchOrders, fetchEvents, activeTab]);

  useEffect(() => {
    if (activeTab === 'events') fetchEvents();
  }, [activeTab, fetchEvents]);

  async function handlePollFeed() {
    setPolling(true);
    try {
      await fetch('/api/vtex/feed/poll', { method: 'POST' });
      await fetchOrders();
    } finally {
      setPolling(false);
    }
  }

  async function handleAction(action: string, orderId: string) {
    if (action === 'delete') {
      if (!confirm(`Delete order ${orderId} from ERP? This cannot be undone.`)) return;
      await fetch(`/api/erp/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' }).catch(() => {});
      await fetchOrders();
      return;
    }
    if (action === 'refresh') {
      await fetchOrders();
      return;
    }
    const pathMap: Record<string, string> = {
      reprocess: `/api/erp/orders/${encodeURIComponent(orderId)}/reprocess`,
      'retry-start-handling': `/api/erp/orders/${encodeURIComponent(orderId)}/retry-start-handling`,
      resolve: `/api/erp/orders/${encodeURIComponent(orderId)}/resolve`,
      cancel: `/api/erp/orders/${encodeURIComponent(orderId)}/cancel`,
      'send-invoice': `/api/erp/orders/${encodeURIComponent(orderId)}/send-invoice`,
    };
    const path = pathMap[action];
    if (!path) return;
    await fetch(path, { method: 'POST' }).catch(() => {});
    await fetchOrders();
  }

  const uniqueAccounts = useMemo(() => {
    const seen = new Set<string>();
    for (const o of orders) if (o.account) seen.add(o.account);
    return Array.from(seen).sort();
  }, [orders]);

  const visibleOrders = useMemo(() =>
    filterAccounts.length === 0 ? orders : orders.filter((o) => filterAccounts.includes(o.account ?? '')),
    [orders, filterAccounts],
  );

  function toggleAccount(account: string) {
    setFilterAccounts((prev) =>
      prev.includes(account) ? prev.filter((a) => a !== account) : [...prev, account],
    );
  }

  const hookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/vtex/hook`
      : '/api/vtex/hook';

  const credsMissing = config !== null && !config.appTokenConfigured;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — VTEX brand: navy bg, pink accents */}
      <header className="border-b border-border px-4 py-0 flex items-stretch justify-between gap-4" style={{ background: '#142032' }}>
        <div className="flex items-center gap-4 py-3">
          {/* VTEX wordmark */}
          <span className="text-xl font-black tracking-tighter leading-none" style={{ color: '#F71963' }}>VTEX</span>
          <span className="text-white/20 text-lg font-thin">|</span>
          <h1 className="text-sm font-semibold text-white/90">ERP Connect</h1>
          {config && (
            <span className="text-xs text-white/40 hidden sm:inline">
              {config.account || 'no account set'} · {config.integrationMode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastFetch && (
            <span className="text-xs text-white/40 hidden sm:inline">
              updated {lastFetch.toLocaleTimeString()}
            </span>
          )}
          <Link
            href="/about"
            className="px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors rounded border border-white/10 hover:border-white/20"
          >
            Docs
          </Link>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors rounded border border-white/10 hover:border-white/20"
          >
            Sign out
          </button>
          {config?.integrationMode === 'FEED' && (
            <button
              onClick={handlePollFeed}
              disabled={polling}
              className="px-3 py-1.5 text-xs font-semibold rounded-md disabled:opacity-50 transition-colors"
              style={{ background: '#F71963', color: '#fff' }}
            >
              {polling ? 'Polling…' : 'Poll Feed Now'}
            </button>
          )}
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-[1600px] mx-auto">
        {/* Config Panel */}
        <ConfigPanel onSaved={(cfg) => setConfig(cfg)} />

        {/* Hook URL display */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Hook URL:</span>
            <code className="bg-muted px-2 py-0.5 rounded font-mono">{hookUrl}</code>
            <button
              onClick={() => navigator.clipboard.writeText(hookUrl).catch(() => {})}
              className="px-2 py-0.5 text-xs border border-border rounded hover:bg-muted transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Register this URL in VTEX using your App Key (<code className="font-mono">PUT /api/orders/hook/config</code>). Each App Key supports one Hook — if you change the App Key, re-register the Hook in VTEX.
          </p>
        </div>

        {/* Credentials warning (ERR-01) */}
        {credsMissing && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <span>⚠</span>
            <span>
              VTEX credentials are not configured. Open Configuration above and enter your App Key
              and App Token, or set them as environment variables.
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(['inbox', 'events'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={tabCls(activeTab === tab)}
            >
              {tab === 'inbox' ? `ERP Orders (${visibleOrders.length})` : 'Event Log'}
            </button>
          ))}
        </div>

        {/* Inbox */}
        {activeTab === 'inbox' && (
          <div className="space-y-3">
            {/* Filter bar */}
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className={selectCls}
              >
                <option value="ALL">All Sources</option>
                <option value="HOOK">HOOK</option>
                <option value="FEED">FEED</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={selectCls}
              >
                <option value="ALL">All Statuses</option>
                {ERP_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <input
                type="search"
                placeholder="Search orderId, customer, SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-64"
              />

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className={selectCls}
              >
                <option value="receivedAt_desc">Newest first</option>
                <option value="receivedAt_asc">Oldest first</option>
              </select>

              {uniqueAccounts.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">Account:</span>
                  {uniqueAccounts.map((account) => {
                    const checked = filterAccounts.includes(account);
                    return (
                      <label
                        key={account}
                        className={[
                          'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border cursor-pointer transition-colors select-none',
                          checked
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-muted text-foreground',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleAccount(account)}
                        />
                        {account}
                      </label>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => { void fetchOrders(); }}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted transition-colors"
              >
                Refresh
              </button>
            </div>

            {/* Orders table */}
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                <span className="text-3xl">📭</span>
                <p>No orders received yet.</p>
                <p className="text-xs">
                  Send a POST to the Hook URL above, or click &quot;Poll Feed Now&quot; to fetch from VTEX Feed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Account</th>
                      <th className="px-3 py-2 font-medium">Order ID</th>
                      <th className="px-3 py-2 font-medium">Seq</th>
                      <th className="px-3 py-2 font-medium">VTEX Status</th>
                      <th className="px-3 py-2 font-medium">Src</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                      <th className="px-3 py-2 font-medium text-center">Items</th>
                      <th className="px-3 py-2 font-medium">Shipping</th>
                      <th className="px-3 py-2 font-medium">Payment</th>
                      <th className="px-3 py-2 font-medium">SH Status</th>
                      <th className="px-3 py-2 font-medium">Invoice</th>
                      <th className="px-3 py-2 font-medium">Received</th>
                      <th className="px-3 py-2 font-medium text-center">Tries</th>
                      <th className="px-3 py-2 font-medium">Error</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => (
                      <OrderRow key={order.id} order={order} onAction={handleAction} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Event Log */}
        {activeTab === 'events' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">{events.length} entries (newest first)</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { void fetchEvents(); }}
                  className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={() => { void handleClearEvents(); }}
                  className="px-3 py-1.5 text-xs border border-destructive/40 text-destructive rounded hover:bg-destructive/10 transition-colors"
                >
                  Clear Log
                </button>
              </div>
            </div>
            {events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No events yet.</div>
            ) : (
              <div className="rounded-lg border border-border overflow-auto max-h-[600px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left text-muted-foreground uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Source</th>
                      <th className="px-3 py-2 font-medium">Level</th>
                      <th className="px-3 py-2 font-medium">Message</th>
                      <th className="px-3 py-2 font-medium">Order ID</th>
                      <th className="px-3 py-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((evt, i) => (
                      <EventLogRow key={i} evt={evt} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function EventLogRow({ evt }: { evt: EventLogEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className={`border-b border-border/50 last:border-0 transition-colors cursor-pointer hover:bg-muted/40 ${open ? 'bg-muted/30' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
          {new Date(evt.timestamp).toLocaleTimeString()}
        </td>
        <td className="px-3 py-1.5 font-medium">{evt.source}</td>
        <td className="px-3 py-1.5">
          <span className={levelCls(evt.level)}>{evt.level}</span>
        </td>
        <td className="px-3 py-1.5 max-w-[400px] truncate">{evt.message}</td>
        <td className="px-3 py-1.5 font-mono text-muted-foreground">{evt.orderId ?? '—'}</td>
        <td className="px-3 py-1.5 text-center">
          <svg
            className={`w-3 h-3 text-muted-foreground transition-transform duration-150 inline-block ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M3 5l4 4 4-4" />
          </svg>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border/50 bg-muted/10">
          <td colSpan={6} className="px-4 py-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payload</p>
            {evt.payload != null ? (
              <pre className="text-[11px] leading-relaxed bg-muted/60 rounded-md p-3 overflow-auto max-h-72 font-mono">
                {JSON.stringify(evt.payload, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">No payload recorded for this event.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function tabCls(active: boolean) {
  return [
    'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
    active
      ? 'border-primary text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  ].join(' ');
}

function levelCls(level: string) {
  const base = 'px-1.5 py-0.5 rounded text-[10px] font-medium';
  if (level === 'ERROR') return `${base} bg-red-100 text-red-700`;
  if (level === 'WARN') return `${base} bg-yellow-100 text-yellow-700`;
  return `${base} bg-blue-100 text-blue-700`;
}

const selectCls =
  'rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring';
