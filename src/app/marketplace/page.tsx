'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import type { MktCallLogEntry, MktScenario } from '@/types/marketplace';

// ─── Metadata ────────────────────────────────────────────────────────────────

type EndpointDoc = {
  label: string;
  method: string;
  pathTemplate: string;
  description: string;
  docUrl: string;
};

const ENDPOINT_DOCS: Record<string, EndpointDoc> = {
  simulation: {
    label: 'Fulfillment Simulation',
    method: 'POST',
    pathTemplate: '/pvt/orderForms/simulation',
    description:
      'Called by the VTEX marketplace during checkout to check item availability, pricing, and shipping options for this seller. The response drives whether the seller appears as a shipping option.',
    docUrl:
      'https://developers.vtex.com/docs/api-reference/marketplace-protocol-external-seller-fulfillment#post-/pvt/orderForms/simulation',
  },
  placement: {
    label: 'Order Placement',
    method: 'PUT',
    pathTemplate: '/pvt/orders/{orderId}',
    description:
      'Called when the customer confirms the purchase. VTEX sends the full order to the seller. The seller must respond with a sellerOrderId to acknowledge registration.',
    docUrl:
      'https://developers.vtex.com/docs/api-reference/marketplace-protocol-external-seller-fulfillment#put-/pvt/orders/-orderId-',
  },
  fulfill: {
    label: 'Authorize Fulfillment',
    method: 'POST',
    pathTemplate: '/pvt/orders/{orderId}/fulfill',
    description:
      'Called by VTEX to authorize the seller to start preparing and shipping the order. After this the seller can proceed with physical fulfillment.',
    docUrl:
      'https://developers.vtex.com/docs/api-reference/marketplace-protocol-external-seller-fulfillment#post-/pvt/orders/-orderId-/fulfill',
  },
  cancel: {
    label: 'Order Cancellation',
    method: 'POST',
    pathTemplate: '/pvt/orders/{orderId}/cancel',
    description:
      'Called by the marketplace to cancel the seller order. The seller must acknowledge with a receipt ID and stop all fulfillment activity.',
    docUrl:
      'https://developers.vtex.com/docs/api-reference/marketplace-protocol-external-seller-fulfillment#post-/pvt/orders/-orderId-/cancel',
  },
};

const SCENARIOS: { value: MktScenario; label: string; color: string; dot: string; description: string }[] = [
  {
    value: 'available',
    label: 'Available',
    color: 'text-emerald-400',
    dot: 'bg-emerald-400',
    description: 'All items in stock. Returns prices, SLAs, and stock balance.',
  },
  {
    value: 'unavailable',
    label: 'Unavailable',
    color: 'text-red-400',
    dot: 'bg-red-400',
    description: 'No stock. Returns quantity 0 and empty SLA list.',
  },
  {
    value: 'partial',
    label: 'Partial',
    color: 'text-amber-400',
    dot: 'bg-amber-400',
    description: 'First item available, remaining items out of stock.',
  },
];

