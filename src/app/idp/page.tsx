'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import type { IdpConfig, IdpCallLogEntry, IdpUser } from '@/types/idp';

function BrazilianEngineeringLogo() {
  return (
    <div className="flex flex-col items-center select-none">
      <span className="font-black italic leading-none tracking-tight text-foreground/60" style={{ fontSize: '1.1rem', fontFamily: 'Inter, sans-serif' }}>
        #BrazilianEngineering
      </span>
      <svg viewBox="0 0 240 16" width="220" height="14" className="mt-1" aria-hidden="true">
        <path d="M 2 8 C 60 15 100 13 112 8" stroke="#FEDF00" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <path d="M 128 8 C 145 13 185 15 238 8" stroke="rgba(63,63,64,0.25)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <polygon points="120,1 130,8 120,15 110,8" fill="#009B3A" />
        <polygon points="120,3.5 128,8 120,12.5 112,8" fill="#FEDF00" />
        <circle cx="120" cy="8" r="4" fill="#002776" />
        <path d="M 116.5 8 A 4 4 0 0 1 123.5 8" stroke="white" strokeWidth="0.7" fill="none" />
      </svg>
    </div>
  );
}

const ENDPOINT_COLORS: Record<string, string> = {
  authorize: 'text-emerald-600',
  token: 'text-sky-600',
  userinfo: 'text-violet-600',
};

const ENDPOINT_LABELS: Record<string, string> = {
  authorize: 'Authorize',
  token: 'Token Exchange',
  userinfo: 'User Info',
};

type ActiveTab = 'config' | 'users' | 'setup';

