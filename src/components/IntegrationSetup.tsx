'use client';

import { useState } from 'react';
import type { AppConfigPublic } from '@/types';

interface Props {
  config: AppConfigPublic | null;
}

type ConfigType = 'hook' | 'feed';

interface PanelState {
  json: string;
  loading: boolean;
  saving: boolean;
  response: string | null;
  responseOk: boolean;
}

const HOOK_TEMPLATE = JSON.stringify(
  {
    filter: {
      type: 'FromWorkflow',
      status: ['order-completed', 'on-order-completed'],
    },
    hook: {
      headers: {},
      url: '',
    },
  },
  null,
  2,
);

const FEED_TEMPLATE = JSON.stringify(
  {
    filter: {
      type: 'FromWorkflow',
      status: ['order-completed'],
    },
    queue: {
      visibilityTimeoutInSeconds: 240,
      messageRetentionPeriodInSeconds: 345600,
    },
  },
  null,
  2,
);

function usePanel(type: ConfigType, account: string | null | undefined, hookUrl: string) {
  const [state, setState] = useState<PanelState>({
    json: type === 'hook' ? HOOK_TEMPLATE : FEED_TEMPLATE,
    loading: false,
    saving: false,
    response: null,
    responseOk: false,
  });

  const accountParam = account ? `?account=${encodeURIComponent(account)}` : '';
  const endpoint = `/api/vtex/config/${type}${accountParam}`;

  async function load() {
    setState((s) => ({ ...s, loading: true, response: null }));
    try {
      const res = await fetch(endpoint);
      const data = await res.json() as { ok?: boolean; data?: unknown; error?: string };
      if (res.ok && data.ok) {
        // Auto-populate hook URL when loading hook config
        let parsed = data.data;
        if (type === 'hook' && hookUrl && parsed && typeof parsed === 'object') {
          const p = parsed as Record<string, unknown>;
          if (!p.hook || typeof p.hook !== 'object') {
            p.hook = { headers: {}, url: hookUrl };
          } else {
            const h = p.hook as Record<string, unknown>;
            if (!h.url) h.url = hookUrl;
          }
          parsed = p;
        }
        setState((s) => ({
          ...s,
          loading: false,
          json: JSON.stringify(parsed, null, 2),
          response: 'Loaded current config from VTEX.',
          responseOk: true,
        }));
      } else {
        setState((s) => ({
          ...s,
          loading: false,
          response: data.error ?? 'Failed to load config.',
          responseOk: false,
        }));
      }
    } catch {
      setState((s) => ({ ...s, loading: false, response: 'Network error.', responseOk: false }));
    }
  }

  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(state.json);
    } catch {
      setState((s) => ({ ...s, response: 'Invalid JSON — fix syntax errors before saving.', responseOk: false }));
      return;
    }
    setState((s) => ({ ...s, saving: true, response: null }));
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setState((s) => ({ ...s, saving: false, response: 'Config saved successfully.', responseOk: true }));
      } else {
        setState((s) => ({
          ...s,
          saving: false,
          response: data.error ?? 'Failed to save config.',
          responseOk: false,
        }));
      }
    } catch {
      setState((s) => ({ ...s, saving: false, response: 'Network error.', responseOk: false }));
    }
  }

  return { state, setState, load, save };
}

