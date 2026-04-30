'use client';

import { useState, useEffect } from 'react';
import { IntegrationSetup } from './IntegrationSetup';
import type { AppConfigPublic } from '@/types';

interface Props {
  config: AppConfigPublic | null;
  onSaved: (config: AppConfigPublic) => void;
}

type SetupTab = 'account' | 'integration';

export function InlineSetup({ config, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SetupTab>('account');

  // Auto-open when credentials are missing so the operator notices immediately
  useEffect(() => {
    if (config !== null && !config.appTokenConfigured) setOpen(true);
  }, [config]);

  const configured = config?.appTokenConfigured && config?.account;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Summary row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Gear icon */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
            <circle cx="7.5" cy="7.5" r="2" />
            <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.93 2.93l1.06 1.06M11 11l1.07 1.07M2.93 12.07l1.06-1.06M11 4l1.07-1.07" />
          </svg>
          <span className="text-sm font-semibold text-foreground">Setup</span>
          {config && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
              {config.account || 'no account'} · {config.integrationMode ?? 'HOOK'}
              {config.appKey ? ` · Key: ${config.appKey}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {configured ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 5l2.5 2.5L8 3" /></svg>
              Configured
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 1a4 4 0 1 0 0 8A4 4 0 0 0 5 1zm.5 2.25v2a.5.5 0 0 1-1 0v-2a.5.5 0 0 1 1 0zm0 4a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" /></svg>
              Not configured
            </span>
          )}
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <path d="M3 5l4 4 4-4" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-border">
          {/* Tabs */}
          <div className="flex border-b border-border px-4">
            <TabBtn active={tab === 'account'} onClick={() => setTab('account')}>
              Account Configuration
            </TabBtn>
            <TabBtn active={tab === 'integration'} onClick={() => setTab('integration')}>
              Hook &amp; Feed Configuration
            </TabBtn>
          </div>

          <div className="p-4">
            {tab === 'account' && (
              <AccountForm config={config} onSaved={onSaved} />
            )}
            {tab === 'integration' && (
              <IntegrationSetup config={config} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Account config form ---- */

function AccountForm({ config, onSaved }: { config: AppConfigPublic | null; onSaved: (c: AppConfigPublic) => void }) {
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [appKeyChanged, setAppKeyChanged] = useState(false);

  const [account, setAccount] = useState('');
  const [environment, setEnvironment] = useState('vtexcommercestable.com.br');
  const [appKey, setAppKey] = useState('');
  const [appToken, setAppToken] = useState('');
  const [integrationMode, setIntegrationMode] = useState<'FEED' | 'HOOK'>('HOOK');
  const [autoCommitFeed, setAutoCommitFeed] = useState(false);
  const [simulateErpFailure, setSimulateErpFailure] = useState(false);

  useEffect(() => {
    if (config) {
      setAccount(config.account ?? '');
      setEnvironment(config.environment ?? 'vtexcommercestable.com.br');
      setIntegrationMode(config.integrationMode ?? 'HOOK');
      setAutoCommitFeed(config.autoCommitFeed ?? false);
      setSimulateErpFailure(config.simulateErpFailure ?? false);
    }
  }, [config]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveOk(false);
    setSaveError(null);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account,
          environment,
          appKey: appKey || undefined,
          appToken: appToken || undefined,
          integrationMode,
          autoCommitFeed,
          simulateErpFailure,
        }),
      });
      const data = await res.json() as { config: AppConfigPublic };
      if (appKey.length > 0) setAppKeyChanged(true);
      setAppToken('');
      setAppKey('');
      setSaveOk(true);
      onSaved(data.config);
    } catch {
      setSaveError('Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="VTEX Account">
          <input type="text" placeholder="mystore" value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Environment">
          <input type="text" value={environment} onChange={(e) => setEnvironment(e.target.value)} className={inputCls} />
        </Field>
        <Field
          label={
            <span className="flex items-center gap-1.5">
              App Key
              {config?.appKey && (
                <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                  configured · {config.appKey}
                </span>
              )}
            </span>
          }
        >
          <input type="text" placeholder="vtexappkey-..." value={appKey} onChange={(e) => setAppKey(e.target.value)} className={inputCls} />
        </Field>
        <Field
          label={
            <span className="flex items-center gap-1.5">
              App Token
              {config?.appTokenConfigured && (
                <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">configured</span>
              )}
            </span>
          }
        >
          <input type="password" placeholder="leave blank to keep current" value={appToken} onChange={(e) => setAppToken(e.target.value)} autoComplete="new-password" className={inputCls} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <Field label="Integration Mode" inline>
          <select value={integrationMode} onChange={(e) => setIntegrationMode(e.target.value as 'FEED' | 'HOOK')} className={inputCls + ' w-28'}>
            <option value="HOOK">HOOK</option>
            <option value="FEED">FEED</option>
          </select>
        </Field>
        <Toggle label="Auto-commit Feed" checked={autoCommitFeed} onChange={setAutoCommitFeed} />
        <Toggle label="Simulate ERP Failure" checked={simulateErpFailure} onChange={setSimulateErpFailure} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          {saveOk && <p className="text-xs text-green-600 font-medium">Configuration saved.</p>}
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 text-sm font-semibold rounded-md disabled:opacity-50 transition-colors"
          style={{ background: '#F71963', color: '#fff' }}
        >
          {saving ? 'Saving…' : 'Save Configuration'}
        </button>
      </div>

      {appKeyChanged && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>
            App Key changed — remember to re-register the Hook URL in VTEX using the new App Key.
            Each App Key supports only one Hook endpoint.
          </span>
        </div>
      )}
    </form>
  );
}

/* ---- Shared helpers ---- */

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
        active ? 'border-[#F71963] text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

const inputCls =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring';

function Field({ label, children, inline = false }: { label: React.ReactNode; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className={['flex gap-1.5 text-xs font-medium text-muted-foreground', inline ? 'flex-row items-center' : 'flex-col'].join(' ')}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-input" />
      {label}
    </label>
  );
}
