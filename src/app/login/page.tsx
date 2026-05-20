'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const TOOLS = [
  {
    label: 'ERP Simulator',
    desc: 'Feed & Hook consumption, order normalization, Start Handling',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="18" rx="2" />
        <path d="M2 8h20M6 13h5M6 17h9" />
      </svg>
    ),
  },
  {
    label: 'Payment Provider Simulator',
    desc: 'Full PPP endpoint mock with live call inspection and protocol docs',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
        <circle cx="17" cy="15" r="1.5" />
      </svg>
    ),
  },
  {
    label: 'External Seller Simulator',
    desc: 'External seller fulfillment endpoints — simulation, placement, authorization, cancellation',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M9 22V12h6v10" />
      </svg>
    ),
  },
];

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  async function handleGoogleSignIn() {
    setLoading(true);
    await signIn('google', { callbackUrl: '/' });
  }

  const errorMessage =
    error === 'AccessDenied'
      ? 'Access denied. Only @vtex.com accounts are authorized.'
      : error
      ? 'Authentication error. Please try again.'
      : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d1826' }}>
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-8">

          {/* Brand */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tighter" style={{ color: '#F71963' }}>VTEX</span>
              <span className="text-lg font-semibold text-white/80">Demo Platform</span>
            </div>
            <p className="text-sm text-white/35">
              Integration simulators for pre-sales and technical demos
            </p>
          </div>

          {/* Tool list */}
          <div className="space-y-2">
            {TOOLS.map(tool => (
              <div
                key={tool.label}
                className="flex items-start gap-3 rounded-xl px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="mt-0.5 text-white/30 shrink-0">{tool.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/70">{tool.label}</p>
                  <p className="text-xs text-white/30 leading-relaxed mt-0.5">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Sign-in card */}
          <div
            className="rounded-2xl px-6 py-6 space-y-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <p className="text-sm font-semibold text-white/70">Sign in with your VTEX account</p>

            {errorMessage && (
              <div
                className="flex items-center gap-2 rounded-lg px-4 py-3"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <svg className="w-4 h-4 shrink-0 text-red-400" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.5v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0zm0 6.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z" />
                </svg>
                <p className="text-sm text-red-400">{errorMessage}</p>
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.11)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin text-white/50" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {loading ? 'Redirecting to Google…' : 'Sign in with Google'}
            </button>

            <p className="text-center text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Restricted to @vtex.com accounts. Do not use live production credentials or real customer data.
            </p>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer
        className="px-8 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0e1a27' }}
      >
        <a
          href="https://github.com/dcionevtex"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-opacity hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          Built by <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>@dcionevtex</span> · VTEX
        </a>
        <a
          href="https://brazilian.engineering/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity hover:opacity-80 select-none"
          aria-label="Brazilian Engineering"
        >
          <div className="flex flex-col items-center">
            <span className="font-black italic leading-none tracking-tight" style={{ fontSize: '0.95rem', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
              #BrazilianEngineering
            </span>
            <svg viewBox="0 0 240 16" width="200" height="13" className="mt-0.5" aria-hidden="true">
              <path d="M 2 8 C 60 15 100 13 112 8" stroke="#FEDF00" strokeWidth="2.8" fill="none" strokeLinecap="round" />
              <path d="M 128 8 C 145 13 185 15 238 8" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <polygon points="120,1 130,8 120,15 110,8" fill="#009B3A" />
              <polygon points="120,3.5 128,8 120,12.5 112,8" fill="#FEDF00" />
              <circle cx="120" cy="8" r="4" fill="#002776" />
              <path d="M 116.5 8 A 4 4 0 0 1 123.5 8" stroke="white" strokeWidth="0.7" fill="none" />
            </svg>
          </div>
        </a>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Demo &amp; test use only</span>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
