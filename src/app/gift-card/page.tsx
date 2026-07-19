'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import type { GcCallLogEntry, GiftCardRecord, GcConfig, GcScenario } from '@/types/giftCard';

// ── Helpers ───────────────────────────────────────────────────────────────────

function methodColor(method: string) {
  if (method === 'GET') return 'bg-secondary text-secondary-foreground';
  if (method === 'POST') return 'bg-success-faded text-success-foreground';
  return 'bg-muted text-muted-foreground';
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return 'text-success-foreground';
  if (status >= 400) return 'text-danger-foreground';
  return 'text-warning-foreground';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(iso).toLocaleTimeString();
}

function endpointLabel(endpoint: string): string {
  const map: Record<string, string> = {
    search: '_search',
    'get-card': 'GET /{id}',
    'create-card': 'POST /giftcards',
    'create-transaction': 'POST /transactions',
    'list-settlements': 'GET /settlements',
    settle: 'POST /settlements',
    'list-cancellations': 'GET /cancellations',
    cancel: 'POST /cancellations',
  };
  return map[endpoint] ?? endpoint;
}

const FLOW_STEPS = [
  { key: 'search',             label: 'Search',      sub: 'POST /_search' },
  { key: 'get-card',           label: 'Get Card',    sub: 'GET /{id}' },
  { key: 'create-transaction', label: 'Debit',       sub: 'POST /transactions' },
  { key: 'settle',             label: 'Settle',      sub: 'POST /settlements' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function GiftCardPage() {
  const [accountInput, setAccountInput] = useState('');
  const [account, setAccount]           = useState('');
  const [config, setConfig]             = useState<GcConfig>({ scenario: 'approved', mockBalance: 9999, currencyCode: 'BRL' });
  const [cards, setCards]               = useState<GiftCardRecord[]>([]);
  const [calls, setCalls]               = useState<GcCallLogEntry[]>([]);
  const [baseUrl, setBaseUrl]           = useState('');
  const [copied, setCopied]             = useState(false);
  const [clearing, setClearing]         = useState(false);
  const [activeTab, setActiveTab]       = useState<'scenario' | 'hub' | 'setup'>('scenario');
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set());
  const [balanceInput, setBalanceInput] = useState('9999');
  const [currencyInput, setCurrencyInput] = useState('BRL');
  const [savedConfig, setSavedConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Hub tab state
  const [hubAppKey, setHubAppKey]       = useState('');
  const [hubAppToken, setHubAppToken]   = useState('');
  const [hubLoading, setHubLoading]     = useState(false);
  const [hubResult, setHubResult]       = useState<{ ok: boolean; status: number; data: unknown; sentBody?: unknown } | null>(null);
  const [hubAction, setHubAction]       = useState<'list' | 'register' | null>(null);
  const configInitialized               = useRef(false);

  // Restore state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gc_account') ?? '';
    setAccountInput(saved);
    setAccount(saved);
    setHubAppKey(localStorage.getItem('gc_hub_appkey') ?? '');
    setHubAppToken(localStorage.getItem('gc_hub_apptoken') ?? '');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !account) return;
    setBaseUrl(`${window.location.origin}/api/gift-card/${account}`);
  }, [account]);

  const fetchData = useCallback(async () => {
    if (!account) return;
    try {
      const res = await fetch(`/api/gift-card/${account}/config`);
      if (!res.ok) return;
      const data = await res.json() as { config: GcConfig; cards: GiftCardRecord[]; calls: GcCallLogEntry[] };

      setCalls(prev => {
        const incoming = data.calls ?? [];
        if (!incoming.length) return prev;
        const existingIds = new Set(prev.map(c => c.id));
        const added = incoming.filter(c => !existingIds.has(c.id));
        return added.length ? [...added, ...prev] : prev;
      });

      setCards(data.cards ?? []);

      if (!configInitialized.current) {
        setConfig(data.config);
        setBalanceInput(String(data.config.mockBalance));
        setCurrencyInput(data.config.currencyCode ?? 'BRL');
        configInitialized.current = true;
      }
    } catch {
      // silent — polling
    }
  }, [account]);

  useEffect(() => {
    if (!account) return;
    configInitialized.current = false;
    setCalls([]);
    setCards([]);
    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => clearInterval(id);
  }, [account, fetchData]);

  function commitAccount() {
    const trimmed = accountInput.trim().toLowerCase();
    if (!trimmed) return;
    setAccount(trimmed);
    localStorage.setItem('gc_account', trimmed);
  }

  async function saveConfig(patch: Partial<{ scenario: GcScenario; mockBalance: number; currencyCode: string }>) {
    if (!account) return;
    const isBalancePatch = patch.mockBalance !== undefined || patch.currencyCode !== undefined;
    if (isBalancePatch) setSavingConfig(true);
    const merged = {
      scenario: patch.scenario ?? config.scenario,
      mockBalance: patch.mockBalance ?? (Number(balanceInput) || 9999),
      currencyCode: patch.currencyCode ?? (currencyInput || 'BRL'),
    };
    try {
      await fetch(`/api/gift-card/${account}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      setConfig(c => ({ ...c, ...merged }));
      if (isBalancePatch) {
        setSavedConfig(true);
        setTimeout(() => setSavedConfig(false), 2000);
      }
    } finally {
      if (isBalancePatch) setSavingConfig(false);
    }
  }

  async function clearAll() {
    if (!account) return;
    setClearing(true);
    await fetch(`/api/gift-card/${account}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    });
    setCalls([]);
    setCards([]);
    setClearing(false);
  }

  function saveHubCreds(key: string, token: string) {
    setHubAppKey(key);
    setHubAppToken(token);
    localStorage.setItem('gc_hub_appkey', key);
    localStorage.setItem('gc_hub_apptoken', token);
  }

  async function hubCall(action: 'list' | 'register') {
    if (!account || !hubAppKey || !hubAppToken) return;
    setHubLoading(true);
    setHubAction(action);
    setHubResult(null);
    try {
      const res = await fetch(`/api/gift-card/${account}/hub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          appKey: hubAppKey,
          appToken: hubAppToken,
          serviceUrl: baseUrl,
          providerId: `${account}-GiftCardMock`,
        }),
      });
      const data = await res.json();
      setHubResult(data);
    } catch (e) {
      setHubResult({ ok: false, status: 0, data: { error: String(e) } });
    } finally {
      setHubLoading(false);
    }
  }

  function copyBaseUrl() {
    navigator.clipboard.writeText(baseUrl);
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

  // Derive flow step statuses from call log
  const hitEndpoints   = new Set(calls.map(c => c.endpoint));
  const failedEndpoints = new Set(calls.filter(c => c.httpStatus >= 400).map(c => c.endpoint));
  function stepStatus(key: string): 'waiting' | 'passed' | 'failed' {
    if (failedEndpoints.has(key)) return 'failed';
    if (hitEndpoints.has(key))    return 'passed';
    return 'waiting';
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">

      {/* Header */}
      <header className="grid grid-cols-3 items-center h-16 px-6 shrink-0 border-b border-border bg-card">

        {/* Left — breadcrumb */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4l-6 6 6 6" />
            </svg>
            All tools
          </Link>
          <span className="text-border">|</span>
          <span className="text-sm font-semibold text-foreground">Gift Card Provider</span>
        </div>

        {/* Center — service URL */}
        <div className="flex flex-col items-center justify-center min-w-0">
          {account ? (
            <>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Provider service URL</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-foreground truncate max-w-xs">{baseUrl}</span>
                <button
                  onClick={copyBaseUrl}
                  title="Copy URL"
                  className={`shrink-0 transition-colors ${copied ? 'text-success-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {copied ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
                  )}
                </button>
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Configure account to get started</span>
          )}
        </div>

        {/* Right — clear */}
        <div className="flex justify-end items-center">
          {account && (
            <button
              onClick={clearAll}
              disabled={clearing || (calls.length === 0 && cards.length === 0)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h12M6 7l1 9h6l1-9M8 7V4h4v3" />
              </svg>
              {clearing ? 'Clearing…' : 'Clear'}
            </button>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="ml-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {!account ? (
        /* ── First-run empty state — centered account connect card ── */
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-sm p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="13" rx="2" />
                <path d="M2 10h20M7 15h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Connect your VTEX account</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Enter your VTEX account name to generate this simulator&apos;s Gift Card Provider service URL.
              </p>
            </div>
            <div className="flex gap-2 text-left">
              <input
                type="text"
                value={accountInput}
                onChange={e => setAccountInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && commitAccount()}
                placeholder="mystore"
                autoFocus
                className="flex-1 text-sm rounded-md px-3 py-2 outline-none border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={commitAccount}
                disabled={!accountInput.trim()}
                className="px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Flow bar */}
      <div className="border-b border-border bg-card px-6 py-3 shrink-0">
        <div className="flex items-center justify-center gap-1 overflow-x-auto">
          {FLOW_STEPS.map((step, i) => {
            const st = stepStatus(step.key);
            return (
              <div key={step.key} className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-md">
                  <div className="flex items-center gap-1.5">
                    <span className={[
                      'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      st === 'passed' ? 'bg-success-faded text-success-foreground' :
                      st === 'failed' ? 'bg-danger-faded text-danger-foreground' :
                      'bg-muted text-muted-foreground',
                    ].join(' ')}>
                      {st === 'passed' ? '✓' : st === 'failed' ? '✗' : i + 1}
                    </span>
                    <span className={[
                      'text-xs font-medium',
                      st === 'passed' ? 'text-success-foreground' :
                      st === 'failed' ? 'text-danger-foreground' :
                      'text-muted-foreground',
                    ].join(' ')}>
                      {step.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{step.sub}</span>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <svg className="w-4 h-4 text-border shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M5 10h10M10 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <aside className="w-80 shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
            {([['scenario', 'Scenario'], ['hub', 'Hub'], ['setup', 'Setup']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setActiveTab(val)}
                className={[
                  'flex-1 py-2.5 text-xs font-semibold transition-colors',
                  activeTab === val ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ── Scenario tab ── */}
            {activeTab === 'scenario' && (
              <div className="p-4 space-y-5">

                {/* Account */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">VTEX Account</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={accountInput}
                      onChange={e => setAccountInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && commitAccount()}
                      placeholder="mystore"
                      className="flex-1 text-sm rounded-md px-3 py-2 outline-none border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={commitAccount}
                      disabled={!accountInput.trim()}
                      className="px-3 py-2 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      Connect
                    </button>
                  </div>
                  {account && (
                    <div className="rounded-md px-3 py-2 space-y-1 bg-muted border border-border">
                      <p className="text-xs text-muted-foreground">Register this as the provider serviceUrl in VTEX Hub</p>
                      <p className="text-xs font-mono text-foreground break-all">{baseUrl}</p>
                      <button
                        onClick={copyBaseUrl}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground bg-card hover:bg-muted border border-border rounded px-2 py-1 transition-colors mt-1"
                      >
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
                        {copied ? 'Copied!' : 'Copy URL'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Scenario */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Response scenario</span>
                  {([
                    { value: 'approved' as GcScenario, label: 'Return card', dot: 'bg-success', desc: 'Any customer email returns a gift card with the configured balance.' },
                    { value: 'empty'    as GcScenario, label: 'No cards',    dot: 'bg-muted-foreground', desc: 'Search returns an empty array — the gift card option does not appear at checkout.' },
                  ] as const).map(s => (
                    <button
                      key={s.value}
                      onClick={() => saveConfig({ scenario: s.value })}
                      className={[
                        'w-full text-left rounded-md border px-3 py-2.5 transition-all',
                        config.scenario === s.value
                          ? s.value === 'approved'
                            ? 'bg-success-faded border-success text-success-foreground'
                            : 'bg-muted border-border text-foreground'
                          : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.scenario === s.value ? s.dot : 'bg-border'}`} />
                        <span className="text-xs font-medium">{s.label}</span>
                      </div>
                      {config.scenario === s.value && (
                        <p className="text-xs mt-1.5 ml-3.5 leading-relaxed opacity-80">{s.desc}</p>
                      )}
                    </button>
                  ))}
                </div>

                {/* Balance + Currency */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Mock balance &amp; currency</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={balanceInput}
                      onChange={e => setBalanceInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveConfig({ mockBalance: Number(balanceInput) || 9999, currencyCode: currencyInput || 'BRL' })}
                      placeholder="Balance"
                      className="flex-1 text-sm rounded-md px-3 py-2 outline-none font-mono border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={currencyInput}
                      onChange={e => setCurrencyInput(e.target.value.toUpperCase().slice(0, 3))}
                      onKeyDown={e => e.key === 'Enter' && saveConfig({ mockBalance: Number(balanceInput) || 9999, currencyCode: currencyInput || 'BRL' })}
                      placeholder="BRL"
                      maxLength={3}
                      className="w-16 text-sm rounded-md px-3 py-2 outline-none font-mono text-center border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <button
                    onClick={() => saveConfig({ mockBalance: Number(balanceInput) || 9999, currencyCode: currencyInput || 'BRL' })}
                    disabled={savingConfig}
                    className={[
                      'w-full py-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60',
                      savedConfig ? 'bg-success-faded text-success-foreground' : 'bg-primary text-primary-foreground hover:opacity-90',
                    ].join(' ')}
                  >
                    {savingConfig ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" strokeLinecap="round"/></svg>
                        Saving…
                      </>
                    ) : savedConfig ? (
                      <>
                        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
                        Saved
                      </>
                    ) : 'Set'}
                  </button>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Balance and currency code returned on every <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">_search</code> and <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">GET /&#123;id&#125;</code> call.
                  </p>
                </div>

                {/* Active cards */}
                {cards.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Active cards <span className="text-muted-foreground normal-case tracking-normal ml-1">{cards.length}</span>
                    </span>
                    <div className="space-y-1.5">
                      {cards.map(card => (
                        <div
                          key={card.id}
                          className="rounded-md px-3 py-2 space-y-0.5 bg-muted border border-border"
                        >
                          <p className="text-xs font-mono text-foreground truncate">{card.id}</p>
                          <p className="text-xs text-muted-foreground truncate">{card.owner}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-mono text-warning-foreground">{card.redemptionCode}</p>
                            <p className="text-xs font-mono text-success-foreground">{config.mockBalance} {config.currencyCode}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Hub tab ── */}
            {activeTab === 'hub' && (
              <div className="p-4 space-y-5">

                {/* VTEX admin credentials */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">VTEX Admin Credentials</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">Used to call the VTEX Gift Card Hub API on your behalf.</p>
                  <input
                    type="text"
                    value={hubAppKey}
                    onChange={e => saveHubCreds(e.target.value, hubAppToken)}
                    placeholder="App Key"
                    className="w-full text-xs rounded-md px-3 py-2 outline-none font-mono border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="password"
                    value={hubAppToken}
                    onChange={e => saveHubCreds(hubAppKey, e.target.value)}
                    placeholder="App Token"
                    className="w-full text-xs rounded-md px-3 py-2 outline-none font-mono border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">Credentials are saved in your browser only — never sent to our server except to proxy the VTEX call.</p>
                </div>

                {/* List providers */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">List Providers</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">GET /api/giftcardproviders</code><br />
                    Returns all gift card providers registered in your account.
                  </p>
                  <button
                    onClick={() => hubCall('list')}
                    disabled={hubLoading || !account || !hubAppKey || !hubAppToken}
                    className="w-full py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-30 flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {hubLoading && hubAction === 'list' ? (
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10h10M10 5l5 5-5 5"/></svg>
                    )}
                    GET Providers
                  </button>
                </div>

                {/* Register provider */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Register Mock Provider</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground break-all">PUT /api/giftcardproviders/{account ? `${account}-GiftCardMock` : '{account}-GiftCardMock'}</code>
                  </p>

                  {/* Provider details preview */}
                  <div className="rounded-md px-3 py-2.5 space-y-1.5 text-xs bg-muted border border-border">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Provider ID</span>
                      <span className="font-mono text-foreground truncate">{account ? `${account}-GiftCardMock` : '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">serviceUrl</span>
                      <span className="font-mono text-foreground truncate max-w-[140px]" title={baseUrl}>{baseUrl || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">appKey (provider)</span>
                      <span className="font-mono text-success-foreground">accountkey</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">appToken (provider)</span>
                      <span className="font-mono text-success-foreground">accountoken</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">cancelEnabled</span>
                      <span className="font-mono text-foreground">true</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="text-warning-foreground font-medium">accountkey</span> and <span className="text-warning-foreground font-medium">accountoken</span> are the credentials VTEX will send on every call to this mock. They are hardcoded for demo use only.
                  </p>

                  <button
                    onClick={() => hubCall('register')}
                    disabled={hubLoading || !account || !hubAppKey || !hubAppToken || !baseUrl}
                    className="w-full py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-30 flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {hubLoading && hubAction === 'register' ? (
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3v14M3 10h14" strokeLinecap="round"/></svg>
                    )}
                    Register Provider
                  </button>
                </div>

                {/* Result */}
                {hubResult && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response</span>
                      <span className={`text-xs font-mono font-semibold ${hubResult.ok ? 'text-success-foreground' : 'text-danger-foreground'}`}>
                        {hubResult.status}
                      </span>
                    </div>
                    {hubResult.sentBody != null && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Sent body</p>
                        <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded-md px-3 py-2 overflow-auto max-h-32">
                          {JSON.stringify(hubResult.sentBody, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">VTEX response</p>
                      <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded-md px-3 py-2 overflow-auto max-h-52">
                        {JSON.stringify(hubResult.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Setup tab ── */}
            {activeTab === 'setup' && (
              <div className="p-4 space-y-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">How to register the provider in VTEX</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Register this app as an external gift card provider in your VTEX account using the Gift Card Hub API.
                  </p>
                </div>

                {[
                  {
                    n: 1,
                    title: 'Set your VTEX account',
                    body: 'Enter your account name in the Scenario tab. The provider service URL will appear.',
                  },
                  {
                    n: 2,
                    title: 'Copy the service URL',
                    body: 'Use the URL shown in the Scenario tab or at the top of the page. This is the serviceUrl you will register.',
                  },
                  {
                    n: 3,
                    title: 'Register with VTEX Hub',
                    body: 'Run the command below in PowerShell or bash to register the provider.',
                  },
                  {
                    n: 4,
                    title: 'Test at checkout',
                    body: 'Add a product to cart, go to checkout, enter any customer email, and reach the payment step. The gift card will appear automatically.',
                  },
                  {
                    n: 5,
                    title: 'Watch the call log',
                    body: 'Every protocol call from VTEX appears in the call log. Click any row to inspect the request and response.',
                  },
                ].map(step => (
                  <div key={step.n} className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-muted border border-border text-xs font-bold text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                      {step.n}
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                ))}

                {/* Registration commands */}
                {account && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registration command</p>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-mono">PowerShell</p>
                      <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded-md px-3 py-2 overflow-x-auto whitespace-pre">
{`$body = '{"serviceUrl":"${baseUrl}","appKey":"demo-key","appToken":"demo-token","oauthProvider":"vtex","preAuthEnabled":false,"cancelEnabled":true}'
Invoke-RestMethod -Method PUT \`
  -Uri "https://{account}.vtexcommercestable.com.br/api/giftcardproviders/DemoGiftCard" \`
  -Headers @{"X-VTEX-API-AppKey"="{appKey}";"X-VTEX-API-AppToken"="{appToken}";"Content-Type"="application/json"} \`
  -Body $body`}
                      </pre>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-mono">bash / curl</p>
                      <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded-md px-3 py-2 overflow-x-auto whitespace-pre">
{`curl -X PUT "https://{account}.vtexcommercestable.com.br/api/giftcardproviders/DemoGiftCard" -H "X-VTEX-API-AppKey: {appKey}" -H "X-VTEX-API-AppToken: {appToken}" -H "Content-Type: application/json" -d '{"serviceUrl":"${baseUrl}","appKey":"demo-key","appToken":"demo-token","oauthProvider":"vtex","preAuthEnabled":false,"cancelEnabled":true}'`}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Reference links */}
                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Official references</p>
                  {[
                    { label: 'Gift Card Provider Protocol — API reference', href: 'https://developers.vtex.com/docs/api-reference/giftcard-provider-protocol' },
                    { label: 'How to integrate an external gift card provider', href: 'https://help.vtex.com/docs/tutorials/how-to-integrate-an-external-gift-card-provider-with-vtex' },
                    { label: 'Gift Card Hub API', href: 'https://developers.vtex.com/docs/api-reference/giftcard-hub-api' },
                  ].map(l => (
                    <a
                      key={l.href}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 10h10M10 5l5 5-5 5" />
                      </svg>
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right panel — call log */}
        <div className="flex-1 min-w-0 overflow-auto bg-background">
          {calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center px-8 space-y-3">
              <svg className="w-8 h-8 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 1 4 0M12 12v4M10 14h4" />
              </svg>
              <p className="text-sm text-foreground">No calls received yet</p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Register the provider URL in VTEX Hub, then go to checkout and enter a customer email to trigger the first _search call.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {calls.map(call => {
                const expanded = expandedIds.has(call.id);
                return (
                  <div
                    key={call.id}
                    className="transition-colors hover:bg-muted/50"
                  >
                    <div
                      className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                      onClick={() => toggleExpand(call.id)}
                    >
                      <span className={`shrink-0 text-xs font-bold font-mono px-1.5 py-0.5 rounded ${methodColor(call.method)}`}>
                        {call.method}
                      </span>
                      <span className="text-xs font-mono text-foreground flex-1 truncate">{call.path}</span>
                      <span className="text-xs text-muted-foreground shrink-0 font-mono bg-muted px-1.5 py-0.5 rounded">
                        {endpointLabel(call.endpoint)}
                      </span>
                      <span className={`shrink-0 text-xs font-mono font-semibold ${statusColor(call.httpStatus)}`}>
                        {call.httpStatus}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{call.durationMs}ms</span>
                      <span className="shrink-0 text-xs text-muted-foreground w-16 text-right">{relativeTime(call.timestamp)}</span>
                      <svg
                        className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {expanded && (
                      <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Request body</p>
                          <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded-md p-3 overflow-auto max-h-52">
                            {JSON.stringify(call.requestBody ?? null, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Response body</p>
                          <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded-md p-3 overflow-auto max-h-52">
                            {JSON.stringify(call.responseBody ?? null, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
