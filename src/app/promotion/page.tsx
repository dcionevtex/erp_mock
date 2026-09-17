'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import type { PromotionCallLogEntry, PromotionConfig, PromotionScenario, PromotionRule, PromotionDiscountType } from '@/types/promotion';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function endpointLabel(path: string): string {
  if (path.endsWith('/calculatePromotion')) return 'calculatePromotion';
  if (path.endsWith('/notifyUsage')) return 'notifyUsage';
  return path;
}

const SCENARIOS: { value: PromotionScenario; label: string; dot: string; desc: string }[] = [
  { value: 'apply', label: 'Apply promotions', dot: 'bg-success', desc: 'Active rules below are calculated and stacked sequentially against each item.' },
  { value: 'no-promotions', label: 'No promotions', dot: 'bg-muted-foreground', desc: 'Returns every item with no promotions — as if nothing qualifies.' },
  { value: 'error', label: 'Simulate error', dot: 'bg-danger', desc: 'Returns HTTP 500 — shows how Checkout behaves when the provider fails.' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PromotionProviderPage() {
  const [accountInput, setAccountInput] = useState('');
  const [account, setAccount]           = useState('');
  const [config, setConfig]             = useState<PromotionConfig | null>(null);
  const [calls, setCalls]               = useState<PromotionCallLogEntry[]>([]);
  const [calcUrl, setCalcUrl]           = useState('');
  const [notifyUrl, setNotifyUrl]       = useState('');
  const [copied, setCopied]             = useState<string | null>(null);
  const [clearing, setClearing]         = useState(false);
  const [activeTab, setActiveTab]       = useState<'scenario' | 'setup'>('scenario');
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set());
  const [newRuleName, setNewRuleName]   = useState('');
  const [newRuleType, setNewRuleType]   = useState<PromotionDiscountType>('PERCENTAGE');
  const [newRuleValue, setNewRuleValue] = useState('');
  const [newRuleCoupon, setNewRuleCoupon] = useState('');
  const [newRuleDesc, setNewRuleDesc]   = useState('');
  const configInitialized               = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('promotion_account') ?? '';
    setAccountInput(saved);
    setAccount(saved);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !account) return;
    setCalcUrl(`${window.location.origin}/api/promotion/${account}/calculatePromotion`);
    setNotifyUrl(`${window.location.origin}/api/promotion/${account}/notifyUsage`);
  }, [account]);

  const fetchData = useCallback(async () => {
    if (!account) return;
    try {
      const res = await fetch(`/api/promotion/${account}/config`);
      if (!res.ok) return;
      const data = await res.json() as { config: PromotionConfig; calls: PromotionCallLogEntry[] };

      setCalls(prev => {
        const incoming = data.calls ?? [];
        if (!incoming.length) return prev;
        const existingIds = new Set(prev.map(c => c.id));
        const added = incoming.filter(c => !existingIds.has(c.id));
        return added.length ? [...added, ...prev] : prev;
      });

      setConfig(data.config);
      configInitialized.current = true;
    } catch {
      // silent — polling
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
    localStorage.setItem('promotion_account', trimmed);
  }

  async function patchConfig(patch: Record<string, unknown>) {
    if (!account) return;
    const res = await fetch(`/api/promotion/${account}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json() as { config: PromotionConfig };
    setConfig(data.config);
  }

  async function clearCalls() {
    if (!account) return;
    setClearing(true);
    await patchConfig({ clear: true });
    setCalls([]);
    setClearing(false);
  }

  function addRule() {
    const value = Number(newRuleValue);
    if (!newRuleName.trim() || !value || value <= 0) return;
    patchConfig({
      addRule: {
        name: newRuleName.trim(),
        description: newRuleDesc.trim(),
        type: newRuleType,
        value,
        couponCode: newRuleCoupon.trim() || null,
      },
    });
    setNewRuleName('');
    setNewRuleValue('');
    setNewRuleCoupon('');
    setNewRuleDesc('');
  }

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const ticketTemplate = config
    ? `Please activate the External Promotions Protocol for account "${account}".

calculatePromotion endpoint: ${calcUrl}
notifyUsage endpoint: ${notifyUrl}
Auth header name: ${config.authHeaderName}
Auth header value: ${config.authHeaderValue}`
    : '';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">

      {/* Header */}
      <header className="grid grid-cols-3 items-center h-16 px-6 shrink-0 border-b border-border bg-card">

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
          <span className="text-sm font-semibold text-foreground">Promotion Provider</span>
        </div>

        <div className="flex flex-col items-center justify-center min-w-0">
          {account ? (
            <>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Account</span>
              <span className="text-xs font-mono text-foreground mt-0.5">{account}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Configure account to get started</span>
          )}
        </div>

        <div className="flex justify-end items-center">
          {account && (
            <button
              onClick={clearCalls}
              disabled={clearing || calls.length === 0}
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

      {!account || !config ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-sm p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41L11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82z" />
                <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Connect your VTEX account</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Enter your VTEX account name to generate this simulator&apos;s External Promotions Protocol endpoints.
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
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <aside className="w-80 shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">

          <div className="flex border-b border-border shrink-0">
            {([['scenario', 'Scenario'], ['setup', 'Setup']] as const).map(([val, label]) => (
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
                  <div className="rounded-md px-3 py-2 space-y-2 bg-muted border border-border">
                    <p className="text-xs text-muted-foreground">Endpoints to share in the VTEX support ticket (see Setup tab)</p>
                    <div className="space-y-1">
                      <p className="text-xs font-mono text-foreground break-all">{calcUrl}</p>
                      <p className="text-xs font-mono text-foreground break-all">{notifyUrl}</p>
                    </div>
                  </div>
                </div>

                {/* Scenario */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Response scenario</span>
                  {SCENARIOS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => patchConfig({ scenario: s.value })}
                      className={[
                        'w-full text-left rounded-md border px-3 py-2.5 transition-all',
                        config.scenario === s.value
                          ? s.value === 'apply'
                            ? 'bg-success-faded border-success text-success-foreground'
                            : s.value === 'error'
                            ? 'bg-danger-faded border-danger text-danger-foreground'
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

                {/* Auth header */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Auth header</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    VTEX support configures both the header name and value on their side — share these exact values in the ticket.
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground block">Header name</label>
                    <input
                      type="text"
                      defaultValue={config.authHeaderName}
                      onBlur={e => e.target.value !== config.authHeaderName && patchConfig({ authHeaderName: e.target.value })}
                      className="w-full text-xs rounded-md px-3 py-2 outline-none font-mono border border-border bg-background text-foreground focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground block">Header value</label>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-1 min-w-0 text-xs font-mono text-foreground bg-muted border border-border rounded-md px-3 py-2 truncate">
                        {config.authHeaderValue}
                      </span>
                      <button
                        onClick={() => copy('secret', config.authHeaderValue)}
                        title="Copy"
                        className={`shrink-0 transition-colors ${copied === 'secret' ? 'text-success-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => patchConfig({ regenerateSecret: true })}
                    className="w-full py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Regenerate
                  </button>
                </div>

                {/* Promotion rules */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Promotion rules <span className="normal-case tracking-normal ml-1">{config.rules.length}</span>
                  </span>
                  <div className="space-y-1.5">
                    {config.rules.map((r: PromotionRule) => (
                      <div key={r.id} className="rounded-md px-3 py-2 space-y-1 bg-muted border border-border">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span className="flex-1 min-w-0 text-xs font-medium text-foreground truncate">{r.name}</span>
                          <span className="text-xs font-mono text-success-foreground shrink-0">
                            {r.type === 'PERCENTAGE' ? `${r.value}%` : `$${r.value}`}
                          </span>
                        </div>
                        {r.couponCode && (
                          <p className="text-xs font-mono text-warning-foreground break-all">coupon: {r.couponCode}</p>
                        )}
                        <textarea
                          key={`${r.id}-desc`}
                          defaultValue={r.description}
                          onBlur={e => e.target.value !== r.description && patchConfig({ updateRule: { id: r.id, description: e.target.value } })}
                          placeholder="Description (sent to VTEX in allPromotions)"
                          rows={2}
                          className="w-full text-xs rounded-md px-2 py-1.5 outline-none resize-y border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                        />
                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={r.active}
                              onChange={e => patchConfig({ updateRule: { id: r.id, active: e.target.checked } })}
                            />
                            <span className="text-xs text-muted-foreground">Active</span>
                          </label>
                          <button
                            onClick={() => patchConfig({ removeRule: { id: r.id } })}
                            className="text-xs text-danger-foreground hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add rule */}
                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      value={newRuleName}
                      onChange={e => setNewRuleName(e.target.value)}
                      placeholder="Promotion name"
                      className="w-full text-xs rounded-md px-2 py-1.5 outline-none border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                    />
                    <textarea
                      value={newRuleDesc}
                      onChange={e => setNewRuleDesc(e.target.value)}
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full text-xs rounded-md px-2 py-1.5 outline-none resize-y border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-2 min-w-0">
                      <select
                        value={newRuleType}
                        onChange={e => setNewRuleType(e.target.value as PromotionDiscountType)}
                        className="shrink-0 text-xs rounded-md px-2 py-1.5 outline-none border border-border bg-background text-foreground focus:ring-1 focus:ring-ring"
                      >
                        <option value="PERCENTAGE">%</option>
                        <option value="FIXED">$</option>
                      </select>
                      <input
                        type="number"
                        value={newRuleValue}
                        onChange={e => setNewRuleValue(e.target.value)}
                        placeholder="Value"
                        min={0}
                        className="flex-1 min-w-0 text-xs rounded-md px-2 py-1.5 outline-none font-mono border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <input
                      type="text"
                      value={newRuleCoupon}
                      onChange={e => setNewRuleCoupon(e.target.value)}
                      placeholder="Coupon (optional)"
                      className="w-full min-w-0 text-xs rounded-md px-2 py-1.5 outline-none font-mono border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={addRule}
                      disabled={!newRuleName.trim() || !newRuleValue}
                      className="w-full py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      Add rule
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Setup tab ── */}
            {activeTab === 'setup' && (
              <div className="p-4 space-y-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">How activation works</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The External Promotions Protocol has no self-service registration API. VTEX support activates it per account from a support ticket — you can&apos;t enable it yourself from Checkout settings.
                  </p>
                </div>

                {[
                  { n: 1, title: 'Set your VTEX account', body: 'Enter your account name in the Scenario tab. Both endpoint URLs and the auth header will appear.' },
                  { n: 2, title: 'Open a support ticket', body: 'File a ticket with VTEX support asking to activate the External Promotions Protocol for this account.' },
                  { n: 3, title: 'Share the two endpoints', body: 'Paste the ticket template below — it includes both endpoint URLs and the auth header name/value VTEX must send.' },
                  { n: 4, title: 'Test at checkout', body: 'Once VTEX confirms activation, add items to cart and reach checkout — every cart change triggers a calculatePromotion call, shown live in the call log.' },
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

                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ticket template</p>
                    <button
                      onClick={() => copy('ticket', ticketTemplate)}
                      className="text-xs text-primary hover:underline"
                    >
                      {copied === 'ticket' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded-md px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                    {ticketTemplate}
                  </pre>
                </div>

                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Official references</p>
                  {[
                    { label: 'External Promotions Protocol — API reference', href: 'https://developers.vtex.com/docs/api-reference/external-promotions-protocol-api' },
                    { label: 'Promotions — overview', href: 'https://developers.vtex.com/docs/guides/promotions-overview' },
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
                <path d="M20.59 13.41L11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82z" />
              </svg>
              <p className="text-sm text-foreground">No calls received yet</p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Once VTEX support activates the protocol for this account, add an item to cart and reach checkout to trigger the first calculatePromotion call.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {calls.map(call => {
                const expanded = expandedIds.has(call.id);
                return (
                  <div key={call.id} className="transition-colors hover:bg-muted/50">
                    <div
                      className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                      onClick={() => toggleExpand(call.id)}
                    >
                      <span className="shrink-0 text-xs font-bold font-mono px-1.5 py-0.5 rounded bg-success-faded text-success-foreground">
                        {call.method}
                      </span>
                      <span className="text-xs font-mono text-foreground flex-1 truncate">{call.path}</span>
                      <span className="text-xs text-muted-foreground shrink-0 font-mono bg-muted px-1.5 py-0.5 rounded">
                        {endpointLabel(call.path)}
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
      )}
    </div>
  );
}
