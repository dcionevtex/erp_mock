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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm bg-card border border-border rounded-lg shadow-sm p-8 space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl font-black tracking-tighter text-primary">VTEX</span>
            <span className="text-sm text-muted-foreground">Demo IDP</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Signing in to <span className="font-mono text-foreground">{account}</span>
          </p>
          <div className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.5v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0zm0 6.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z" />
            </svg>
            Any email or phone works — no password needed
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md px-4 py-3 text-sm text-center bg-danger-faded text-danger-foreground border border-danger-foreground/20">
            {error}
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-faded px-3 py-2 text-xs text-warning-foreground">
          <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.964 0L.165 13.233c-.457.778.091 1.767.982 1.767h13.706c.891 0 1.439-.99.982-1.767L8.982 1.566ZM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5Zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
          </svg>
          <span>Emails containing <span className="font-mono">@vtex.com</span> are reserved and not accepted — that domain already has a real VTEX ID tied to it, which breaks this demo flow. Use any other email.</span>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-md p-0.5 bg-muted">
          <button
            type="button"
            onClick={() => setMode('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
              mode === 'email' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="14" height="10" rx="2" /><path d="M1 5l7 5 7-5" />
            </svg>
            Email
          </button>
          <button
            type="button"
            onClick={() => setMode('phone')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
              mode === 'phone' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
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
            <p className="text-xs uppercase tracking-widest text-center text-muted-foreground">
              Test users
            </p>
            <div className="space-y-2">
              {config.users.map(user => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => quickLoginEmail(user.email)}
                  className="w-full flex items-center gap-3 rounded-md px-4 py-3 text-left transition-all bg-muted border border-border hover:bg-secondary hover:border-primary/30"
                >
                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-secondary text-secondary-foreground">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <svg className="w-4 h-4 text-muted-foreground/60 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 10h10M10 5l5 5-5 5" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'phone' && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-center text-muted-foreground">
              Test phone
            </p>
            <button
              type="button"
              onClick={() => quickLoginPhone('+971529293054')}
              className="w-full flex items-center gap-3 rounded-md px-4 py-3 text-left transition-all bg-muted border border-border hover:bg-secondary hover:border-primary/30"
            >
              <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-secondary text-secondary-foreground">
                T
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Test Buyer</p>
                <p className="text-xs text-muted-foreground">+971529293054</p>
              </div>
              <svg className="w-4 h-4 text-muted-foreground/60 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 10h10M10 5l5 5-5 5" />
              </svg>
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">
            {mode === 'email' ? 'or type any email' : 'or type any phone number'}
          </span>
          <div className="flex-1 h-px bg-border" />
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
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="john.doe@testemail.com"
                className="w-full text-sm rounded-md px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40 bg-background border border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Phone number
              </label>
              <input
                type="tel"
                name="phone"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+971529293054"
                className="w-full text-sm rounded-md px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40 bg-background border border-border text-foreground placeholder:text-muted-foreground"
              />
              {syntheticEmail && (
                <p className="text-xs pt-0.5 flex items-center gap-1.5 text-muted-foreground">
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 8h12M8 2l6 6-6 6" />
                  </svg>
                  VTEX profile email: <span className="font-mono text-foreground">{syntheticEmail}</span>
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-md text-sm font-semibold transition-all disabled:opacity-50 bg-primary text-primary-foreground hover:opacity-90"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
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
