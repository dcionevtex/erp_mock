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
];

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
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl space-y-10">

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white/90">Integration simulators</h1>
            <p className="text-sm text-white/40 leading-relaxed">
              Hands-on tools for demonstrating VTEX integration patterns. Each simulator exposes real endpoints and shows every request and response in a live dashboard.
            </p>
          </div>

          {/* Tool cards */}
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
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-8 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0e1a27' }}>
        <a
          href="https://github.com/dcionevtex"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-opacity hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Built by{' '}
          <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>@dcionevtex</span>
          {' '}· VTEX
        </a>

        <a
          href="https://brazilian.engineering/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity hover:opacity-80"
          aria-label="Brazilian Engineering"
        >
          <BrazilianEngineeringLogo />
        </a>

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
      </footer>

    </div>
  );
}
