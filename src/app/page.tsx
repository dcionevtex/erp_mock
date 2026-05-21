'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';

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

          {/* Divider */}
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
