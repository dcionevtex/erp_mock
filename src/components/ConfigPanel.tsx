'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { AppConfigPublic } from '@/types';

interface ConfigPanelProps {
  onSaved?: (config: AppConfigPublic) => void;
}

export function ConfigPanel({ onSaved }: ConfigPanelProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<AppConfigPublic | null>(null);
  const [appKeyChanged, setAppKeyChanged] = useState(false);

  const [account, setAccount] = useState('');
  const [environment, setEnvironment] = useState('vtexcommercestable.com.br');
  const [appKey, setAppKey] = useState('');
  const [appToken, setAppToken] = useState('');
  const [integrationMode, setIntegrationMode] = useState<'FEED' | 'HOOK'>('HOOK');
  const [autoCommitFeed, setAutoCommitFeed] = useState(false);
  const [simulateErpFailure, setSimulateErpFailure] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data: { config: AppConfigPublic }) => {
        const c = data.config;
        setCurrent(c);
        setAccount(c.account ?? '');
        setEnvironment(c.environment ?? 'vtexcommercestable.com.br');
        setIntegrationMode(c.integrationMode ?? 'HOOK');
        setAutoCommitFeed(c.autoCommitFeed ?? false);
        setSimulateErpFailure(c.simulateErpFailure ?? false);
      })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
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
      setCurrent(data.config);
      if (appKey.length > 0) setAppKeyChanged(true);
      setAppToken('');
      setAppKey('');
      onSaved?.(data.config);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  const credsMissing = !current?.appTokenConfigured;

  return (
    <div className="border border-border rounded-lg bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">Configuration</span>
          {current && (
            <span className="text-xs text-muted-foreground">
              {current.account || 'no account set'} · {current.integrationMode} mode
            </span>
          )}
          {credsMissing && (
            <span className="text-xs text-destructive font-medium">⚠ credentials missing</span>
          )}
        </div>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <form onSubmit={handleSave} className="border-t border-border px-4 pb-4 pt-3 space-y-3">
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
                  {current?.appKey && (
                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1 rounded">
                      configured · {current.appKey}
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
                  {current?.appTokenConfigured && (
                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1 rounded">configured</span>
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

          <div className="flex flex-wrap gap-4 items-center pt-1">
            <Field label="Integration Mode" inline>
              <select
                value={integrationMode}
                onChange={(e) => setIntegrationMode(e.target.value as 'FEED' | 'HOOK')}
                className={cn(inputCls, 'w-28')}
              >
                <option value="HOOK">HOOK</option>
                <option value="FEED">FEED</option>
              </select>
            </Field>

            <Toggle label="Auto-commit Feed" checked={autoCommitFeed} onChange={setAutoCommitFeed} />
            <Toggle label="Simulate ERP Failure" checked={simulateErpFailure} onChange={setSimulateErpFailure} />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>

          {appKeyChanged && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>
                App Key changed — remember to re-register the Hook URL in VTEX using the new App Key
                (<code className="font-mono">PUT /api/orders/hook/config</code>).
                Each App Key supports only one Hook endpoint.
              </span>
            </div>
          )}
        </form>
      )}
    </div>
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
    <label className={cn('flex gap-1.5 text-xs font-medium text-muted-foreground', inline ? 'flex-row items-center' : 'flex-col')}>
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
