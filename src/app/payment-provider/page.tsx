'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { PppCallLogEntry, PppPaymentRecord, PppConfig, PppScenario } from '@/types/ppp';

// ── Educational content per endpoint ─────────────────────────────────────────

type EndpointDoc = {
  title: string;
  what: string;
  why: string;
  keyFields: Array<{ field: string; desc: string }>;
  expectedResponse?: string;
};

const ENDPOINT_DOCS: Record<string, EndpointDoc> = {
  manifest: {
    title: 'GET /manifest',
    what: 'Returns the payment methods your connector supports and its global configuration.',
    why: 'VTEX reads this once during connector registration and periodically to sync. It determines which payment options appear at checkout and how settlements are handled.',
    keyFields: [
      { field: 'paymentMethods[].name', desc: 'Must exactly match a VTEX payment method name (e.g. "Visa", "Pix"). Case-sensitive.' },
      { field: 'paymentMethods[].allowsSplit', desc: '"onAuthorize" captures at authorization, "onCapture" captures later, "disabled" no split.' },
      { field: 'autoSettleDelay', desc: 'Window (in hours) VTEX waits before auto-settling. "0" to "720".' },
    ],
    expectedResponse: 'HTTP 200 with a valid manifest object. Any non-200 fails connector registration.',
  },
  'create-payment': {
    title: 'POST /payments',
    what: 'VTEX asks your provider to authorize a payment for a given order.',
    why: 'This is the core transaction. VTEX sends full order context — value, customer, cart, callback URL — and expects an immediate authorization decision or a pending status for async flows.',
    keyFields: [
      { field: 'paymentId', desc: 'Your correlation key for all future calls on this transaction. Echo it back in every response.' },
      { field: 'value', desc: 'Amount in the smallest currency unit (e.g. centavos for BRL).' },
      { field: 'callbackUrl', desc: 'Where to POST the final status if you return pending or undefined. VTEX will poll GET /payments/{id} as well.' },
      { field: 'status (response)', desc: '"approved" completes the order, "denied" triggers error flow, "pending"/"undefined" start async resolution.' },
      { field: 'authorizationId (response)', desc: 'Required when status is approved. VTEX stores this for settlement and refund traceability.' },
    ],
    expectedResponse: 'HTTP 200 always — even for denied payments. Non-200 is treated as a connector error, not a payment denial.',
  },
  settlements: {
    title: 'POST /payments/{id}/settlements',
    what: 'VTEX asks you to capture a previously authorized payment.',
    why: 'Card authorization and capture are separate steps. VTEX calls this after the order is confirmed and ready to fulfil — typically after anti-fraud approval. The settlement amount may differ from the authorized amount.',
    keyFields: [
      { field: 'value', desc: 'Amount to settle — may be less than the original authorization (partial capture).' },
      { field: 'requestId', desc: 'Idempotency key from VTEX. Echo it back to allow safe retries.' },
      { field: 'settleId (response)', desc: 'Your internal settlement reference. VTEX stores this for reconciliation.' },
    ],
    expectedResponse: 'HTTP 200 with settleId, value, and message. Errors should return HTTP 200 with an error code in the body, not a 4xx/5xx.',
  },
  cancellations: {
    title: 'POST /payments/{id}/cancellations',
    what: 'VTEX asks you to void an authorized payment that was never settled.',
    why: 'When an order is cancelled before fulfilment, VTEX must release the authorization hold on the customer\'s card. This endpoint handles that release.',
    keyFields: [
      { field: 'requestId', desc: 'Idempotency key — safe to retry if the response is lost.' },
      { field: 'cancellationId (response)', desc: 'Your void/cancellation reference. Required in the response.' },
    ],
    expectedResponse: 'HTTP 200 with cancellationId. If the payment was already settled, return an error code in the body explaining the conflict.',
  },
  refunds: {
    title: 'POST /payments/{id}/refunds',
    what: 'VTEX asks you to reverse a settled payment, fully or partially.',
    why: 'Post-settlement reversal for returns, disputes, or partial cancellations. Unlike cancellations (which void before capture), refunds happen after money has moved.',
    keyFields: [
      { field: 'value', desc: 'Amount to refund — partial refunds are supported. Must not exceed the settled amount.' },
      { field: 'requestId', desc: 'Idempotency key — retries with the same requestId must return the same refundId.' },
      { field: 'refundId (response)', desc: 'Your reversal reference for reconciliation.' },
    ],
    expectedResponse: 'HTTP 200 with refundId and the refunded value. Multiple calls with the same requestId should be idempotent.',
  },
  'get-payment': {
    title: 'GET /payments/{id}',
    what: 'VTEX polls for the current status of a payment.',
    why: 'Used for async resolution — when POST /payments returned pending or undefined, VTEX periodically polls here until it gets a final status (approved or denied), or until you POST to the callbackUrl.',
    keyFields: [
      { field: 'status', desc: 'Return "approved" or "denied" once the async process completes. While still processing, return "pending".' },
      { field: 'authorizationId', desc: 'Required in the response once status becomes "approved".' },
    ],
    expectedResponse: 'HTTP 200. VTEX will keep polling at increasing intervals. POST to callbackUrl to push the final status proactively and stop polling.',
  },
};

