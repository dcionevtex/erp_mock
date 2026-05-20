'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { OrderRow } from '@/components/OrderRow';
import { Footer } from '@/components/Footer';
import { InlineSetup } from '@/components/InlineSetup';
import { AppShell } from '@/components/AppShell';
import { DASHBOARD_POLL_INTERVAL_MS, ERP_STATUS_VALUES } from '@/lib/constants';
import type { ErpOrderRecord, AppConfigPublic, EventLogEntry } from '@/types';

type Tab = 'inbox' | 'events';
type SortKey = 'receivedAt_desc' | 'receivedAt_asc';
const PAGE_SIZE = 50;

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
  const [orderPage, setOrderPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  async function handleBulkAction(action: 'delete' | 'resolve') {
    const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
    if (selectedOrders.length === 0) return;

    if (action === 'delete') {
      if (!confirm(`Delete ${selectedOrders.length} selected order(s)? This cannot be undone.`)) return;
    }

    const orderIds = selectedOrders.map((o) => o.orderId);
    await fetch('/api/erp/orders/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, orderIds }),
    }).catch(() => {});

    setSelectedIds(new Set());
    await fetchOrders();
  }

  function toggleSelectId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectPage() {
    const pageIds = pagedOrders.map((o) => o.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
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

  // Reset to page 1 and clear selection whenever the filtered set changes
  useEffect(() => { setOrderPage(1); setSelectedIds(new Set()); }, [visibleOrders]);
  useEffect(() => { setEventPage(1); }, [events]);

  const orderTotalPages = Math.max(1, Math.ceil(visibleOrders.length / PAGE_SIZE));
  const pagedOrders = visibleOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);

  const eventTotalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pagedEvents = events.slice((eventPage - 1) * PAGE_SIZE, eventPage * PAGE_SIZE);

  function toggleAccount(account: string) {
    setFilterAccounts((prev) =>
      prev.includes(account) ? prev.filter((a) => a !== account) : [...prev, account],
    );
  }

  const hookAccountSuffix = config?.account ? `?account=${encodeURIComponent(config.account)}` : '';
  const hookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/vtex/hook${hookAccountSuffix}`
      : `/api/vtex/hook${hookAccountSuffix}`;

  const credsMissing = config !== null && !config.appTokenConfigured;

  return (
    <AppShell>
    <div className="bg-background min-h-full">
      {/* Header — VTEX brand: navy bg, pink accents */}
      <header className="border-b border-border px-4 py-0 flex items-stretch justify-between gap-4 sticky top-0 z-10" style={{ background: '#142032' }}>
        <div className="flex items-center gap-4 py-3">
          {/* VTEX wordmark */}
          <span className="text-xl font-black tracking-tighter leading-none" style={{ color: '#F71963' }}>VTEX</span>
          <span className="text-white/20 text-lg font-thin">|</span>
          <h1 className="text-sm font-semibold text-white/90">A Simple ERP Simulator</h1>
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

      <main className="px-4 py-4 space-y-4 w-full max-w-[1600px] mx-auto">
        {/* Credentials warning — shown at the very top when creds are missing */}
        {credsMissing && (
          <div
            className="flex items-start gap-3 rounded-xl px-5 py-4"
            style={{ background: 'rgba(247,25,99,0.08)', border: '2px solid #F71963' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
              <path d="M10 2L18 17H2L10 2z" fill="rgba(247,25,99,0.15)" stroke="#F71963" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M10 8v4" stroke="#F71963" strokeWidth="2" strokeLinecap="round" />
              <circle cx="10" cy="14.5" r="1" fill="#F71963" />
            </svg>
            <div>
              <p className="text-sm font-bold" style={{ color: '#F71963' }}>
                VTEX credentials are not configured.
              </p>
              <p className="text-sm mt-0.5" style={{ color: '#c0134f' }}>
                Open <strong>Configuration</strong> below and enter your App Key and App Token, or set them as environment variables.
              </p>
            </div>
          </div>
        )}

        {/* Inline Setup — Account + Hook/Feed config */}
        <InlineSetup config={config} onSaved={(cfg) => setConfig(cfg)} />

        {/* Hook URL display */}
        <HookUrlCard hookUrl={hookUrl} />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button onClick={() => setActiveTab('inbox')} className={tabCls(activeTab === 'inbox')}>
            ERP Orders ({visibleOrders.length})
          </button>

          <button onClick={() => setActiveTab('events')} className={tabCls(activeTab === 'events')}>
            Event Log
          </button>
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
                <AccountFilterDropdown
                  accounts={uniqueAccounts}
                  selected={filterAccounts}
                  onToggle={toggleAccount}
                  onClear={() => setFilterAccounts([])}
                />
              )}

              <button
                onClick={() => { void fetchOrders(); }}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted transition-colors"
              >
                Refresh
              </button>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 px-4 py-2.5 text-sm" style={{ background: 'rgba(247,25,99,0.05)' }}>
                <span className="font-medium" style={{ color: '#F71963' }}>
                  {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => { void handleBulkAction('resolve'); }}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-border bg-background hover:bg-muted transition-colors"
                  >
                    Mark as resolved
                  </button>
                  <button
                    onClick={() => { void handleBulkAction('delete'); }}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Delete selected
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

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
              <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="pl-3 pr-1 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={pagedOrders.length > 0 && pagedOrders.every((o) => selectedIds.has(o.id))}
                          ref={(el) => {
                            if (el) el.indeterminate = pagedOrders.some((o) => selectedIds.has(o.id)) && !pagedOrders.every((o) => selectedIds.has(o.id));
                          }}
                          onChange={toggleSelectPage}
                          className="w-4 h-4 rounded accent-primary cursor-pointer"
                          aria-label="Select all on this page"
                        />
                      </th>
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
                    {pagedOrders.map((order) => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        onAction={handleAction}
                        configAccount={config?.account ?? undefined}
                        credsConfigured={config !== null && (config.appTokenConfigured ?? false)}
                        selected={selectedIds.has(order.id)}
                        onSelect={toggleSelectId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={orderPage}
                totalPages={orderTotalPages}
                totalItems={visibleOrders.length}
                pageSize={PAGE_SIZE}
                onPage={setOrderPage}
              />
              </>
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
              <>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
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
                      {pagedEvents.map((evt, i) => (
                        <EventLogRow key={i} evt={evt} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={eventPage}
                  totalPages={eventTotalPages}
                  totalItems={events.length}
                  pageSize={PAGE_SIZE}
                  onPage={setEventPage}
                />
              </>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
    </AppShell>
  );
}

function HookUrlCard({ hookUrl }: { hookUrl: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(hookUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/60" style={{ background: 'linear-gradient(to right, #142032 0%, #1e2f44 100%)' }}>
        {/* Webhook icon */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#F71963" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="12" r="2" />
          <circle cx="11" cy="4" r="2" />
          <path d="M7 12h3a3 3 0 0 0 0-6H8" />
          <path d="M9 4H6a3 3 0 0 0 0 6h1" />
        </svg>
        <span className="text-xs font-semibold text-white/90">Webhook Endpoint</span>
        <span className="ml-auto text-[10px] text-white/30 font-mono uppercase tracking-wide">POST</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* URL row */}
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 font-mono text-[12px] text-foreground bg-muted/60 border border-border rounded-lg px-3 py-2 truncate select-all">
            {hookUrl}
          </code>
          <button
            onClick={copy}
            className={[
              'shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all duration-150',
              copied
                ? 'border-green-400/60 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                : 'border-border hover:border-[#F71963]/40 hover:bg-[#F71963]/5 text-foreground',
            ].join(' ')}
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-5" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="7" height="7" rx="1.5" />
                  <path d="M8 4V2.5A1.5 1.5 0 0 0 6.5 1h-4A1.5 1.5 0 0 0 1 2.5v4A1.5 1.5 0 0 0 2.5 8H4" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>

        {/* Info row */}
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="mt-0.5 shrink-0 text-[#F71963]/70">
            <circle cx="6" cy="6" r="5" />
            <path d="M6 5.5v3M6 4h.01" />
          </svg>
          <span>
            Register this URL in VTEX with your App Key via{' '}
            <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">Setup → Hook &amp; Feed Configuration</code>
            {' '}or directly with <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">POST /api/orders/hook/config</code>.
            Each App Key supports one Hook — re-register if you change keys.
          </span>
        </div>
      </div>
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

function AccountFilterDropdown({
  accounts,
  selected,
  onToggle,
  onClear,
}: {
  accounts: string[];
  selected: string[];
  onToggle: (account: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const label =
    selected.length === 0
      ? 'All Accounts'
      : selected.length === 1
      ? selected[0]
      : `${selected.length} accounts`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
          selected.length > 0
            ? 'border-primary bg-primary/5 text-primary font-medium'
            : 'border-input bg-background text-foreground',
        ].join(' ')}
      >
        <svg className="w-3.5 h-3.5 shrink-0 text-muted-foreground" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="5" r="3.5" />
          <circle cx="9" cy="9" r="3.5" />
        </svg>
        <span className="max-w-[120px] truncate">{label}</span>
        {selected.length > 0 && (
          <span
            className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-primary text-primary-foreground shrink-0"
          >
            {selected.length}
          </span>
        )}
        <svg
          className={`w-3 h-3 text-muted-foreground transition-transform duration-150 shrink-0 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[180px] rounded-lg border border-border bg-background shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/30">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Filter by Account</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => { onClear(); setOpen(false); }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {/* Options */}
          <div className="py-1 max-h-56 overflow-y-auto">
            {accounts.map((account) => {
              const checked = selected.includes(account);
              return (
                <label
                  key={account}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors select-none"
                >
                  <div className={[
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                    checked ? 'border-primary bg-primary' : 'border-border bg-background',
                  ].join(' ')}>
                    {checked && (
                      <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 5l2.5 2.5 3.5-4" />
                      </svg>
                    )}
                  </div>
                  <input type="checkbox" className="sr-only" checked={checked} onChange={() => onToggle(account)} />
                  <span className="text-sm text-foreground truncate">{account}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  // Build page number list: always show first, last, current ±1, with ellipsis gaps
  const pages: (number | '…')[] = [];
  const range = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  let prev = 0;
  for (const p of Array.from(range).sort((a, b) => a - b)) {
    if (p - prev > 1) pages.push('…');
    pages.push(p);
    prev = p;
  }

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <span className="text-xs text-muted-foreground tabular-nums">
        Showing {from}–{to} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 2.5L4 6l3.5 3.5" />
          </svg>
          Prev
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={[
                'w-8 h-7 text-xs rounded border transition-colors',
                p === page
                  ? 'border-transparent font-semibold text-white'
                  : 'border-border hover:bg-muted text-foreground',
              ].join(' ')}
              style={p === page ? { background: '#F71963' } : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          Next
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 2.5L8 6l-3.5 3.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const selectCls =
  'rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