const METHOD_COLORS: Record<string, string> = {
  POST: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  PUT: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const ENDPOINT_COLORS: Record<string, string> = {
  simulation: 'text-sky-400',
  placement: 'text-violet-400',
  fulfill: 'text-emerald-400',
  cancel: 'text-red-400',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function BrazilianEngineeringLogo() {
  return (
    <div className="flex flex-col items-center select-none">
      <span className="font-black italic leading-none tracking-tight" style={{ fontSize: '1.1rem', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
        #BrazilianEngineering
      </span>
      <svg viewBox="0 0 240 16" width="220" height="14" className="mt-1" aria-hidden="true">
        <path d="M 2 8 C 60 15 100 13 112 8" stroke="#FEDF00" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <path d="M 128 8 C 145 13 185 15 238 8" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <polygon points="120,1 130,8 120,15 110,8" fill="#009B3A" />
        <polygon points="120,3.5 128,8 120,12.5 112,8" fill="#FEDF00" />
        <circle cx="120" cy="8" r="4" fill="#002776" />
        <path d="M 116.5 8 A 4 4 0 0 1 123.5 8" stroke="white" strokeWidth="0.7" fill="none" />
      </svg>
    </div>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-words" style={{ color: 'rgba(255,255,255,0.55)' }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [accountInput, setAccountInput] = useState('');
  const [account, setAccount] = useState('');
  const [scenario, setScenario] = useState<MktScenario>('available');
  const [calls, setCalls] = useState<MktCallLogEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [baseUrl, setBaseUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<'scenario' | 'setup' | 'catalog'>('scenario');
  const configInitialized = useRef(false);

  // Load account from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('mkt_account') ?? '';
    setAccountInput(saved);
    setAccount(saved);
  }, []);

  // Update base URL when account or origin changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setBaseUrl(account ? `${window.location.origin}/api/marketplace/${account}` : '');
  }, [account]);

  // Polling
  const fetchData = useCallback(async () => {
    if (!account) return;
    try {
      const [callsRes, configRes] = await Promise.all([
        fetch(`/api/marketplace/${account}/calls`),
        fetch(`/api/marketplace/${account}/config`),
      ]);

      if (callsRes.ok) {
        const data = await callsRes.json() as { calls: MktCallLogEntry[] };
        const incoming = data.calls ?? [];
        if (incoming.length) {
          setCalls(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const added = incoming.filter(c => !existingIds.has(c.id));
            return added.length ? [...prev, ...added] : prev;
          });
        }
      }

      if (configRes.ok && !configInitialized.current) {
        const cfg = await configRes.json() as { scenario: MktScenario };
        setScenario(cfg.scenario);
        configInitialized.current = true;
      }
    } catch {
      // network error — ignore, will retry
    }
  }, [account]);

  useEffect(() => {
    if (!account) return;
    configInitialized.current = false;
    setCalls([]);
    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => clearInterval(id);
  }, [account, fetchData]);

  function commitAccount() {
    const trimmed = accountInput.trim().toLowerCase();
    if (!trimmed) return;
    setAccount(trimmed);
    localStorage.setItem('mkt_account', trimmed);
  }

  async function changeScenario(s: MktScenario) {
    setScenario(s);
    if (!account) return;
    await fetch(`/api/marketplace/${account}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: s }),
    });
  }

  async function clearCalls() {
    if (!account) return;
    setClearing(true);
    await fetch(`/api/marketplace/${account}/calls`, { method: 'DELETE' });
    setCalls([]);
    setClearing(false);
  }

  async function copyUrl() {
    if (!baseUrl) return;
    await navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const activeScenario = SCENARIOS.find(s => s.value === scenario)!;
  const sortedCalls = [...calls].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0d1826' }}>

      {/* Header */}
      <header className="grid grid-cols-3 items-center h-16 px-6 shrink-0 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 transition-opacity hover:opacity-70">
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <path d="M12 5l-5 5 5 5" />
            </svg>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>All tools</span>
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <span className="text-sm font-semibold text-white/70">External Seller Simulator</span>
        </div>

        <div className="flex flex-col items-center justify-center">
          {account ? (
            <>
              <span className="text-[10px] text-white/25 uppercase tracking-widest">Fulfillment URL</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-white/40 truncate max-w-[180px]">
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/marketplace/`}
                </span>
                <span className={`text-xs font-mono font-bold ${activeScenario.color} whitespace-nowrap`}>
                  {account}
                </span>
              </div>
            </>
          ) : (
            <span className="text-xs text-white/25">Configure account to get started</span>
          )}
        </div>

        <div className="flex justify-end">
          {account && (
            <button
              onClick={clearCalls}
              disabled={clearing || calls.length === 0}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-30"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { if (!clearing) e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h12M6 7l1 9h6l1-9M8 7V4h4v3" />
              </svg>
              {clearing ? 'Clearing…' : 'Clear'}
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <aside className="w-80 shrink-0 flex flex-col border-r border-white/10 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/10 shrink-0">
            {([['scenario', 'Scenario'], ['setup', 'Setup']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setActiveTab(val)}
                className={[
                  'flex-1 py-3 text-xs font-medium transition-colors',
                  activeTab === val ? 'text-white/80 border-b-2 border-pink-500' : 'text-white/30 hover:text-white/50',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setActiveTab('catalog')}
              className={[
                'flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors',
                activeTab === 'catalog' ? 'text-white/80 border-b-2 border-pink-500' : 'text-white/30 hover:text-white/50',
              ].join(' ')}
            >
              Catalog
              <span className="text-[9px] font-semibold px-1 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Soon</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'scenario' && (
              <div className="p-4 space-y-6">

                {/* Account config */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/25">VTEX Account</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={accountInput}
                      onChange={e => setAccountInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && commitAccount()}
                      placeholder="mystore"
                      className="flex-1 text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-pink-500/50"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                    />
                    <button
                      onClick={commitAccount}
                      disabled={!accountInput.trim()}
                      className="px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
                      style={{ background: 'rgba(247,25,99,0.15)', border: '1px solid rgba(247,25,99,0.3)', color: '#F71963' }}
                    >
                      Set
                    </button>
                  </div>
                  {account && (
                    <div
                      className="rounded-lg px-3 py-2 space-y-1"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <p className="text-[10px] text-white/25">Fulfillment URL to register in VTEX</p>
                      <p className="text-xs font-mono break-all" style={{ color: 'rgba(255,255,255,0.6)' }}>{baseUrl}</p>
                      <button
                        onClick={copyUrl}
                        className="flex items-center gap-1.5 text-xs mt-1 transition-opacity hover:opacity-80"
                        style={{ color: copied ? '#34d399' : 'rgba(255,255,255,0.35)' }}
                      >
                        {copied ? (
                          <>
                            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" /></svg>
                            Copied
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25v-7.5z" /><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25v-7.5zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25h-7.5z" /></svg>
                            Copy URL
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Scenario selector */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/25">Simulation Scenario</p>
                  <div className="space-y-1.5">
                    {SCENARIOS.map(s => (
                      <button
                        key={s.value}
                        onClick={() => changeScenario(s.value)}
                        disabled={!account}
                        className={[
                          'w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all disabled:opacity-30',
                          scenario === s.value
                            ? 'border border-white/20'
                            : 'border border-transparent hover:border-white/10',
                        ].join(' ')}
                        style={{
                          background: scenario === s.value ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                        <div>
                          <p className={`text-xs font-semibold ${s.color}`}>{s.label}</p>
                          <p className="text-xs text-white/30 mt-0.5 leading-relaxed">{s.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Endpoint reference */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/25">Endpoints</p>
                  <div className="space-y-1">
                    {Object.entries(ENDPOINT_DOCS).map(([key, doc]) => (
                      <div
                        key={key}
                        className="rounded-lg px-3 py-2"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold font-mono ${ENDPOINT_COLORS[key]}`}>{doc.method}</span>
                          <span className="text-[10px] font-mono text-white/40 truncate">{doc.pathTemplate}</span>
                        </div>
                        <p className="text-[10px] text-white/25 mt-0.5">{doc.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'setup' && (
              <div className="p-4 space-y-5">
                <div>
                  <p className="text-xs font-semibold text-white/70">Setup guide</p>
                  <p className="text-xs text-white/30 mt-1 leading-relaxed">
                    How to connect this simulator as an external seller in your VTEX account.
                  </p>
                </div>

                {[
                  {
                    n: 1,
                    title: 'Enter your account name',
                    body: 'Type your VTEX account name in the Scenario tab. This generates a unique Fulfillment URL for your account.',
                  },
                  {
                    n: 2,
                    title: 'Create an external seller in VTEX',
                    body: 'Go to VTEX Admin → Marketplace → Sellers → New Seller. Set the seller type to External and save.',
                    link: { label: 'Adding a seller', url: 'https://help.vtex.com/docs/tutorials/adding-a-seller' },
                  },
                  {
                    n: 3,
                    title: 'Set the Fulfillment URL',
                    body: 'In the seller configuration, paste the Fulfillment URL from the Scenario tab into the Fulfillment Endpoint field.',
                  },
                  {
                    n: 4,
                    title: 'Map a product to the seller',
                    body: 'In the product catalog, associate at least one SKU with the external seller ID you just created.',
                  },
                  {
                    n: 5,
                    title: 'Place a test order',
                    body: 'Add the mapped product to the cart and proceed to checkout. VTEX will call the Fulfillment Simulation endpoint to retrieve availability and SLAs.',
                  },
                  {
                    n: 6,
                    title: 'Watch calls arrive',
                    body: 'Switch to the Scenario tab and monitor the call log on the right as VTEX triggers Simulation, Placement, Authorize, and Cancellation calls.',
                  },
                ].map(step => (
                  <div key={step.n} className="flex gap-3">
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                      style={{ background: 'rgba(247,25,99,0.15)', color: '#F71963' }}
                    >
                      {step.n}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-white/70">{step.title}</p>
                      <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{step.body}</p>
                      {step.link && (
                        <a
                          href={step.link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs mt-1 transition-opacity hover:opacity-80"
                          style={{ color: '#F71963' }}
                        >
                          {step.link.label}
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1z" /></svg>
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                <div className="pt-2 border-t border-white/08 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-white/25">Reference</p>
                  {[
                    { label: 'External Seller Fulfillment API', url: 'https://developers.vtex.com/docs/api-reference/marketplace-protocol-external-seller-fulfillment' },
                    { label: 'Marketplace Protocol overview', url: 'https://developers.vtex.com/docs/guides/external-seller-integration-guide' },
                    { label: 'Adding a seller (Admin)', url: 'https://help.vtex.com/docs/tutorials/adding-a-seller' },
                  ].map(link => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1z" /></svg>
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'catalog' && (
              <div className="p-4 flex flex-col items-center justify-center h-full gap-5 text-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                    <path d="M16 3H8l-2 4h12l-2-4z" />
                    <path d="M12 12v4M10 14h4" />
                  </svg>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-sm font-semibold text-white/70">Catalog Sync</p>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Coming Soon</span>
                  </div>
                  <p className="text-xs text-white/30 leading-relaxed max-w-[220px]">
                    Push SKU suggestions from the seller to the VTEX marketplace catalog using the SKU Exchange API.
                  </p>
                </div>
                <div className="space-y-2 w-full">
                  {[
                    'Define products and SKUs',
                    'Send catalog notifications to marketplace',
                    'Track approval status per SKU',
                  ].map(item => (
                    <div
                      key={item}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 opacity-40"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50 shrink-0" />
                      <span className="text-xs text-white/50">{item}</span>
                    </div>
                  ))}
                </div>
                <a
                  href="https://developers.vtex.com/docs/api-reference/marketplace-protocol-external-seller-fulfillment#post-/api/catalog_system/pvt/skuexchange/skuseller/-sellerId-/-sellerSkuId-"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1z" /></svg>
                  SKU Exchange API reference
                </a>
              </div>
            )}
          </div>
        </aside>

        {/* Right panel — call log */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Flow strip */}
          <div className="relative shrink-0 border-b border-white/10 px-6 py-3">
            <div className="flex items-center justify-center gap-2">
              {Object.entries(ENDPOINT_DOCS).map(([key, doc], i, arr) => {
                const count = sortedCalls.filter(c => c.endpoint === key).length;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <span className={`text-[10px] font-bold font-mono ${ENDPOINT_COLORS[key]}`}>{doc.method}</span>
                      <span className="text-[10px] text-white/40">{doc.label}</span>
                      {count > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ENDPOINT_COLORS[key]}`} style={{ background: 'rgba(255,255,255,0.06)' }}>
                          {count}
                        </span>
                      )}
                    </div>
                    {i < arr.length - 1 && (
                      <svg className="w-3 h-3 text-white/15 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 10h10M10 5l5 5-5 5" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Call list */}
          <div className="flex-1 overflow-y-auto">
            {sortedCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'rgba(255,255,255,0.15)' }}>
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <path d="M9 22V12h6v10" />
                </svg>
                <p className="text-sm">
                  {account ? 'Waiting for VTEX marketplace calls…' : 'Configure your account name to get started'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {[...sortedCalls].reverse().map(call => {
                  const expanded = expandedIds.has(call.id);
                  const doc = ENDPOINT_DOCS[call.endpoint];
                  return (
                    <div key={call.id}>
                      <button
                        onClick={() => toggleExpand(call.id)}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.02]"
                      >
                        {/* Method badge */}
                        <span className={`shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${METHOD_COLORS[call.method] ?? 'bg-white/10 text-white/40 border-white/10'}`}>
                          {call.method}
                        </span>

                        {/* Endpoint label + path */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${ENDPOINT_COLORS[call.endpoint] ?? 'text-white/60'}`}>
                              {doc?.label ?? call.endpoint}
                            </span>
                            <span className="text-xs text-white/25 font-mono truncate hidden sm:block">{call.path}</span>
                          </div>
                          <p className="text-[10px] text-white/25 mt-0.5">
                            {new Date(call.timestamp).toLocaleTimeString()}
                            {call.orderId && <> · <span className="font-mono">{call.orderId}</span></>}
                          </p>
                        </div>

                        {/* Status + duration */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${call.httpStatus < 300 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                            {call.httpStatus}
                          </span>
                          <span className="text-[10px] text-white/20">{call.durationMs}ms</span>
                          <svg
                            className={`w-3.5 h-3.5 text-white/20 transition-transform ${expanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <path d="M5 8l5 5 5-5" />
                          </svg>
                        </div>
                      </button>

                      {expanded && (
                        <div className="px-5 pb-4 space-y-4" style={{ background: 'rgba(0,0,0,0.15)' }}>

                          {/* Endpoint doc */}
                          {doc && (
                            <div className="rounded-lg px-4 py-3 space-y-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <p className="text-xs text-white/50 leading-relaxed">{doc.description}</p>
                              <a
                                href={doc.docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-80"
                                style={{ color: '#F71963' }}
                              >
                                VTEX API reference
                                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1z" /></svg>
                              </a>
                            </div>
                          )}

                          {/* Request */}
                          {call.requestBody != null && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] uppercase tracking-widest text-white/25">Request body</p>
                              <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <JsonBlock data={call.requestBody} />
                              </div>
                            </div>
                          )}

                          {/* Response */}
                          <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-widest text-white/25">Response body</p>
                            <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <JsonBlock data={call.responseBody} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer
        className="border-t px-8 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0e1a27' }}
      >
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-xs font-medium transition-colors"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3" />
            <path d="M13 14l3-4-3-4" />
            <path d="M16 10H7" />
          </svg>
          Sign out
        </button>

        <a href="https://brazilian.engineering/" target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80" aria-label="Brazilian Engineering">
          <BrazilianEngineeringLogo />
        </a>

        <a
          href="https://github.com/dcionevtex"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-opacity hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Built by <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>@dcionevtex</span> · VTEX
        </a>
      </footer>
    </div>
  );
}