export default function IdpPage() {
  const [accountInput, setAccountInput] = useState('');
  const [account, setAccount] = useState('');
  const [origin, setOrigin] = useState('');
  const [config, setConfig] = useState<IdpConfig | null>(null);
  const [calls, setCalls] = useState<IdpCallLogEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ActiveTab>('config');
  const [copied, setCopied] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [resetting, setResetting] = useState(false);

  // User management
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('demo123');

  const configInitialized = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('idp_account') ?? '';
    setAccountInput(saved);
    setAccount(saved);
    setOrigin(window.location.origin);
  }, []);

  const fetchData = useCallback(async () => {
    if (!account) return;
    try {
      const [callsRes, configRes] = await Promise.all([
        fetch(`/api/idp/${account}/calls`),
        fetch(`/api/idp/${account}/config`),
      ]);
      if (callsRes.ok) {
        const data = await callsRes.json() as { calls: IdpCallLogEntry[] };
        const incoming = data.calls ?? [];
        if (incoming.length) {
          setCalls(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const added = incoming.filter(c => !existingIds.has(c.id));
            return added.length ? [...prev, ...added] : prev;
          });
        }
      }
      if (configRes.ok && !configInitialized.current) {
        setConfig(await configRes.json() as IdpConfig);
        configInitialized.current = true;
      }
    } catch { /* ignore */ }
  }, [account]);

  useEffect(() => {
    if (!account) return;
    configInitialized.current = false;
    setCalls([]);
    setConfig(null);
    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => clearInterval(id);
  }, [account, fetchData]);

  function commitAccount() {
    const trimmed = accountInput.trim().toLowerCase();
    if (!trimmed) return;
    setAccount(trimmed);
    localStorage.setItem('idp_account', trimmed);
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function clearCalls() {
    if (!account) return;
    setClearing(true);
    await fetch(`/api/idp/${account}/calls`, { method: 'DELETE' });
    setCalls([]);
    setClearing(false);
  }

  async function resetSecret() {
    if (!account) return;
    setResetting(true);
    const res = await fetch(`/api/idp/${account}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resetSecret' }),
    });
    if (res.ok) setConfig(await res.json() as IdpConfig);
    setResetting(false);
  }

  async function setPhoneEnabled(enabled: boolean) {
    if (!account) return;
    const res = await fetch(`/api/idp/${account}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneEnabled: enabled }),
    });
    if (res.ok) setConfig(await res.json() as IdpConfig);
  }

  async function addUser() {
    if (!account || !newUserEmail || !newUserName || !config) return;
    const users: IdpUser[] = [...config.users, { email: newUserEmail, name: newUserName, password: newUserPassword || 'demo123' }];
    const res = await fetch(`/api/idp/${account}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users }),
    });
    if (res.ok) {
      setConfig(await res.json() as IdpConfig);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('demo123');
    }
  }

  async function removeUser(email: string) {
    if (!account || !config) return;
    const users = config.users.filter(u => u.email !== email);
    const res = await fetch(`/api/idp/${account}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users }),
    });
    if (res.ok) setConfig(await res.json() as IdpConfig);
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const authorizeUrl = account ? `${origin}/idp/${account}/authorize` : '';
  const tokenUrl = account ? `${origin}/api/idp/${account}/token` : '';
  const userinfoUrl = account ? `${origin}/api/idp/${account}/userinfo` : '';

  const sortedCalls = [...calls].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  function CopyButton({ text, id }: { text: string; id: string }) {
    const isCopied = copied === id;
    return (
      <button
        onClick={() => copyText(text, id)}
        className={`shrink-0 transition-opacity hover:opacity-80 ${isCopied ? 'text-success-foreground' : 'text-muted-foreground/60'}`}
      >
        {isCopied
          ? <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" /></svg>
          : <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" /><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" /></svg>
        }
      </button>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">

      {/* Header */}
      <header className="grid grid-cols-3 items-center h-16 px-6 shrink-0 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 transition-opacity hover:opacity-70">
            <svg className="w-3.5 h-3.5 text-muted-foreground" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5l-5 5 5 5" />
            </svg>
            <span className="text-xs text-muted-foreground">All tools</span>
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-semibold text-foreground">External IDP Simulator</span>
        </div>

        <div className="flex flex-col items-center justify-center">
          {account
            ? <span className="text-xs font-mono text-muted-foreground">Account: <span className="text-foreground">{account}</span></span>
            : <span className="text-xs text-muted-foreground">Configure account to get started</span>
          }
        </div>

        <div className="flex justify-end">
          {account && (
            <button
              onClick={clearCalls}
              disabled={clearing || calls.length === 0}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-all disabled:opacity-30 text-muted-foreground bg-muted border border-border hover:bg-secondary"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h12M6 7l1 9h6l1-9M8 7V4h4v3" />
              </svg>
              {clearing ? 'Clearing…' : 'Clear'}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <aside className="w-80 shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
            {([['config', 'Config'], ['users', 'Users'], ['setup', 'Setup']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setActiveTab(val)}
                className={['flex-1 py-3 text-xs font-medium transition-colors',
                  activeTab === val ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* Config tab */}
            {activeTab === 'config' && (
              <div className="p-4 space-y-5">

                {/* Account */}
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">VTEX Account</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={accountInput}
                      onChange={e => setAccountInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && commitAccount()}
                      placeholder="mystore"
                      className="flex-1 text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary/50 bg-background border border-border text-foreground placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={commitAccount}
                      disabled={!accountInput.trim()}
                      className="px-3 py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-30 bg-primary text-primary-foreground hover:opacity-90"
                    >
                      Set
                    </button>
                  </div>
                </div>

                {/* Credentials */}
                {config && (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">OAuth2 Credentials</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Paste these into VTEX Admin when configuring the OAuth2 provider.
                    </p>

                    {[
                      { label: 'Client ID', value: config.clientId, id: 'clientId' },
                      { label: 'Client Secret', value: config.clientSecret, id: 'clientSecret', mono: true },
                    ].map(({ label, value, id, mono }) => (
                      <div key={id} className="space-y-1">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <div className="flex items-center gap-2 rounded-md px-3 py-2 bg-muted border border-border">
                          <span className={`flex-1 text-xs break-all text-foreground ${mono ? 'font-mono' : ''}`}>
                            {value}
                          </span>
                          <CopyButton text={value} id={id} />
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={resetSecret}
                      disabled={resetting}
                      className="text-xs px-3 py-1.5 rounded-md transition-all disabled:opacity-30 text-muted-foreground bg-muted border border-border hover:bg-secondary"
                    >
                      {resetting ? 'Regenerating…' : 'Regenerate secret'}
                    </button>
                  </div>
                )}

                {/* Login options */}
                {config && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Login Options</p>
                    <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2 bg-muted border border-border">
                      <div>
                        <p className="text-xs font-medium text-foreground">Phone login</p>
                        <p className="text-xs text-muted-foreground">Show the phone tab on the login page, in addition to email.</p>
                      </div>
                      <div className="flex shrink-0 rounded-md p-0.5 bg-background border border-border">
                        <button
                          onClick={() => setPhoneEnabled(true)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            (config.phoneEnabled ?? true) ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                          }`}
                        >
                          On
                        </button>
                        <button
                          onClick={() => setPhoneEnabled(false)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            !(config.phoneEnabled ?? true) ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                          }`}
                        >
                          Off
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      One-off override without changing this default: append <span className="font-mono text-foreground">?phone=true</span> or <span className="font-mono text-foreground">?phone=false</span> to the Authorization URL below.
                    </p>
                  </div>
                )}

                {/* Endpoint URLs */}
                {account && (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Endpoint URLs</p>
                    {[
                      { label: 'Authorization URL', value: authorizeUrl, id: 'authUrl', color: 'text-emerald-600' },
                      { label: 'Token URL', value: tokenUrl, id: 'tokenUrl', color: 'text-sky-600' },
                      { label: 'User Info URL', value: userinfoUrl, id: 'userinfoUrl', color: 'text-violet-600' },
                    ].map(({ label, value, id, color }) => (
                      <div key={id} className="space-y-1">
                        <p className={`text-xs font-medium ${color}`}>{label}</p>
                        <div className="flex items-center gap-2 rounded-md px-3 py-2 bg-muted border border-border">
                          <span className="flex-1 text-xs font-mono break-all text-muted-foreground">
                            {value}
                          </span>
                          <CopyButton text={value} id={id} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Users tab */}
            {activeTab === 'users' && (
              <div className="p-4 space-y-5">
                <div>
                  <p className="text-xs font-semibold text-foreground">Test users</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    These users appear on the login page. Anyone can log in as any of them during the demo.
                  </p>
                </div>

                {/* User list */}
                {config && config.users.length > 0 && (
                  <div className="space-y-2">
                    {config.users.map(user => (
                      <div
                        key={user.email}
                        className="flex items-center gap-3 rounded-md px-3 py-2.5 bg-muted border border-border"
                      >
                        <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-secondary text-secondary-foreground">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <button
                          onClick={() => removeUser(user.email)}
                          className="shrink-0 text-muted-foreground hover:text-danger-foreground transition-colors"
                          title="Remove user"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add user */}
                {account && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Add user</p>
                    {[
                      { key: 'name', label: 'Name', value: newUserName, setter: setNewUserName, placeholder: 'Jane Doe' },
                      { key: 'email', label: 'Email', value: newUserEmail, setter: setNewUserEmail, placeholder: 'jane@example.com' },
                      { key: 'password', label: 'Password', value: newUserPassword, setter: setNewUserPassword, placeholder: 'demo123' },
                    ].map(field => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs text-muted-foreground">{field.label}</label>
                        <input
                          type="text"
                          value={field.value}
                          onChange={e => field.setter(e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full text-xs rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary/50 bg-background border border-border text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                    ))}
                    <button
                      onClick={addUser}
                      disabled={!newUserEmail || !newUserName}
                      className="w-full py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-30 bg-primary text-primary-foreground hover:opacity-90"
                    >
                      Add user
                    </button>
                  </div>
                )}

                {!account && (
                  <p className="text-xs text-muted-foreground text-center">Set account in Config tab first.</p>
                )}
              </div>
            )}

            {/* Setup tab */}
            {activeTab === 'setup' && (
              <div className="p-4 space-y-5">
                <div>
                  <p className="text-xs font-semibold text-foreground">Setup guide</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    How to connect this simulator as an OAuth2 identity provider in your VTEX storefront.
                  </p>
                </div>

                {([
                  { n: 1, title: 'Set your account', body: 'Enter your VTEX account name in the Config tab. This generates stable endpoint URLs and credentials for your account.' },
                  { n: 2, title: 'Open VTEX Admin', body: 'Go to Admin → Store Settings → People → Authentication (or Account Settings → Authentication, depending on your version).', link: { label: 'VTEX OAuth2 guide', url: 'https://developers.vtex.com/docs/guides/login-integration-guide-webstore-oauth2' } },
                  { n: 3, title: 'Add a new OAuth2 provider', body: 'Click "Add new" under OAuth2 providers. Give it any name (e.g. "Demo IDP"). Paste the Client ID and Client Secret from the Config tab.' },
                  { n: 4, title: 'Step 2 — Authorization Code', body: 'Paste the Authorization URL. VTEX pre-fills client_id, state, and redirect_uri automatically. No changes needed — click Next.' },
                  { n: 5, title: 'Step 3 — Token exchange', body: 'Paste the Token URL. Select application/x-www-form-urlencoded. Response keys: access_token and expires_in. Click Next.' },
                  { n: 6, title: 'Step 4 — User Info', body: 'Paste the User Info URL. Leave the access token toggle OFF (Bearer header). Set the response field keys exactly as below — capitalization matters.' },
                  { n: 7, title: 'User Info field mapping', body: '', fields: [['User email', 'email'], ['User ID', 'userId'], ['Username', 'name']] },
                  { n: 8, title: 'No Master Data profile needed', body: 'VTEX creates the shopper session on the fly. The email does not need to exist as a customer profile in Master Data before logging in.' },
                  { n: 9, title: 'Test it', body: 'Open your storefront login, select the provider, and type any email. The call log on the right shows every OAuth2 step in real time.' },
                ] as Array<{ n: number; title: string; body: string; link?: { label: string; url: string }; fields?: string[][] }>).map(step => (
                  <div key={step.n} className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 bg-secondary text-secondary-foreground">
                      {step.n}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{step.title}</p>
                      {step.body && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.body}</p>}
                      {step.fields && (
                        <div className="mt-1.5 space-y-1">
                          {step.fields.map(([label, key]) => (
                            <div key={key} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-24 shrink-0">{label}</span>
                              <span className="font-mono px-1.5 py-0.5 rounded bg-success-faded text-success-foreground">{key}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {step.link && (
                        <a
                          href={step.link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs mt-1 text-primary transition-opacity hover:opacity-80"
                        >
                          {step.link.label}
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1z" /></svg>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right panel — call log */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Flow strip */}
          <div className="shrink-0 border-b border-border px-6 py-3">
            <div className="flex items-center justify-center gap-2">
              {(['authorize', 'token', 'userinfo'] as const).map((ep, i, arr) => {
                const count = sortedCalls.filter(c => c.endpoint === ep).length;
                return (
                  <div key={ep} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted border border-border">
                      <span className={`text-xs font-bold font-mono ${ENDPOINT_COLORS[ep]}`}>
                        {ep === 'authorize' ? 'GET' : ep === 'token' ? 'POST' : 'GET'}
                      </span>
                      <span className="text-xs text-muted-foreground">{ENDPOINT_LABELS[ep]}</span>
                      {count > 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-background ${ENDPOINT_COLORS[ep]}`}>
                          {count}
                        </span>
                      )}
                    </div>
                    {i < arr.length - 1 && (
                      <svg className="w-3 h-3 text-muted-foreground/40 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 10h10M10 5l5 5-5 5" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Call list */}
          <div className="flex-1 overflow-y-auto">
            {sortedCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/50">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <p className="text-sm">
                  {account ? 'Waiting for OAuth2 calls from VTEX…' : 'Configure your account name to get started'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {[...sortedCalls].reverse().map(call => {
                  const expanded = expandedIds.has(call.id);
                  return (
                    <div key={call.id}>
                      <button
                        onClick={() => toggleExpand(call.id)}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <span
                          className={`shrink-0 text-xs font-bold font-mono px-1.5 py-0.5 rounded ${call.success ? 'bg-success-faded text-success-foreground' : 'bg-danger-faded text-danger-foreground'}`}
                        >
                          {call.statusCode}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${ENDPOINT_COLORS[call.endpoint] ?? 'text-foreground'}`}>
                              {ENDPOINT_LABELS[call.endpoint] ?? call.endpoint}
                            </span>
                            {call.email && (
                              <span className="text-xs text-muted-foreground font-mono truncate hidden sm:block">{call.email}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(call.timestamp).toLocaleTimeString()}
                          </p>
                        </div>

                        {call.details && (
                          <span className="text-xs text-muted-foreground hidden md:block max-w-40 truncate">{call.details}</span>
                        )}

                        <svg
                          className={`w-3.5 h-3.5 text-muted-foreground/60 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
                          viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <path d="M5 8l5 5 5-5" />
                        </svg>
                      </button>

                      {expanded && (
                        <div className="px-5 pb-4 space-y-3 bg-muted">
                          <div className="rounded-md p-3 space-y-1.5 bg-card border border-border">
                            <div className="flex gap-4 text-xs">
                              <div><span className="text-muted-foreground">Endpoint </span><span className="text-foreground font-mono">{call.endpoint}</span></div>
                              <div><span className="text-muted-foreground">Method </span><span className="text-foreground font-mono">{call.method}</span></div>
                              <div><span className="text-muted-foreground">Status </span><span className={call.success ? 'text-success-foreground' : 'text-danger-foreground'}>{call.statusCode}</span></div>
                            </div>
                            {call.email && <div className="text-xs"><span className="text-muted-foreground">User </span><span className="text-foreground font-mono">{call.email}</span></div>}
                            {call.details && <div className="text-xs text-muted-foreground">{call.details}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-8 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3" />
            <path d="M13 14l3-4-3-4" />
            <path d="M16 10H7" />
          </svg>
          Sign out
        </button>

        <a href="https://brazilian.engineering/" target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80" aria-label="Brazilian Engineering">
          <BrazilianEngineeringLogo />
        </a>

        <a
          href="https://github.com/dcionevtex"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground transition-opacity hover:opacity-80"
        >
          Built by <span className="font-semibold text-foreground">@dcionevtex</span> & his bot army{' '}
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
