'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Footer } from '@/components/Footer';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Invalid password. Please try again.');
        setPassword('');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f5f5f5' }}>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">

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

          {/* Hard-stop warning */}
          <div className="rounded-xl border-2 border-red-500 bg-white overflow-hidden shadow-md">
            {/* Red header bar */}
            <div className="flex items-center gap-2.5 px-4 py-3 bg-red-600">
              <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
              </svg>
              <span className="text-white font-bold text-sm tracking-wide uppercase">
                Demo &amp; Testing Environment Only
              </span>
            </div>

            {/* Body */}
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm font-semibold text-gray-900">
                This tool is strictly for demonstration and integration testing.
              </p>

              <div className="space-y-2">
                <WarningRow icon="block">
                  <strong>Never use real production App Keys or App Tokens.</strong> Configure test or sandbox credentials only.
                </WarningRow>
                <WarningRow icon="block">
                  <strong>Never process real customer orders</strong> or personal data through this application.
                </WarningRow>
                <WarningRow icon="block">
                  <strong>Real transactional data must never be used.</strong> This app may trigger actual VTEX OMS API calls including Start Handling and invoice notifications.
                </WarningRow>
                <WarningRow icon="info">
                  The authors and VTEX are <strong>not responsible</strong> for any data loss, order disruption, or misuse resulting from operating this tool against live environments.
                </WarningRow>
              </div>

              {/* Acknowledgement checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1 select-none">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-red-600 shrink-0"
                />
                <span className="text-xs text-gray-700 leading-relaxed">
                  I understand this is a <strong>demo tool</strong>. I will only use test credentials and I will not process real customer data.
                </span>
              </label>
            </div>
          </div>

          {/* Login card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-8 space-y-5">
            <h2 className="text-base font-semibold text-gray-800">Sign in to continue</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter demo password"
                  required
                  autoFocus
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                  style={{ '--tw-ring-color': '#F71963' } as React.CSSProperties}
                  onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px #F71963'; }}
                  onBlur={(e) => { e.currentTarget.style.boxShadow = ''; }}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.5v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0zm0 6.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"/>
                  </svg>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !password || !acknowledged}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: '#F71963' }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              {!acknowledged && (
                <p className="text-center text-xs text-gray-400">
                  Acknowledge the warning above to continue.
                </p>
              )}
            </form>
          </div>

        </div>
      </main>
      <Footer />
    </div>
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