function docKeyFromPath(method: string, path: string): string {
  if (path.endsWith('/manifest')) return 'manifest';
  if (path.endsWith('/settlements')) return 'settlements';
  if (path.endsWith('/cancellations')) return 'cancellations';
  if (path.endsWith('/refunds')) return 'refunds';
  if (/\/payments\/[^/]+$/.test(path) && method === 'GET') return 'get-payment';
  if (/\/payments$/.test(path) && method === 'POST') return 'create-payment';
  return '';
}

// ── Flow diagram ──────────────────────────────────────────────────────────────

type StepStatus = 'waiting' | 'passed' | 'failed';

type FlowStep = { label: string; sub: string; key: string; status: StepStatus };

function computeFlowSteps(calls: PppCallLogEntry[]): FlowStep[] {
  function hit(fn: (c: PppCallLogEntry) => boolean): PppCallLogEntry | undefined {
    return calls.find(fn);
  }

  const manifest = hit(c => c.method === 'GET' && c.path.endsWith('/manifest'));
  const createPmt = hit(c => c.method === 'POST' && /\/payments$/.test(c.path));
  const settle = hit(c => c.method === 'POST' && c.path.endsWith('/settlements'));
  const cancel = hit(c => c.method === 'POST' && c.path.endsWith('/cancellations'));
  const refund = hit(c => c.method === 'POST' && c.path.endsWith('/refunds'));

  function s(entry: PppCallLogEntry | undefined): StepStatus {
    if (!entry) return 'waiting';
    return entry.httpStatus === 200 ? 'passed' : 'failed';
  }

  return [
    { label: 'Manifest', sub: 'GET /manifest', key: 'manifest', status: s(manifest) },
    { label: 'Create Payment', sub: 'POST /payments', key: 'create-payment', status: s(createPmt) },
    { label: 'Settlement', sub: 'POST /…/settlements', key: 'settlements', status: s(settle) },
    { label: 'Cancellation', sub: 'POST /…/cancellations', key: 'cancellations', status: s(cancel) },
    { label: 'Refund', sub: 'POST /…/refunds', key: 'refunds', status: s(refund) },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function methodColor(method: string) {
  if (method === 'GET') return 'bg-sky-500/15 text-sky-400';
  if (method === 'POST') return 'bg-emerald-500/15 text-emerald-400';
  if (method === 'DELETE') return 'bg-red-500/15 text-red-400';
  return 'bg-white/10 text-white/50';
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return 'text-emerald-400';
  if (status >= 400) return 'text-red-400';
  return 'text-yellow-400';
}

function scenarioColor(s: PppScenario) {
  if (s === 'approved') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
  if (s === 'denied') return 'bg-red-500/15 text-red-400 border-red-500/20';
  if (s === 'pending') return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20';
  return 'bg-white/5 text-white/40 border-white/10';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(iso).toLocaleTimeString();
}

const SCENARIOS: PppScenario[] = ['approved', 'denied', 'pending', 'undefined'];

const SCENARIO_LABELS: Record<PppScenario, string> = {
  approved: 'Approved',
  denied: 'Denied',
  pending: 'Pending (async)',
  undefined: 'Undefined',
};

const SCENARIO_DESC: Record<PppScenario, string> = {
  approved: 'Payment is authorized immediately. VTEX proceeds to fulfil the order.',
  denied: 'Payment is rejected. VTEX shows an error to the customer and does not complete the order.',
  pending: 'Authorization is delayed. VTEX polls GET /payments/{id} and waits for the callback POST to the callbackUrl.',
  undefined: 'Provider-side uncertainty. Treated like pending — VTEX waits for async resolution before proceeding.',
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PaymentProviderPage() {
  const [calls, setCalls] = useState<PppCallLogEntry[]>([]);
  const [, setPayments] = useState<PppPaymentRecord[]>([]);
  const [config, setConfig] = useState<PppConfig>({ scenario: 'approved' });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [baseUrl, setBaseUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setBaseUrl(`${window.location.origin}/api/payment-provider/${config.scenario}`);
  }, [config.scenario]);

  const fetchData = useCallback(async () => {
    try {
      const [callsRes, configRes] = await Promise.all([
        fetch('/api/payment-provider/calls'),
        fetch('/api/payment-provider/config'),
      ]);
      if (callsRes.ok) {
        const data = await callsRes.json() as { calls: PppCallLogEntry[]; payments: PppPaymentRecord[] };
        setCalls(prev => JSON.stringify(prev) === JSON.stringify(data.calls) ? prev : data.calls);
        setPayments(prev => JSON.stringify(prev) === JSON.stringify(data.payments) ? prev : data.payments);
      }
      if (configRes.ok) {
        const cfg = await configRes.json() as PppConfig;
        setConfig(prev => prev.scenario === cfg.scenario ? prev : cfg);
      }
    } catch {
      // silent — polling
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => clearInterval(id);
  }, [fetchData]);

  async function setScenario(scenario: PppScenario) {
    await fetch('/api/payment-provider/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    setConfig({ scenario });
  }

  async function clearAll() {
    setClearing(true);
    await fetch('/api/payment-provider/calls', { method: 'DELETE' });
    setCalls([]);
    setPayments([]);
    setClearing(false);
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

  const flowSteps = computeFlowSteps(calls);
  const selectedCall = calls.find(c => c.id === selectedKey);
  const contextDocKey = selectedCall
    ? docKeyFromPath(selectedCall.method, selectedCall.path)
    : null;
  const contextDoc = contextDocKey ? ENDPOINT_DOCS[contextDocKey] : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d1826' }}>

      {/* Top bar */}
      <header className="border-b border-white/10 px-6 h-14 flex items-center gap-4 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
          All tools
        </Link>
        <span className="text-white/10">|</span>
        <span className="text-sm font-semibold text-white/80">Payment Provider Simulator</span>
        <div className="flex-1" />
        {/* Base URL */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/30 hidden sm:block">Test suite base URL:</span>
          <code className="text-[11px] font-mono text-white/50 bg-white/5 px-2 py-1 rounded hidden sm:block max-w-xs truncate">
            {baseUrl || '…/api/payment-provider'}
          </code>
          <button
            onClick={copyBaseUrl}
            className="text-xs px-2.5 py-1 rounded border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </header>

      {/* Flow diagram */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {flowSteps.map((step, i) => (
            <div key={step.key} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setSelectedKey(null)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-1.5">
                  <span className={[
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                    step.status === 'passed' ? 'bg-emerald-500/20 text-emerald-400' :
                    step.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-white/5 text-white/30',
                  ].join(' ')}>
                    {step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : i + 1}
                  </span>
                  <span className={[
                    'text-xs font-medium',
                    step.status === 'passed' ? 'text-emerald-400' :
                    step.status === 'failed' ? 'text-red-400' :
                    'text-white/40',
                  ].join(' ')}>
                    {step.label}
                  </span>
                </div>
                <span className="text-[10px] text-white/20 font-mono">{step.sub}</span>
              </button>
              {i < flowSteps.length - 1 && (
                <svg className="w-4 h-4 text-white/10 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 10h10M10 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
          <div className="flex-1" />
          <button
            onClick={clearAll}
            disabled={clearing || calls.length === 0}
            className="text-xs text-white/20 hover:text-white/50 transition-colors disabled:opacity-40 shrink-0 ml-4"
          >
            {clearing ? 'Clearing…' : 'Clear'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Call log */}
        <div className="flex-1 min-w-0 overflow-auto border-r border-white/10">
          {calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center px-8 space-y-3">
              <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20M6 15h4" strokeLinecap="round" />
              </svg>
              <p className="text-sm text-white/30">No calls received yet</p>
              <p className="text-xs text-white/20 max-w-xs leading-relaxed">
                Configure your VTEX payment connector to point to the base URL above, then run the test suite.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {calls.map(call => {
                const expanded = expandedIds.has(call.id);
                const active = selectedKey === call.id;
                return (
                  <div
                    key={call.id}
                    className={['transition-colors', active ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'].join(' ')}
                  >
                    <div
                      className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                      onClick={() => { setSelectedKey(call.id); toggleExpand(call.id); }}
                    >
                      <span className={`shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${methodColor(call.method)}`}>
                        {call.method}
                      </span>
                      <span className="text-xs font-mono text-white/60 flex-1 truncate">{call.path}</span>
                      <span className={`text-xs font-mono shrink-0 ${statusColor(call.httpStatus)}`}>
                        {call.httpStatus}
                      </span>
                      <span className="text-[11px] text-white/20 shrink-0">{call.durationMs}ms</span>
                      <span className="text-[11px] text-white/20 shrink-0 hidden sm:block">{relativeTime(call.timestamp)}</span>
                      <svg
                        className={['w-3.5 h-3.5 text-white/20 shrink-0 transition-transform', expanded ? 'rotate-90' : ''].join(' ')}
                        viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="M7 5l5 5-5 5" />
                      </svg>
                    </div>
                    {expanded && (
                      <div className="px-5 pb-4 grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Request</span>
                          <pre className="text-[11px] font-mono text-white/50 bg-white/5 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                            {call.requestBody ? JSON.stringify(call.requestBody, null, 2) : '—'}
                          </pre>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Response</span>
                          <pre className="text-[11px] font-mono text-white/50 bg-white/5 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                            {call.responseBody ? JSON.stringify(call.responseBody, null, 2) : '—'}
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

        {/* Context panel */}
        <div className="w-80 shrink-0 overflow-auto flex flex-col">

          {/* Scenario selector — always visible */}
          <div className="px-5 py-4 border-b border-white/10 space-y-3">
            <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block">Response scenario</span>
            <div className="space-y-1.5">
              {SCENARIOS.map(s => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className={[
                    'w-full text-left rounded-lg border px-3 py-2.5 transition-all',
                    config.scenario === s
                      ? scenarioColor(s)
                      : 'border-white/5 text-white/30 hover:border-white/10 hover:text-white/50',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className={[
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      config.scenario === s
                        ? s === 'approved' ? 'bg-emerald-400' : s === 'denied' ? 'bg-red-400' : s === 'pending' ? 'bg-yellow-400' : 'bg-white/40'
                        : 'bg-white/10',
                    ].join(' ')} />
                    <span className="text-xs font-medium">{SCENARIO_LABELS[s]}</span>
                  </div>
                  {config.scenario === s && (
                    <p className="text-[11px] mt-1.5 ml-3.5 leading-relaxed opacity-80">{SCENARIO_DESC[s]}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint docs — shown when a call is selected */}
          <div className="flex-1 px-5 py-4">
            {contextDoc ? (
              <div className="space-y-4">
                <div>
                  <code className="text-[11px] font-mono text-white/40 bg-white/5 px-2 py-1 rounded">{contextDoc.title}</code>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block">What this call does</span>
                  <p className="text-xs text-white/50 leading-relaxed">{contextDoc.what}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block">Why it exists</span>
                  <p className="text-xs text-white/50 leading-relaxed">{contextDoc.why}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block">Key fields</span>
                  {contextDoc.keyFields.map(f => (
                    <div key={f.field} className="space-y-0.5">
                      <code className="text-[10px] font-mono text-white/60">{f.field}</code>
                      <p className="text-[11px] text-white/35 leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
                {contextDoc.expectedResponse && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block">Expected response</span>
                    <p className="text-xs text-white/50 leading-relaxed">{contextDoc.expectedResponse}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block">Protocol reference</span>
                <p className="text-xs text-white/25 leading-relaxed">
                  Click any call in the log to see an explanation of what that endpoint does, why it exists in the protocol, and what VTEX expects in the response.
                </p>
                <div className="mt-4 space-y-2">
                  {Object.values(ENDPOINT_DOCS).map(doc => (
                    <div key={doc.title} className="text-[11px] text-white/20 py-1 border-b border-white/5">
                      <code className="font-mono">{doc.title}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
