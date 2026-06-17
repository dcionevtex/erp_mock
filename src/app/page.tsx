'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { StatusItem } from '@/app/api/status/route';

// ── VTEX Status Carousel ──────────────────────────────────────────────────────

const STATUS_META: Record<StatusItem['status'], { label: string; dot: string; text: string; bg: string }> = {
  resolved:      { label: 'Resolved',      dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'rgba(52,211,153,0.08)'  },
  monitoring:    { label: 'Monitoring',     dot: 'bg-yellow-400',  text: 'text-yellow-400',  bg: 'rgba(250,204,21,0.08)'  },
  investigating: { label: 'Investigating',  dot: 'bg-red-400',     text: 'text-red-400',     bg: 'rgba(248,113,113,0.08)' },
  identified:    { label: 'Identified',     dot: 'bg-orange-400',  text: 'text-orange-400',  bg: 'rgba(251,146,60,0.08)'  },
  maintenance:   { label: 'Maintenance',    dot: 'bg-violet-400',  text: 'text-violet-400',  bg: 'rgba(167,139,250,0.08)' },
  update:        { label: 'Update',         dot: 'bg-sky-400',     text: 'text-sky-400',     bg: 'rgba(56,189,248,0.08)'  },
  unknown:       { label: 'Incident',       dot: 'bg-white/40',    text: 'text-white/50',    bg: 'rgba(255,255,255,0.04)' },
};

function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    const diff = Date.now() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function stripBrackets(title: string): string {
  return title.replace(/^\[.*?\]\s*/, '').trim();
}