export function IntegrationSetup({ config }: Props) {
  const hookUrl =
    typeof window !== 'undefined' && config?.account
      ? `${window.location.origin}/api/vtex/hook?account=${encodeURIComponent(config.account)}`
      : config?.account
        ? `/api/vtex/hook?account=${encodeURIComponent(config.account)}`
        : '/api/vtex/hook';

  const hook = usePanel('hook', config?.account, hookUrl);
  const feed = usePanel('feed', config?.account, hookUrl);

  const credsMissing = !config?.appTokenConfigured;

  return (
    <div className="space-y-6">
      {credsMissing && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>⚠</span>
          <span>VTEX credentials must be configured before loading or saving integration config.</span>
        </div>
      )}

      <div className="rounded-lg border border-amber-300/40 bg-amber-50/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 dark:bg-amber-900/10">
        <strong>Warning:</strong> Saving will overwrite the current VTEX configuration for this account.
        Changes take effect immediately in VTEX.
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ConfigPanel
          title="Hook Configuration"
          description="Register a webhook URL that VTEX calls when order status changes."
          type="hook"
          panelState={hook.state}
          onLoad={hook.load}
          onSave={hook.save}
          onJsonChange={(v) => hook.setState((s) => ({ ...s, json: v }))}
          curlGet={`curl -X GET "https://${config?.account ?? '{account}'}.${config?.environment ?? 'vtexcommercestable.com.br'}/api/orders/hook/config" \\
  -H "X-VTEX-API-AppKey: {appKey}" \\
  -H "X-VTEX-API-AppToken: {appToken}"`}
          curlPost={`curl -X POST "https://${config?.account ?? '{account}'}.${config?.environment ?? 'vtexcommercestable.com.br'}/api/orders/hook/config" \\
  -H "X-VTEX-API-AppKey: {appKey}" \\
  -H "X-VTEX-API-AppToken: {appToken}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ filter: { type: 'FromWorkflow', status: ['order-completed'] }, hook: { headers: {}, url: hookUrl } })}'`}
        />

        <ConfigPanel
          title="Feed Configuration"
          description="Configure the order event queue that your app polls periodically."
          type="feed"
          panelState={feed.state}
          onLoad={feed.load}
          onSave={feed.save}
          onJsonChange={(v) => feed.setState((s) => ({ ...s, json: v }))}
          curlGet={`curl -X GET "https://${config?.account ?? '{account}'}.${config?.environment ?? 'vtexcommercestable.com.br'}/api/orders/feed/config" \\
  -H "X-VTEX-API-AppKey: {appKey}" \\
  -H "X-VTEX-API-AppToken: {appToken}"`}
          curlPost={`curl -X POST "https://${config?.account ?? '{account}'}.${config?.environment ?? 'vtexcommercestable.com.br'}/api/orders/feed/config" \\
  -H "X-VTEX-API-AppKey: {appKey}" \\
  -H "X-VTEX-API-AppToken: {appToken}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ filter: { type: 'FromWorkflow', status: ['order-completed'] }, queue: { visibilityTimeoutInSeconds: 240, messageRetentionPeriodInSeconds: 345600 } })}'`}
        />
      </div>
    </div>
  );
}

interface ConfigPanelProps {
  title: string;
  description: string;
  type: ConfigType;
  panelState: PanelState;
  onLoad: () => void;
  onSave: () => void;
  onJsonChange: (v: string) => void;
  curlGet: string;
  curlPost: string;
}

function ConfigPanel({
  title,
  description,
  panelState,
  onLoad,
  onSave,
  onJsonChange,
  curlGet,
  curlPost,
}: ConfigPanelProps) {
  const [showCurl, setShowCurl] = useState(false);
  const [copiedGet, setCopiedGet] = useState(false);
  const [copiedPost, setCopiedPost] = useState(false);

  function copyText(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onLoad}
          disabled={panelState.loading}
          className="px-3 py-1.5 text-xs font-medium rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          {panelState.loading ? 'Loading…' : 'Load Current Config'}
        </button>
        <button
          onClick={onSave}
          disabled={panelState.saving}
          className="px-3 py-1.5 text-xs font-semibold rounded transition-colors disabled:opacity-50"
          style={{ background: '#F71963', color: '#fff' }}
        >
          {panelState.saving ? 'Saving…' : 'Save Config'}
        </button>
        <button
          onClick={() => setShowCurl((v) => !v)}
          className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted transition-colors ml-auto"
        >
          {showCurl ? 'Hide cURL' : 'cURL Examples'}
        </button>
      </div>

      <textarea
        value={panelState.json}
        onChange={(e) => onJsonChange(e.target.value)}
        rows={14}
        spellCheck={false}
        className="w-full font-mono text-[11px] rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-y leading-relaxed"
      />

      {panelState.response && (
        <div
          className={[
            'px-3 py-2 rounded-md text-xs font-medium',
            panelState.responseOk
              ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
          ].join(' ')}
        >
          {panelState.response}
        </div>
      )}

      {showCurl && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">cURL Examples</p>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-mono">GET (read current config)</span>
              <button
                onClick={() => copyText(curlGet, setCopiedGet)}
                className="text-[10px] px-1.5 py-0.5 border border-border rounded hover:bg-muted transition-colors"
              >
                {copiedGet ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="text-[10px] bg-muted/60 rounded-md p-2 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap break-all">
              {curlGet}
            </pre>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-mono">POST (save config)</span>
              <button
                onClick={() => copyText(curlPost, setCopiedPost)}
                className="text-[10px] px-1.5 py-0.5 border border-border rounded hover:bg-muted transition-colors"
              >
                {copiedPost ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="text-[10px] bg-muted/60 rounded-md p-2 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap break-all">
              {curlPost}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
