'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import type { GcCallLogEntry, GiftCardRecord, GcConfig, GcScenario } from '@/types/giftCard';

// ── Helpers ───────────────────────────────────────────────────────────────────

function methodColor(method: string) {
  if (method === 'GET') return 'bg-sky-500/15 text-sky-400';
  if (method === 'POST') return 'bg-emerald-500/15 text-emerald-400';
  return 'bg-white/10 text-white/50';
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return 'text-emerald-400';
  if (status >= 400) return 'text-red-400';
  return 'text-yellow-400';
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
  { key: 'search', label: 'Search', sub: 'POST /_search', desc: 'VTEX calls this when the customer reaches the payment step. Returns matching gift cards for the email.' },
  { key: 'get-card', label: 'Get Card', sub: 'GET /{id}', desc: 'VTEX fetches the full card details and current balance after the customer selects the card.' },
  { key: 'create-transaction', label: 'Debit', sub: 'POST /transactions', desc: 'VTEX creates a debit transaction when the customer confirms the order.' },
  { key: 'settle', label: 'Settle', sub: 'POST /settlements', desc: 'VTEX confirms the settlement after successful order placement.' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function GiftCardPage() {
  const [account, setAccount] = useState('');
  const [accountInput, setAccountInput] = useState('');
  const [config, setConfig] = useState<GcConfig>({ scenario: 'approved', mockBalance: 9999 });
  const [cards, setCards] = useState<GiftCardRecord[]>([]);
  const [calls, setCalls] = useState<GcCallLogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [balanceInput, setBalanceInput] = useState('9999');
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const serviceUrl =
    account
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/gift-card/${account}`
      : '';

  const load = useCallback(async () => {
    if (!account) return;
    try {
      const res = await fetch(`/api/gift-card/${account}/config`);
      const data = await res.json();
      setConfig(data.config);
      setCards(data.cards);
      setCalls(data.calls);
      setBalanceInput(String(data.config.mockBalance));
    } catch {
      // ignore fetch errors during polling
    }
  }, [account]);

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  function applyAccount() {
    setAccount(accountInput.trim());
  }

  async function saveConfig(scenario: GcScenario, balance: number) {
    if (!account) return;
    setSavingConfig(true);
    await fetch(`/api/gift-card/${account}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, mockBalance: balance }),
    });
    await load();
    setSavingConfig(false);
  }

  async function clearData() {
    if (!account) return;
    await fetch(`/api/gift-card/${account}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    });
    await load();
  }

  function copyUrl() {
    navigator.clipboard.writeText(serviceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Derive flow step statuses from calls
  const hitEndpoints = new Set(calls.map(c => c.endpoint));
  const failedEndpoints = new Set(calls.filter(c => c.httpStatus >= 400).map(c => c.endpoint));

  function stepStatus(key: string): 'waiting' | 'passed' | 'failed' {
    if (failedEndpoints.has(key)) return 'failed';
    if (hitEndpoints.has(key)) return 'passed';
    return 'waiting';
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a1628', color: '#e2e8f0' }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-white/40 hover:text-white/80 transition-colors"
            title="All tools"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4l-6 6 6 6" />
            </svg>
          </Link>
          <span className="text-white/20 text-sm">/</span>
          <span className="text-sm font-semibold text-white/80">Gift Card Provider</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">Mock</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://developers.vtex.com/docs/api-reference/giftcard-provider-protocol"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Protocol docs
          </a>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col gap-6 px-6 py-6 max-w-6xl w-full mx-auto">

        {/* Account row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <input
              value={accountInput}
              onChange={e => setAccountInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyAccount()}
              placeholder="VTEX account name"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25"
            />
            <button
              onClick={applyAccount}
              disabled={!accountInput.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/8 hover:bg-white/12 text-white/70 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
          {account && (
            <span className="text-xs text-white/30 font-mono">
              scoped to <span className="text-white/60">{account}</span>
            </span>
          )}
        </div>

        {/* Service URL */}
        {account && (
          <div className="rounded-xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <p className="text-sm font-medium text-white/70 mb-0.5">Provider Service URL</p>
                <p className="text-xs text-white/30">Register this URL in VTEX Gift Card Hub as the provider <code className="text-amber-400/70">serviceUrl</code></p>
              </div>
              <button
                onClick={copyUrl}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:border-white/20 text-white/50 hover:text-white transition-colors"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code className="block text-sm font-mono text-amber-400/80 bg-black/20 rounded-lg px-3 py-2 break-all">
              {serviceUrl}
            </code>

            <div className="mt-3 pt-3 border-t border-white/6 space-y-2">
              <p className="text-xs text-white/30">Register via VTEX Hub API</p>

              <div>
                <p className="text-[10px] text-white/20 mb-1 font-mono">PowerShell</p>
                <pre className="text-[11px] font-mono text-white/40 bg-black/20 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre">
{`$body = '{"serviceUrl":"${serviceUrl}","appKey":"demo-key","appToken":"demo-token","oauthProvider":"vtex","preAuthEnabled":false,"cancelEnabled":true}'
Invoke-RestMethod -Method PUT \`
  -Uri "https://{vtexAccount}.vtexcommercestable.com.br/api/giftcardproviders/DemoGiftCard" \`
  -Headers @{"X-VTEX-API-AppKey"="{appKey}";"X-VTEX-API-AppToken"="{appToken}";"Content-Type"="application/json"} \`
  -Body $body`}
                </pre>
              </div>

              <div>
                <p className="text-[10px] text-white/20 mb-1 font-mono">bash / curl</p>
                <pre className="text-[11px] font-mono text-white/40 bg-black/20 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre">
{`curl -X PUT "https://{vtexAccount}.vtexcommercestable.com.br/api/giftcardproviders/DemoGiftCard" -H "X-VTEX-API-AppKey: {appKey}" -H "X-VTEX-API-AppToken: {appToken}" -H "Content-Type: application/json" -d '{"serviceUrl":"${serviceUrl}","appKey":"demo-key","appToken":"demo-token","oauthProvider":"vtex","preAuthEnabled":false,"cancelEnabled":true}'`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Flow + Config row */}
        {account && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Checkout flow */}
            <div className="rounded-xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-sm font-medium text-white/70 mb-4">Checkout Flow</p>
              <div className="flex items-start gap-0">
                {FLOW_STEPS.map((step, i) => {
                  const st = stepStatus(step.key);
                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center">
                      <div className="flex items-center w-full">
                        {i > 0 && (
                          <div className={`h-px flex-1 ${st === 'passed' ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
                        )}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border
                          ${st === 'passed' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' :
                            st === 'failed' ? 'bg-red-500/15 border-red-500/40 text-red-400' :
                            'bg-white/5 border-white/15 text-white/30'}`
                        }>
                          {st === 'passed' ? '✓' : st === 'failed' ? '✗' : i + 1}
                        </div>
                        {i < FLOW_STEPS.length - 1 && (
                          <div className={`h-px flex-1 ${st === 'passed' ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-white/60 mt-2 text-center">{step.label}</p>
                      <p className="text-[10px] text-white/25 text-center font-mono">{step.sub}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Config */}
            <div className="rounded-xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">Scenario</p>
                {savingConfig && <span className="text-xs text-white/30">Saving...</span>}
              </div>
              <div className="flex gap-2 mb-4">
                {(['approved', 'empty'] as GcScenario[]).map(s => (
                  <button
                    key={s}
                    onClick={() => saveConfig(s, Number(balanceInput) || 9999)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      config.scenario === s
                        ? s === 'approved'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : 'bg-white/8 border-white/20 text-white/60'
                        : 'bg-white/3 border-white/8 text-white/30 hover:text-white/60'
                    }`}
                  >
                    {s === 'approved' ? 'Return card' : 'No cards'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-white/40 shrink-0">Mock balance</label>
                <input
                  value={balanceInput}
                  onChange={e => setBalanceInput(e.target.value)}
                  onBlur={() => saveConfig(config.scenario, Number(balanceInput) || 9999)}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-white/25"
                  type="number"
                  min={1}
                />
                <button
                  onClick={clearData}
                  className="text-xs text-white/25 hover:text-red-400 transition-colors"
                  title="Clear all cards and calls"
                >
                  Clear
                </button>
              </div>
              <p className="text-[11px] text-white/25 mt-2">
                {config.scenario === 'approved'
                  ? `Any customer email returns a card with balance ${config.mockBalance}. Same email always gets the same card.`
                  : 'Search returns an empty array — no gift card appears at checkout.'}
              </p>
            </div>
          </div>
        )}

        {/* Active cards */}
        {account && cards.length > 0 && (
          <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="px-4 py-3 border-b border-white/8">
              <p className="text-sm font-medium text-white/70">Active Cards <span className="text-white/30 text-xs ml-1">{cards.length}</span></p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6">
                  <th className="text-left px-4 py-2 text-xs text-white/30 font-medium">Card ID</th>
                  <th className="text-left px-4 py-2 text-xs text-white/30 font-medium">Owner (email)</th>
                  <th className="text-left px-4 py-2 text-xs text-white/30 font-medium">Code</th>
                  <th className="text-right px-4 py-2 text-xs text-white/30 font-medium">Balance</th>
                  <th className="text-right px-4 py-2 text-xs text-white/30 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {cards.map(card => (
                  <tr key={card.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-white/60">{card.id}</td>
                    <td className="px-4 py-2.5 text-xs text-white/60">{card.owner}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-amber-400/70">{card.redemptionCode}</td>
                    <td className="px-4 py-2.5 text-xs text-emerald-400 text-right font-mono">{card.initialBalance}</td>
                    <td className="px-4 py-2.5 text-xs text-white/30 text-right">{relativeTime(card.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Call log */}
        {account && (
          <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <p className="text-sm font-medium text-white/70">
                Call Log <span className="text-white/30 text-xs ml-1">{calls.length}</span>
              </p>
              {calls.length === 0 && (
                <span className="text-xs text-white/25 italic">Waiting for VTEX to call the protocol endpoints...</span>
              )}
            </div>

            {calls.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/20 text-sm">
                No calls yet. Add a product to cart in your VTEX store, go to checkout, enter an email, and reach the payment step.
              </div>
            ) : (
              <div className="divide-y divide-white/4">
                {calls.map(call => (
                  <div key={call.id}>
                    <button
                      onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors text-left"
                    >
                      <span className={`shrink-0 text-[11px] font-mono px-1.5 py-0.5 rounded ${methodColor(call.method)}`}>
                        {call.method}
                      </span>
                      <span className="text-xs font-mono text-white/50 flex-1 truncate">{call.path}</span>
                      <span className="text-[11px] text-white/35 shrink-0 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                        {endpointLabel(call.endpoint)}
                      </span>
                      <span className={`shrink-0 text-xs font-mono font-semibold ${statusColor(call.httpStatus)}`}>
                        {call.httpStatus}
                      </span>
                      <span className="shrink-0 text-[11px] text-white/25">{call.durationMs}ms</span>
                      <span className="shrink-0 text-[11px] text-white/20">{relativeTime(call.timestamp)}</span>
                      <svg
                        className={`w-3.5 h-3.5 shrink-0 text-white/20 transition-transform ${expandedCall === call.id ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {expandedCall === call.id && (
                      <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] text-white/30 mb-1">Request body</p>
                          <pre className="text-[11px] font-mono text-white/50 bg-black/20 rounded-lg p-3 overflow-auto max-h-48">
                            {JSON.stringify(call.requestBody ?? null, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-[11px] text-white/30 mb-1">Response body</p>
                          <pre className="text-[11px] font-mono text-white/50 bg-black/20 rounded-lg p-3 overflow-auto max-h-48">
                            {JSON.stringify(call.responseBody ?? null, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!account && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-4 0v2" />
                <path d="M8 7V5a2 2 0 0 1 4 0" />
                <path d="M12 12v4M10 14h4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white/50">Enter your VTEX account name to begin</p>
            <p className="text-xs text-white/25 max-w-sm">
              Each account gets its own isolated gift card provider endpoint. VTEX will call your service URL when a customer reaches the payment step at checkout.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