function StatusCarousel() {
  const [items, setItems]       = useState<StatusItem[]>([]);
  const [idx, setIdx]           = useState(0);
  const [loading, setLoading]   = useState(true);
  const [paused, setPaused]     = useState(false);
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then((d: { items: StatusItem[] }) => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const next = useCallback(() => setIdx(i => (i + 1) % Math.max(items.length, 1)), [items.length]);
  const prev = useCallback(() => setIdx(i => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1)), [items.length]);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    timerRef.current = setInterval(next, 6000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next, paused, items.length]);

  if (loading) return (
    <div className="h-16 rounded-xl border border-white/6 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <span className="text-xs text-white/20">Loading platform status…</span>
    </div>
  );

  if (items.length === 0) return (
    <div className="h-14 rounded-xl border border-emerald-500/15 flex items-center gap-3 px-4" style={{ background: 'rgba(52,211,153,0.04)' }}>
      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
      <span className="text-sm font-medium text-emerald-400">All systems operational</span>
      <a href="https://status.vtex.com" target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] text-white/20 hover:text-white/50 transition-colors">status.vtex.com ↗</a>
    </div>
  );

  const item = items[idx];
  const meta = STATUS_META[item.status];

  return (
    <div
      className="rounded-xl border border-white/8 overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">VTEX Platform Status</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://status.vtex.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-white/20 hover:text-white/50 transition-colors">status.vtex.com ↗</a>
          {items.length > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={prev} className="w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-white/60 transition-colors">
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 4l-6 6 6 6"/></svg>
              </button>
              <span className="text-[10px] text-white/20 tabular-nums">{idx + 1}/{items.length}</span>
              <button onClick={next} className="w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-white/60 transition-colors">
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 4l6 6-6 6"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Incident card */}
      <a href={item.link || 'https://status.vtex.com'} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-start gap-3">
          <span className={`shrink-0 mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.text}`} style={{ background: meta.bg }}>
            {meta.label}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/80 truncate">{stripBrackets(item.title)}</p>
            <p className="text-[11px] text-white/30 mt-0.5 line-clamp-1">{item.summary}</p>
          </div>
          <span className="shrink-0 text-[11px] text-white/20 mt-0.5">{formatDate(item.pubDate)}</span>
        </div>
      </a>

      {/* Dot indicators */}
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1 pb-2">
          {items.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className={`rounded-full transition-all ${i === idx ? 'w-4 h-1.5 bg-white/40' : 'w-1.5 h-1.5 bg-white/15 hover:bg-white/30'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

const TOOLS = [
  {
    href: '/erp',
    label: 'ERP Simulator',
    description: 'Simulate the VTEX OMS to ERP order handoff. Receive orders via Feed or Hook, run the full processing pipeline, and inspect every step in a live inbox.',
    tag: 'Live',
    tagColor: 'bg-emerald-500/15 text-emerald-400',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="18" rx="2" />
        <path d="M2 8h20" />
        <path d="M6 13h5M6 17h9" />
      </svg>
    ),
  },
  {
    href: '/payment-provider',
    label: 'Payment Provider Simulator',
    description: 'Implement and test the VTEX Payment Provider Protocol. Expose all required endpoints, run the official test suite against them, and inspect every request and response with inline protocol documentation.',
    tag: 'Live',
    tagColor: 'bg-emerald-500/15 text-emerald-400',
    disabled: false,
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
        <circle cx="17" cy="15" r="1.5" />
      </svg>
    ),
  },
  {
    href: '/marketplace',
    label: 'External Seller Simulator',
    description: 'Simulate the VTEX External Seller Fulfillment protocol. Expose all required seller endpoints, run fulfillment simulation, order placement, authorization, and cancellation flows with live call inspection.',
    tag: 'Beta',
    tagColor: 'bg-sky-500/15 text-sky-400',
    disabled: false,
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M9 22V12h6v10" />
        <path d="M15 6h2M15 9h2" />
      </svg>
    ),
  },
  {
    href: '/gift-card',
    label: 'Gift Card Provider',
    description: 'Mock the VTEX Gift Card Provider Protocol. Any customer email at checkout returns a fictional gift card with a configurable balance. VTEX calls your endpoint — no real provider needed.',
    tag: 'Beta',
    tagColor: 'bg-amber-500/15 text-amber-400',
    disabled: false,
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-4 0v2" />
        <path d="M8 7V5a2 2 0 0 1 4 0" />
        <path d="M12 12v4M10 14h4" />
      </svg>
    ),
  },
];

const FIELD_TOOLS = [
  {
    href: 'https://accounthandler.vtexdemo.shop/',
    label: 'Account Handler',
    description: 'Deploy one account\'s full configuration to a brand-new VTEX account in a single step. Built for spinning up demo environments without manual setup.',
    author: 'KAI',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    href: 'https://ps-proposals-ruby.vercel.app/',
    label: 'PS Proposal Request',
    description: 'Open a Professional Services request for quote with the SA team. Use this when a deal needs scoped delivery beyond standard implementation.',
    author: 'SA Team',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: 'https://github.com/Willjeanne/merchantspace',
    label: 'MerchantSpace',
    description: 'A full external seller portal built on the VTEX External Seller Fulfillment protocol. A reference implementation showing partners and customers how to build a complete seller center connected to VTEX marketplace.',
    author: 'William Jeanne',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M9 22V12h6v10" />
      </svg>
    ),
  },
];

const LAB_APPS = [
  {
    label: 'Email Translator',
    description: 'Translate VTEX transactional emails into any language for international demos.',
    icon: '✉',
  },
  {
    label: 'Gift Card Generator',
    description: 'Create and test gift card flows without touching a live account.',
    icon: '🎁',
  },
  {
    label: 'Checkout Validator',
    description: 'Inspect and debug checkout payloads in real time.',
    icon: '✓',
  },
];

// 8-bit pixel paintbrush icon for Claude Skills
function PixelBrush() {
  const px = 3;
  // Brush handle (top) + ferrule + bristles
  const pixels: [number, number, string][] = [
    // Handle
    [3, 0, '#F71963'], [4, 0, '#F71963'],
    [3, 1, '#F71963'], [4, 1, '#F71963'],
    [3, 2, '#F71963'], [4, 2, '#F71963'],
    [3, 3, '#F71963'], [4, 3, '#F71963'],
    // Ferrule
    [2, 4, '#94a3b8'], [3, 4, '#cbd5e1'], [4, 4, '#cbd5e1'], [5, 4, '#94a3b8'],
    [2, 5, '#94a3b8'], [3, 5, '#e2e8f0'], [4, 5, '#e2e8f0'], [5, 5, '#94a3b8'],
    // Bristles
    [2, 6, '#fbbf24'], [3, 6, '#fde68a'], [4, 6, '#fde68a'], [5, 6, '#fbbf24'],
    [2, 7, '#f59e0b'], [3, 7, '#fbbf24'], [4, 7, '#fbbf24'], [5, 7, '#f59e0b'],
    [3, 8, '#f59e0b'], [4, 8, '#f59e0b'],
    [3, 9, '#d97706'],
  ];
  const w = 8 * px;
  const h = 10 * px;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ imageRendering: 'pixelated' }}>
      {pixels.map(([col, row, color], i) => (
        <rect key={i} x={col * px} y={row * px} width={px} height={px} fill={color} />
      ))}
    </svg>
  );
}

// 8-bit pixel flask icon
function PixelFlask() {
  const px = 3;
  // Each cell: [col, row, color]
  const pixels: [number, number, string][] = [
    // Neck
    [3, 0, '#a78bfa'], [4, 0, '#a78bfa'],
    [3, 1, '#a78bfa'], [4, 1, '#a78bfa'],
    [2, 2, '#a78bfa'], [3, 2, '#a78bfa'], [4, 2, '#a78bfa'], [5, 2, '#a78bfa'],
    // Body outer
    [1, 3, '#7c3aed'], [2, 3, '#a78bfa'], [3, 3, '#c4b5fd'], [4, 3, '#c4b5fd'], [5, 3, '#a78bfa'], [6, 3, '#7c3aed'],
    [0, 4, '#7c3aed'], [1, 4, '#a78bfa'], [2, 4, '#c4b5fd'], [3, 4, '#e9d5ff'], [4, 4, '#e9d5ff'], [5, 4, '#c4b5fd'], [6, 4, '#a78bfa'], [7, 4, '#7c3aed'],
    [0, 5, '#7c3aed'], [1, 5, '#a78bfa'], [2, 5, '#7c3aed'], [3, 5, '#7c3aed'], [4, 5, '#c4b5fd'], [5, 5, '#e9d5ff'], [6, 5, '#a78bfa'], [7, 5, '#7c3aed'],
    [0, 6, '#7c3aed'], [1, 6, '#a78bfa'], [2, 6, '#c4b5fd'], [3, 6, '#7c3aed'], [4, 6, '#7c3aed'], [5, 6, '#c4b5fd'], [6, 6, '#a78bfa'], [7, 6, '#7c3aed'],
    // Base
    [0, 7, '#6d28d9'], [1, 7, '#6d28d9'], [2, 7, '#6d28d9'], [3, 7, '#6d28d9'], [4, 7, '#6d28d9'], [5, 7, '#6d28d9'], [6, 7, '#6d28d9'], [7, 7, '#6d28d9'],
  ];
  const w = 8 * px;
  const h = 8 * px;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ imageRendering: 'pixelated' }}>
      {pixels.map(([col, row, color], i) => (
        <rect key={i} x={col * px} y={row * px} width={px} height={px} fill={color} />
      ))}
    </svg>
  );
}

function BrazilianEngineeringLogo() {
  return (
    <div className="flex flex-col items-center select-none">
      <span
        className="font-black italic leading-none tracking-tight"
        style={{ fontSize: '1.1rem', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
      >
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

export default function LauncherPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d1826' }}>

      {/* Header */}
      <header className="border-b border-white/10 px-8 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-black tracking-tighter" style={{ color: '#F71963' }}>VTEX</span>
          <span className="text-sm text-white/40">Demo Platform</span>
        </div>
        <span className="text-xs text-white/20">Pre-sales tooling</span>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center px-6 py-16">
        <div className="w-full max-w-2xl space-y-14">

          {/* Platform Status */}
          <StatusCarousel />

          {/* Integration Simulators */}
          <section className="space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold text-white/90">Integration simulators</h1>
              <p className="text-sm text-white/35 leading-relaxed">
                Hands-on tools for demonstrating VTEX integration patterns. Each simulator exposes real endpoints and shows every request and response in a live dashboard.
              </p>
            </div>

            <div className="space-y-3">
              {TOOLS.map((tool) => {
                const card = (
                  <div
                    className={[
                      'group rounded-xl border p-5 transition-all duration-150',
                      tool.disabled
                        ? 'border-white/5 opacity-50 cursor-not-allowed'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03] cursor-pointer',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-white/50"
                        style={{ background: 'rgba(247,25,99,0.08)' }}
                      >
                        {tool.icon}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-white/90">{tool.label}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${tool.tagColor}`}>
                            {tool.tag}
                          </span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">{tool.description}</p>
                      </div>
                      {!tool.disabled && (
                        <svg
                          className="w-4 h-4 shrink-0 text-white/20 group-hover:text-white/50 transition-colors mt-0.5"
                          viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <path d="M5 10h10M10 5l5 5-5 5" />
                        </svg>
                      )}
                    </div>
                  </div>
                );

                return tool.disabled ? (
                  <div key={tool.label}>{card}</div>
                ) : (
                  <Link key={tool.label} href={tool.href}>{card}</Link>
                );
              })}
            </div>
          </section>

          {/* Field Tools */}
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Field Tools</h2>
                  <span
                    className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(20,184,166,0.12)', color: 'rgba(94,234,212,0.7)' }}
                  >
                    Community
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  External tools built and maintained by the SE/SA team. Open in a new tab.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FIELD_TOOLS.map((tool) => (
                <a
                  key={tool.label}
                  href={tool.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative rounded-xl p-4 flex flex-col gap-3 transition-all"
                  style={{
                    background: 'rgba(20,184,166,0.04)',
                    border: '1px solid rgba(20,184,166,0.12)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(20,184,166,0.08)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(20,184,166,0.22)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(20,184,166,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(20,184,166,0.12)';
                  }}
                >
                  {/* External link indicator */}
                  <svg
                    className="absolute top-3 right-3 w-3 h-3 transition-colors"
                    viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                    style={{ color: 'rgba(94,234,212,0.25)' }}
                  >
                    <path d="M2 10L10 2M6 2h4v4" />
                  </svg>

                  <div className="flex items-center gap-3">
                    <div
                      className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(20,184,166,0.1)', color: 'rgba(94,234,212,0.6)' }}
                    >
                      {tool.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{tool.label}</span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(20,184,166,0.1)', color: 'rgba(94,234,212,0.55)' }}
                        >
                          {tool.author}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {tool.description}
                  </p>
                </a>
              ))}
            </div>
          </section>

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Release Notes teaser */}
          <Link
            href="/release-notes"
            className="group flex items-center justify-between rounded-xl border px-5 py-4 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
            onMouseEnter={undefined}
          >
            <div className="flex items-center gap-3">
              <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(247,25,99,0.08)' }}
              >
                <svg className="w-4 h-4 text-white/30" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h7A2.5 2.5 0 0 1 14 2.5v10.5a.5.5 0 0 1-.777.416L8 10.101l-5.223 3.315A.5.5 0 0 1 2 13V2.5zm2.5-1A1.5 1.5 0 0 0 3 3v9.658l4.5-2.859 4.5 2.86V3A1.5 1.5 0 0 0 11.5 1.5h-7z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white/70 group-hover:text-white/90 transition-colors">Release Notes</p>
                <p className="text-xs text-white/30">Full changelog across all simulators</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 10h10M10 5l5 5-5 5" />
            </svg>
          </Link>

          <div className="border-t border-white/[0.06]" />

          {/* The Lab */}
          <section className="space-y-6">
            <div className="flex items-start gap-4">
              <div
                className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(167,139,250,0.15)' }}
              >
                <PixelFlask />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-semibold" style={{ color: '#c4b5fd' }}>The Lab</h2>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                    Experimental
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Not every useful thing needs to be a full simulator. The Lab is where small, focused utilities live — the kind of tool you build because you needed it on a demo and it was too good not to keep.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LAB_APPS.map((app) => (
                <div
                  key={app.label}
                  className="rounded-xl p-4 space-y-3"
                  style={{
                    background: 'rgba(124,58,237,0.05)',
                    border: '1px dashed rgba(167,139,250,0.15)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{app.icon}</span>
                    <span
                      className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(124,58,237,0.2)', color: 'rgba(167,139,250,0.6)' }}
                    >
                      Soon
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold" style={{ color: 'rgba(196,181,253,0.7)' }}>{app.label}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>{app.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="border-t border-white/[0.06]" />

          {/* Claude Skills */}
          <section className="space-y-6">
            <div className="flex items-start gap-4">
              <div
                className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(247,25,99,0.08)', border: '1px solid rgba(247,25,99,0.15)' }}
              >
                <PixelBrush />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-semibold text-white/90">Claude Skills & MCP</h2>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(247,25,99,0.12)', color: '#F71963' }}
                  >
                    Claude Code
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Skill files and MCP servers for Claude Code. Skills inject VTEX domain knowledge directly into your AI workflow — install in <span className="font-mono text-white/50">~/.claude/skills/</span>. MCP servers extend Claude with external tools and context.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* VTEX Brand Skill */}
              <a
                href="https://github.com/dcionevtex/vtex-brand-skill"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 rounded-xl border p-5 transition-all"
                style={{ border: '1px solid rgba(247,25,99,0.15)', background: 'rgba(247,25,99,0.04)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(247,25,99,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(247,25,99,0.3)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(247,25,99,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(247,25,99,0.15)'; }}
              >
                <div
                  className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-lg"
                  style={{ background: 'rgba(247,25,99,0.1)' }}
                >
                  🎨
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-white/90">VTEX Brand</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(247,25,99,0.12)', color: '#F71963' }}>Skill</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Gives Claude the complete VTEX brand system — Rebel Pink, typography, logo rules, and voice guidelines. Generates branded PowerPoint presentations and Marp slides from a single prompt.
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>dcionevtex/vtex-brand-skill</span>
                  </div>
                </div>
                <svg className="w-4 h-4 shrink-0 mt-0.5 transition-colors text-white/20 group-hover:text-white/50" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 10h10M10 5l5 5-5 5" />
                </svg>
              </a>

              {/* VTEX Solution Design Document Skill */}
              <a
                href="https://github.com/dcionevtex/Se-design-document"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 rounded-xl border p-5 transition-all"
                style={{ border: '1px solid rgba(247,25,99,0.15)', background: 'rgba(247,25,99,0.04)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(247,25,99,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(247,25,99,0.3)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(247,25,99,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(247,25,99,0.15)'; }}
              >
                <div
                  className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-lg"
                  style={{ background: 'rgba(247,25,99,0.1)' }}
                >
                  📐
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-white/90">Solution Design Document</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(247,25,99,0.12)', color: '#F71963' }}>Skill</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Complete toolkit for creating VTEX Solution Design Documents (SDDs). Includes the 5-step workflow, discovery gap analysis, 11-section canonical structure, architecture decision register format, and module design rules.
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>dcionevtex/Se-design-document</span>
                  </div>
                </div>
                <svg className="w-4 h-4 shrink-0 mt-0.5 transition-colors text-white/20 group-hover:text-white/50" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 10h10M10 5l5 5-5 5" />
                </svg>
              </a>

              {/* NotebookLM MCP */}
              <a
                href="https://mcp.directory/servers/notebooklm"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 rounded-xl border p-5 transition-all"
                style={{ border: '1px solid rgba(66,133,244,0.18)', background: 'rgba(66,133,244,0.04)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(66,133,244,0.09)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(66,133,244,0.35)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(66,133,244,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(66,133,244,0.18)'; }}
              >
                <div
                  className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-lg"
                  style={{ background: 'rgba(66,133,244,0.1)' }}
                >
                  📓
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-white/90">NotebookLM</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(66,133,244,0.15)', color: '#60a5fa' }}>MCP</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>Suggested</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    MCP server for Google NotebookLM. Lets Claude create and query NotebookLM notebooks directly — useful for turning RFP documents, discovery transcripts, or architecture notes into a searchable AI knowledge base mid-session.
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      <path d="M2 2h12v12H2z" /><path d="M5 6h6M5 9h4" />
                    </svg>
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>mcp.directory/servers/notebooklm</span>
                  </div>
                </div>
                <svg className="w-4 h-4 shrink-0 mt-0.5 transition-colors text-white/20 group-hover:text-white/50" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 10h10M10 5l5 5-5 5" />
                </svg>
              </a>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-8 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0e1a27' }}>
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

        <a
          href="https://brazilian.engineering/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity hover:opacity-80"
          aria-label="Brazilian Engineering"
        >
          <BrazilianEngineeringLogo />
        </a>

        <a
          href="https://github.com/dcionevtex"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-opacity hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Built by{' '}
          <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>@dcionevtex</span>
          {' '}& his bot army{' '}
          <svg width="14" height="16" viewBox="0 0 14 16" style={{ imageRendering: 'pixelated', display: 'inline-block', verticalAlign: 'middle', marginBottom: '1px' }}>
            <rect x="6" y="0" width="2" height="4" fill="#c4b5fd"/>
            <rect x="2" y="4" width="10" height="2" fill="#94a3b8"/>
            <rect x="0" y="6" width="2" height="8" fill="#94a3b8"/>
            <rect x="12" y="6" width="2" height="8" fill="#94a3b8"/>
            <rect x="2" y="14" width="10" height="2" fill="#94a3b8"/>
            <rect x="4" y="8" width="2" height="2" fill="#5eead4"/>
            <rect x="8" y="8" width="2" height="2" fill="#5eead4"/>
            <rect x="4" y="12" width="6" height="2" fill="#f87171"/>
          </svg>
        </a>
      </footer>

    </div>
  );
}
