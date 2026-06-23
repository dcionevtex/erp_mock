'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import type { IdpConfig } from '@/types/idp';

type LoginMode = 'email' | 'phone';

export default function AuthorizePage() {
  const { account } = useParams<{ account: string }>();
  const searchParams = useSearchParams();

  const state = searchParams.get('state') ?? '';
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const error = searchParams.get('error') ?? '';

  const [config, setConfig] = useState<IdpConfig | null>(null);
  const [mode, setMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/idp/${account}/config`)
      .then(r => r.json())
      .then(d => setConfig(d as IdpConfig))
      .catch(() => null);
  }, [account]);

  function quickLoginEmail(userEmail: string) {
    setMode('email');
    setEmail(userEmail);
    setTimeout(() => {
      (document.getElementById('idp-form') as HTMLFormElement | null)?.submit();
    }, 50);
  }

  function quickLoginPhone(userPhone: string) {
    setMode('phone');
    setPhone(userPhone);
    setTimeout(() => {
      (document.getElementById('idp-form') as HTMLFormElement | null)?.submit();
    }, 50);
  }

  const digits = phone.replace(/\D/g, '');
  const syntheticEmail = digits ? `${digits}@${account}.com` : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#0d1826' }}
    >
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl font-black tracking-tighter" style={{ color: '#F71963' }}>VTEX</span>
            <span className="text-sm text-white/30">Demo IDP</span>
          </div>
          <p className="text-sm text-white/50">
            Signing in to <span className="font-mono text-white/70">{account}</span>
          </p>
          <div
            className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(247,25,99,0.1)', color: 'rgba(247,25,99,0.7)', border: '1px solid rgba(247,25,99,0.2)' }}
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.5v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0zm0 6.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z" />
            </svg>
            Any email or phone works — no password needed
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm text-center"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <button
            type="button"
            onClick={() => setMode('email')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all"
            style={mode === 'email'
              ? { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }
              : { color: 'rgba(255,255,255,0.35)' }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="14" height="10" rx="2" /><path d="M1 5l7 5 7-5" />
            </svg>
            Email
          </button>
          <button
            type="button"
            onClick={() => setMode('phone')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all"
            style={mode === 'phone'
              ? { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }
              : { color: 'rgba(255,255,255,0.35)' }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="1" width="10" height="14" rx="2" /><circle cx="8" cy="12" r="0.75" fill="currentColor" stroke="none" />
            </svg>
            Phone
          </button>
        </div>

        {/* Quick-login shortcuts */}
        {mode === 'email' && config && config.users.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Test users
            </p>
            <div className="space-y-2">
              {config.users.map(user => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => quickLoginEmail(user.email)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(247,25,99,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(247,25,99,0.25)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                >
                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(247,25,99,0.15)', color: '#F71963' }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80">{user.name}</p>
                    <p className="text-xs text-white/35 truncate">{user.email}</p>
                  </div>
                  <svg className="w-4 h-4 text-white/20 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 10h10M10 5l5 5-5 5" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'phone' && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Test phone
            </p>
            <button
              type="button"
              onClick={() => quickLoginPhone('+971529293054')}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(247,25,99,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(247,25,99,0.25)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(247,25,99,0.15)', color: '#F71963' }}>
                T
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80">Test Buyer</p>
                <p className="text-xs text-white/35">+971529293054</p>
              </div>
              <svg className="w-4 h-4 text-white/20 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 10h10M10 5l5 5-5 5" />
              </svg>
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span className="text-[10px] text-white/25">
            {mode === 'email' ? 'or type any email' : 'or type any phone number'}
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Login form */}
        <form
          id="idp-form"
          action={`/api/idp/${account}/authorize`}
          method="POST"
          onSubmit={() => setSubmitting(true)}
          className="space-y-3"
        >
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />

          {mode === 'email' ? (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="john.doe@testemail.com"
                className="w-full text-sm rounded-xl px-4 py-3 outline-none focus:ring-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Phone number
              </label>
              <input
                type="tel"
                name="phone"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+971529293054"
                className="w-full text-sm rounded-xl px-4 py-3 outline-none focus:ring-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
              />
              {syntheticEmail && (
                <p className="text-[10px] pt-0.5 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 8h12M8 2l6 6-6 6" />
                  </svg>
                  VTEX profile email: <span className="font-mono text-white/45">{syntheticEmail}</span>
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: '#F71963', color: '#fff' }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Simulated identity provider for VTEX demos.
          <br />
          {mode === 'phone'
            ? 'Phone is converted to a synthetic email for the VTEX profile system.'
            : 'Any email is accepted — no password required.'}
        </p>
      </div>
    </div>
  );
}
