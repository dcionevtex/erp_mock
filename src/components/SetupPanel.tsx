'use client';

import { useState, useEffect, useCallback } from 'react';
import { IntegrationSetup } from './IntegrationSetup';
import type { AppConfigPublic } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (config: AppConfigPublic) => void;
  config: AppConfigPublic | null;
}

type SetupTab = 'account' | 'integration';

export function SetupPanel({ open, onClose, onSaved, config }: Props) {
  const [tab, setTab] = useState<SetupTab>('account');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const [account, setAccount] = useState('');
  const [environment, setEnvironment] = useState('vtexcommercestable.com.br');
  const [appKey, setAppKey] = useState('');
  const [appToken, setAppToken] = useState('');
  const [integrationMode, setIntegrationMode] = useState<'FEED' | 'HOOK'>('HOOK');
  const [autoCommitFeed, setAutoCommitFeed] = useState(false);
  const [simulateErpFailure, setSimulateErpFailure] = useState(false);
  const [appKeyChanged, setAppKeyChanged] = useState(false);

  useEffect(() => {
    if (config) {
      setAccount(config.account ?? '');
      setEnvironment(config.environment ?? 'vtexcommercestable.com.br');
      setIntegrationMode(config.integrationMode ?? 'HOOK');
      setAutoCommitFeed(config.autoCommitFeed ?? false);
      setSimulateErpFailure(config.simulateErpFailure ?? false);
    }
  }, [config]);

  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
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

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Setup"
        className="fixed right-0 top-0 h-full w-full max-w-2xl z-50 flex flex-col shadow-2xl"
        style={{ background: 'var(--background)' }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0"
          style={{ background: '#142032' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Setup</span>
            {config?.account && (
              <span className="text-xs text-white/40">{config.account}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border shrink-0 px-5">
          <TabBtn active={tab === 'account'} onClick={() => setTab('account')}>
            Account Configuration
          </TabBtn>
          <TabBtn active={tab === 'integration'} onClick={() => setTab('integration')}>
            Hook &amp; Feed Configuration
          </TabBtn>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'account' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="VTEX Account">
                  <input
                    type="text"
                    placeholder="mystore"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Environment">
                  <input
                    type="text"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className={inputCls}
                  />
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
                  <input
                    type="text"
                    placeholder="vtexappkey-..."
                    value={appKey}
                    onChange={(e) => setAppKey(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field
                  label={
                    <span className="flex items-center gap-1.5">
                      App Token
                      {config?.appTokenConfigured && (
                        <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          configured
                        </span>
                      )}
                    </span>
                  }
                >
                  <input
                    type="password"
                    placeholder="leave blank to keep current"
                    value={appToken}
                    onChange={(e) => setAppToken(e.target.value)}
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                <Field label="Integration Mode" inline>
                  <select
                    value={integrationMode}
                    onChange={(e) => setIntegrationMode(e.target.value as 'FEED' | 'HOOK')}
                    className={inputCls + ' w-28'}
                  >
                    <option value="HOOK">HOOK</option>
                    <option value="FEED">FEED</option>
                  </select>
                </Field>
                <Toggle label="Auto-commit Feed" checked={autoCommitFeed} onChange={setAutoCommitFeed} />
                <Toggle label="Simulate ERP Failure" checked={simulateErpFailure} onChange={setSimulateErpFailure} />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="space-y-1">
                  {saveOk && (
                    <p className="text-xs text-green-600 font-medium">Configuration saved.</p>
                  )}
                  {saveError && (
                    <p className="text-xs text-destructive">{saveError}</p>
                  )}
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
                    App Key changed — remember to re-register the Hook URL in VTEX using the new App
                    Key (<code className="font-mono">PUT /api/orders/hook/config</code>).
                    Each App Key supports only one Hook endpoint.
                  </span>
                </div>
              )}
            </form>
          )}

          {tab === 'integration' && (
            <IntegrationSetup config={config} />
          )}
        </div>
      </div>
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'border-[#F71963] text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

const inputCls =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring';

function Field({
  label,
  children,
  inline = false,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <label
      className={['flex gap-1.5 text-xs font-medium text-muted-foreground', inline ? 'flex-row items-center' : 'flex-col'].join(' ')}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input"
      />
      {label}
    </label>
  );
}
