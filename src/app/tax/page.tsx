'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import type { TaxCallLogEntry, TaxConfig, TaxScenario, TaxRule } from '@/types/tax';

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

const SCENARIOS: { value: TaxScenario; label: string; dot: string; desc: string }[] = [
  { value: 'apply', label: 'Apply taxes', dot: 'bg-success', desc: 'Every active rule below is calculated against each item’s price.' },
  { value: 'no-tax', label: 'No tax', dot: 'bg-muted-foreground', desc: 'Returns an empty taxes array for every item — as if no tax applies.' },
  { value: 'error', label: 'Simulate error', dot: 'bg-danger', desc: 'Returns HTTP 500 — shows how Checkout behaves when the provider fails.' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaxProviderPage() {
  const [accountInput, setAccountInput] = useState('');
  const [account, setAccount]           = useState('');
  const [config, setConfig]             = useState<TaxConfig | null>(null);
  const [calls, setCalls]               = useState<TaxCallLogEntry[]>([]);
  const [baseUrl, setBaseUrl]           = useState('');
  const [copied, setCopied]             = useState<string | null>(null);
  const [clearing, setClearing]         = useState(false);
  const [activeTab, setActiveTab]       = useState<'scenario' | 'register' | 'setup'>('scenario');
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set());
  const [newRuleName, setNewRuleName]   = useState('');
  const [newRulePct, setNewRulePct]     = useState('');
  const [newRuleDesc, setNewRuleDesc]   = useState('');
  const configInitialized               = useRef(false);

  // Register tab state
  const [regAppKey, setRegAppKey]     = useState('');
  const [regAppToken, setRegAppToken] = useState('');
  const [regLoading, setRegLoading]   = useState(false);
  const [regResult, setRegResult]     = useState<{ ok: boolean; status: number; data: unknown; sentBody?: unknown } | null>(null);
  const [regAction, setRegAction]     = useState<'get' | 'register' | null>(null);

  // Restore state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tax_account') ?? '';
    setAccountInput(saved);
    setAccount(saved);
    setRegAppKey(localStorage.getItem('tax_reg_appkey') ?? '');
    setRegAppToken(localStorage.getItem('tax_reg_apptoken') ?? '');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !account) return;
    setBaseUrl(`${window.location.origin}/api/tax/${account}/calculate-tax`);
  }, [account]);

  const fetchData = useCallback(async () => {
    if (!account) return;
    try {
      const res = await fetch(`/api/tax/${account}/config`);
      if (!res.ok) return;
      const data = await res.json() as { config: TaxConfig; calls: TaxCallLogEntry[] };

      setCalls(prev => {
        const incoming = data.calls ?? [];
        if (!incoming.length) return prev;
        const existingIds = new Set(prev.map(c => c.id));
        const added = incoming.filter(c => !existingIds.has(c.id));
        return added.length ? [...added, ...prev] : prev;
      });

      if (!configInitialized.current) {
        setConfig(data.config);
        configInitialized.current = true;
      } else {
        setConfig(data.config);
      }
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
    localStorage.setItem('tax_account', trimmed);
  }

  async function patchConfig(patch: Record<string, unknown>) {
    if (!account) return;
    const res = await fetch(`/api/tax/${account}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json() as { config: TaxConfig };
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
    const percentage = Number(newRulePct);
    if (!newRuleName.trim() || !percentage || percentage <= 0) return;
    patchConfig({ addRule: { name: newRuleName.trim(), description: newRuleDesc.trim(), percentage } });
    setNewRuleName('');
    setNewRulePct('');
    setNewRuleDesc('');
  }

  function saveRegCreds(key: string, token: string) {
    setRegAppKey(key);
    setRegAppToken(token);
    localStorage.setItem('tax_reg_appkey', key);
    localStorage.setItem('tax_reg_apptoken', token);
  }

  async function registerCall(action: 'get' | 'register') {
    if (!account || !regAppKey || !regAppToken || !config) return;
    setRegLoading(true);
    setRegAction(action);
    setRegResult(null);
    try {
      const res = await fetch(`/api/tax/${account}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          appKey: regAppKey,
          appToken: regAppToken,
          serviceUrl: baseUrl,
          authorizationHeader: config.authorizationHeader,
          isMarketplaceResponsibleForTaxes: config.isMarketplaceResponsibleForTaxes,
        }),
      });
      const data = await res.json();
      setRegResult(data);
    } catch (e) {
      setRegResult({ ok: false, status: 0, data: { error: String(e) } });
    } finally {
      setRegLoading(false);
    }
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
          <span className="text-sm font-semibold text-foreground">Tax Provider</span>
        </div>

        <div className="flex flex-col items-center justify-center min-w-0">
          {account ? (
            <>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Provider service URL</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-foreground truncate max-w-xs">{baseUrl}</span>
                <button
                  onClick={() => copy('url', baseUrl)}
                  title="Copy URL"
                  className={`shrink-0 transition-colors ${copied === 'url' ? 'text-success-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {copied === 'url' ? (
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
                <circle cx="12" cy="12" r="9" />
                <path d="M9 15l6-6M9.5 10a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM14.5 15a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Connect your VTEX account</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Enter your VTEX account name to generate this simulator&apos;s Tax Service provider URL.
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
            {([['scenario', 'Scenario'], ['register', 'Register'], ['setup', 'Setup']] as const).map(([val, label]) => (
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
                  <div className="rounded-md px-3 py-2 space-y-1 bg-muted border border-border">
                    <p className="text-xs text-muted-foreground">Register this as taxConfiguration.url in the Register tab</p>
                    <p className="text-xs font-mono text-foreground break-all">{baseUrl}</p>
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

                {/* Authorization secret */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Authorization header</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    VTEX echoes this value back verbatim on every call. A mismatch returns 401.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs font-mono text-foreground bg-muted border border-border rounded-md px-3 py-2 truncate">
                      {config.authorizationHeader}
                    </span>
                    <button
                      onClick={() => copy('secret', config.authorizationHeader)}
                      title="Copy"
                      className={`shrink-0 transition-colors ${copied === 'secret' ? 'text-success-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
                    </button>
                  </div>
                  <button
                    onClick={() => patchConfig({ regenerateSecret: true })}
                    className="w-full py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Regenerate
                  </button>
                </div>

                {/* isMarketplaceResponsibleForTaxes */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.isMarketplaceResponsibleForTaxes}
                      onChange={e => patchConfig({ isMarketplaceResponsibleForTaxes: e.target.checked })}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-foreground leading-relaxed">
                      <span className="font-semibold">Marketplace responsible for taxes</span>
                      <br />
                      <span className="text-muted-foreground">When off, each seller is expected to have its own tax service configuration.</span>
                    </span>
                  </label>
                </div>

                {/* Tax rules */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Tax rules <span className="normal-case tracking-normal ml-1">{config.rules.length}</span>
                  </span>
                  <div className="space-y-1.5">
                    {config.rules.map((r: TaxRule) => (
                      <div key={r.id} className="rounded-md px-3 py-2 space-y-1 bg-muted border border-border">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground truncate">{r.name}</span>
                          <span className="text-xs font-mono text-success-foreground shrink-0">{r.percentage}%</span>
                        </div>
                        {r.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                        )}
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
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRuleName}
                        onChange={e => setNewRuleName(e.target.value)}
                        placeholder="Tax name"
                        className="flex-1 text-xs rounded-md px-2 py-1.5 outline-none border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                      />
                      <input
                        type="number"
                        value={newRulePct}
                        onChange={e => setNewRulePct(e.target.value)}
                        placeholder="%"
                        min={0}
                        max={100}
                        className="w-16 text-xs rounded-md px-2 py-1.5 outline-none font-mono border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                      />
                      <button
                        onClick={addRule}
                        disabled={!newRuleName.trim() || !newRulePct}
                        className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newRuleDesc}
                      onChange={e => setNewRuleDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full text-xs rounded-md px-2 py-1.5 outline-none border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Register tab ── */}
            {activeTab === 'register' && (
              <div className="p-4 space-y-5">

                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">VTEX Admin Credentials</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">Used to read and update this account&apos;s orderForm configuration.</p>
                  <input
                    type="text"
                    value={regAppKey}
                    onChange={e => saveRegCreds(e.target.value, regAppToken)}
                    placeholder="App Key"
                    className="w-full text-xs rounded-md px-3 py-2 outline-none font-mono border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="password"
                    value={regAppToken}
                    onChange={e => saveRegCreds(regAppKey, e.target.value)}
                    placeholder="App Token"
                    className="w-full text-xs rounded-md px-3 py-2 outline-none font-mono border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">Credentials are saved in your browser only — never sent to our server except to proxy the VTEX call.</p>
                </div>

                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Get current config</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">GET /api/checkout/pvt/configuration/orderForm</code><br />
                    Shows the account&apos;s current taxConfiguration, if any.
                  </p>
                  <button
                    onClick={() => registerCall('get')}
                    disabled={regLoading || !regAppKey || !regAppToken}
                    className="w-full py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-30 flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {regLoading && regAction === 'get' ? (
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10h10M10 5l5 5-5 5"/></svg>
                    )}
                    GET orderForm config
                  </button>
                </div>

                <div className="space-y-2 pb-4 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Register this provider</span>
                  <div className="rounded-md px-3 py-2.5 space-y-1.5 text-xs bg-muted border border-border">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">url</span>
                      <span className="font-mono text-foreground truncate max-w-[160px]" title={baseUrl}>{baseUrl}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">authorizationHeader</span>
                      <span className="font-mono text-success-foreground truncate max-w-[160px]">{config.authorizationHeader}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">isMarketplaceResponsibleForTaxes</span>
                      <span className="font-mono text-foreground">{String(config.isMarketplaceResponsibleForTaxes)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Fetches the current orderForm config and merges these fields into <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">taxConfiguration</code> — the spec requires sending the entire orderForm back.
                  </p>
                  <button
                    onClick={() => registerCall('register')}
                    disabled={regLoading || !regAppKey || !regAppToken || !baseUrl}
                    className="w-full py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-30 flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {regLoading && regAction === 'register' ? (
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3v14M3 10h14" strokeLinecap="round"/></svg>
                    )}
                    Register Provider
                  </button>
                </div>

                {regResult && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response</span>
                      <span className={`text-xs font-mono font-semibold ${regResult.ok ? 'text-success-foreground' : 'text-danger-foreground'}`}>
                        {regResult.status}
                      </span>
                    </div>
                    {regResult.sentBody != null && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Sent taxConfiguration</p>
                        <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded-md px-3 py-2 overflow-auto max-h-32">
                          {JSON.stringify(regResult.sentBody, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">VTEX response</p>
                      <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded-md px-3 py-2 overflow-auto max-h-52">
                        {JSON.stringify(regResult.data, null, 2)}
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
                  <p className="text-xs font-semibold text-foreground">How the Tax Service protocol works</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Unlike the other simulators, there’s no manifest or hub API — VTEX Checkout calls one URL you register on the account’s orderForm configuration.
                  </p>
                </div>

                {[
                  { n: 1, title: 'Set your VTEX account', body: 'Enter your account name in the Scenario tab. The provider service URL and Authorization secret will appear.' },
                  { n: 2, title: 'Register the provider', body: 'Use the Register tab to fetch the current orderForm config and update its taxConfiguration in one step.' },
                  { n: 3, title: 'Test at checkout', body: 'Add a product to cart and reach checkout. Every cart change triggers a call to this simulator — watch it appear in the call log.' },
                  { n: 4, title: 'Try the scenarios', body: 'Toggle No tax or Simulate error in the Scenario tab and repeat checkout to show how Checkout reacts to each response.' },
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

                <div className="space-y-3 pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manual registration (curl)</p>
                  <pre className="text-xs font-mono text-foreground bg-muted border border-border rounded-md px-3 py-2 overflow-x-auto whitespace-pre">
{`curl -X POST "https://{account}.vtexcommercestable.com.br/api/checkout/pvt/configuration/orderForm" \\
  -H "X-VTEX-API-AppKey: {appKey}" -H "X-VTEX-API-AppToken: {appToken}" \\
  -H "Content-Type: application/json" \\
  -d '{"taxConfiguration":{"url":"${baseUrl}","authorizationHeader":"${config.authorizationHeader}","appId":"${account}-TaxMock","isMarketplaceResponsibleForTaxes":true}}'`}
                  </pre>
                  <p className="text-xs text-warning-foreground leading-relaxed">
                    The real endpoint requires the entire orderForm object in the body — the Register tab handles that merge for you.
                  </p>
                </div>

                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Official references</p>
                  {[
                    { label: 'Tax Service — overview', href: 'https://developers.vtex.com/docs/guides/tax-services-overview' },
                    { label: 'Tax Service — specification', href: 'https://developers.vtex.com/docs/guides/tax-services-specification' },
                    { label: 'Tax Service — integration guide', href: 'https://developers.vtex.com/docs/guides/tax-service-integration-guide' },
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
                <circle cx="12" cy="12" r="9" />
                <path d="M9 15l6-6" />
              </svg>
              <p className="text-sm text-foreground">No calls received yet</p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Register the provider URL in the account&apos;s orderForm, then add an item to cart and reach checkout to trigger the first calculate-tax call.
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
