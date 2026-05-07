'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Suspense } from 'react';

function LoginForm() {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  async function handleGoogleSignIn() {
    if (!agreed) return;
    setLoading(true);
    await signIn('google', { callbackUrl: '/about' });
  }

  const errorMessage =
    error === 'AccessDenied'
      ? 'Access denied. Only @vtex.com accounts are authorized.'
      : error
      ? 'Authentication error. Please try again.'
      : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-5">

          {/* Logo + title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-2" style={{ background: '#F71963' }}>
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ERP Connect</h1>
            <p className="text-sm text-gray-500">VTEX OMS Integration Demo</p>
          </div>

          {/* Warning header */}
          <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '2px solid #dc2626' }}>
            <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: '#dc2626' }}>
              <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
              </svg>
              <span className="text-white font-bold text-sm tracking-widest uppercase">
                Demo &amp; Testing Environment Only
              </span>
            </div>
            <div className="px-5 py-4 space-y-2.5 bg-white">
              <WarningRow icon="block"><strong>Never use real production App Keys or App Tokens.</strong> Configure test or sandbox credentials only.</WarningRow>
              <WarningRow icon="block"><strong>Never process real customer orders</strong> or personal data through this application.</WarningRow>
              <WarningRow icon="block"><strong>Real transactional data must never be used.</strong> This app may trigger actual VTEX OMS API calls including Start Handling and invoice notifications.</WarningRow>
              <WarningRow icon="info">The authors and VTEX are <strong>not responsible</strong> for any data loss, order disruption, or misuse resulting from operating this tool against live environments.</WarningRow>
            </div>
          </div>

          {/* Login card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-7 space-y-5">
            <h2 className="text-base font-semibold text-gray-800">Sign in to continue</h2>

            {errorMessage && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <svg className="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.5v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0zm0 6.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"/>
                </svg>
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading || !agreed}
              className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {loading ? 'Redirecting to Google…' : 'Sign in with Google'}
            </button>

            <p className="text-center text-xs text-gray-400">
              Only <span className="font-medium text-gray-600">@vtex.com</span> accounts are authorized.
            </p>
          </div>

          {/* T&C block */}
          <div className="rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-white">
            <div className="px-5 py-3 border-b border-gray-100" style={{ background: '#fafafa' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                Terms &amp; Conditions of Use
              </p>
            </div>

            <div className="px-5 py-4 space-y-3 text-xs text-gray-600 leading-relaxed">
              <p>
                <strong className="text-gray-800">Demo &amp; Test Use Only — Do not use with real production data.</strong>
              </p>
              <p>
                Never configure real App Keys or App Tokens. Never process real customer orders or personal
                data through this application. This tool may trigger actual VTEX OMS API calls including
                Start Handling and invoice notifications.
              </p>
              <p>
                The authors and VTEX bear <strong className="text-gray-800">no responsibility</strong> for any data loss,
                order disruption, or misuse resulting from operating this tool against live environments.
                All data entered is stored per browser session only and is not shared with third parties.
                Order records are automatically purged every 7 days.
              </p>
            </div>

            <div className="px-5 py-4 border-t" style={{ borderColor: agreed ? '#bbf7d0' : '#fee2e2', background: agreed ? '#f0fdf4' : '#fff7f7' }}>
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <div className={[
                  'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                  agreed ? 'border-green-500 bg-green-500' : 'border-red-300 bg-white group-hover:border-red-400',
                ].join(' ')}>
                  {agreed && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="sr-only"
                  />
                </div>
                <div>
                  <span className={['text-sm font-bold tracking-wide uppercase transition-colors', agreed ? 'text-green-700' : 'text-red-600'].join(' ')}>
                    I Agree to the Terms &amp; Conditions
                  </span>
                  {!agreed && (
                    <p className="text-[11px] text-red-400 mt-0.5">Required — you must agree before signing in.</p>
                  )}
                  {agreed && (
                    <p className="text-[11px] text-green-600 mt-0.5">You have agreed to the terms above.</p>
                  )}
                </div>
              </label>
            </div>
          </div>

        </div>
      </main>
      <Footer />
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

function WarningRow({ icon, children }: { icon: 'block' | 'info'; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {icon === 'block' ? (
        <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm2.78-4.22a.75.75 0 0 1-1.06 1.06L8 10.06l-1.72 1.72a.75.75 0 0 1-1.06-1.06L6.94 9 5.22 7.28a.75.75 0 0 1 1.06-1.06L8 7.94l1.72-1.72a.75.75 0 1 1 1.06 1.06L9.06 9l1.72 1.72z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.5v4a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 1.5 0zm0 7a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"/>
        </svg>
      )}
      <p className="text-xs text-gray-700 leading-relaxed">{children}</p>
    </div>
  );
}
