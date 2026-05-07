import { AppShell } from '@/components/AppShell';
import { Footer } from '@/components/Footer';

type ReleaseEntry = {
  version: string;
  date: string;
  tag?: 'latest';
  changes: Array<{ type: 'feat' | 'fix' | 'chore'; text: string }>;
};

const RELEASES: ReleaseEntry[] = [
  {
    version: '1.0.6',
    date: 'May 7, 2026',
    tag: 'latest',
    changes: [
      { type: 'feat', text: 'Mock DANFE (Nota Fiscal Eletrônica) sheet available on invoiced orders' },
      { type: 'feat', text: 'DANFE card appears in order modal alongside Shipping Label once invoice is sent' },
      { type: 'feat', text: 'Imprimir DANFE button opens a printable A4 DANFE document in a new window' },
      { type: 'feat', text: 'Access key barcode generated deterministically from orderId using CODE128' },
      { type: 'feat', text: 'Full DANFE layout: emitente, destinatário, cálculo de imposto, transportadora, produtos, dados adicionais' },
    ],
  },
  {
    version: '1.0.5',
    date: 'May 7, 2026',
    changes: [
      { type: 'feat', text: 'Release Notes moved to dedicated sidebar page' },
      { type: 'chore', text: 'Release Notes removed from dashboard tabs' },
      { type: 'chore', text: 'CLAUDE.md updated with release file location' },
    ],
  },
  {
    version: '1.0.4',
    date: 'May 7, 2026',
    changes: [
      { type: 'feat', text: 'Bulk select on orders inbox — checkbox per row with select-all on current page' },
      { type: 'feat', text: 'Bulk Delete action with confirmation dialog' },
      { type: 'feat', text: 'Bulk Mark as Resolved action' },
      { type: 'feat', text: 'New POST /api/erp/orders/bulk endpoint' },
      { type: 'feat', text: 'Release Notes tab introduced' },
    ],
  },
  {
    version: '1.0.3',
    date: 'May 4, 2026',
    changes: [
      { type: 'feat', text: 'Collapsible sidebar with hamburger toggle and localStorage persistence' },
      { type: 'feat', text: 'AppShell layout wrapper — sidebar + scrollable content area' },
      { type: 'feat', text: 'Pagination (50 items per page) for orders inbox and event log' },
      { type: 'fix', text: 'Orders table width and scroll containment inside AppShell' },
      { type: 'chore', text: 'Login redirects to Documentation page after sign-in' },
    ],
  },
  {
    version: '1.0.2',
    date: 'May 3, 2026',
    changes: [
      { type: 'feat', text: 'Account mismatch guard — blocks VTEX API calls when account does not match configured credentials' },
      { type: 'feat', text: 'Multi-select account filter dropdown on orders inbox' },
      { type: 'feat', text: 'Recommended VTEX statuses pre-loaded in Hook/Feed configuration templates' },
      { type: 'feat', text: 'Order detail opens in modal instead of inline accordion' },
      { type: 'fix', text: 'Hook endpoint acks VTEX immediately and processes order asynchronously to prevent retries' },
    ],
  },
  {
    version: '1.0.1',
    date: 'April 30, 2026',
    changes: [
      { type: 'feat', text: 'Hook & Feed configuration editor with status filter and auto-commit toggle' },
      { type: 'feat', text: 'Inline Setup card replaces header drawer' },
      { type: 'feat', text: 'Weekly auto-purge cron — orders older than 7 days are removed automatically' },
      { type: 'feat', text: 'Styled webhook endpoint display card with copy button' },
      { type: 'feat', text: 'Prominent credentials warning banner on dashboard' },
      { type: 'feat', text: 'Login page redesigned with full T&C disclaimer and agreement checkbox' },
      { type: 'feat', text: 'Footer redesigned with vision statement and demo disclaimer' },
      { type: 'fix', text: 'Credentials isolated per browser session — no cross-user leakage on shared deployments' },
    ],
  },
  {
    version: '1.0.0',
    date: 'April 28–29, 2026',
    changes: [
      { type: 'feat', text: 'Project scaffold — Next.js 16, TypeScript strict, shadcn/ui, Vitest 4' },
      { type: 'feat', text: 'VTEX Hook endpoint (POST /api/vtex/hook)' },
      { type: 'feat', text: 'VTEX Feed polling (POST /api/vtex/feed/poll) with manual trigger' },
      { type: 'feat', text: 'VTEX Get Order API client' },
      { type: 'feat', text: 'ERP payload normalizer and simulated ERP acceptance' },
      { type: 'feat', text: 'Mandatory Start Handling after ERP acceptance' },
      { type: 'feat', text: 'Unified ERP Orders inbox — Feed and Hook in one view' },
      { type: 'feat', text: 'Processing timeline per order' },
      { type: 'feat', text: 'PII masking (email, document, address)' },
      { type: 'feat', text: 'Event deduplication with idempotency keys' },
      { type: 'feat', text: 'Technical event log' },
      { type: 'feat', text: 'In-memory store with optional Postgres persistence via DATABASE_URL' },
    ],
  },
];

const CHANGE_TYPE_STYLE: Record<ReleaseEntry['changes'][number]['type'], { label: string; cls: string }> = {
  feat:  { label: 'feat',  cls: 'bg-blue-50 text-blue-700' },
  fix:   { label: 'fix',   cls: 'bg-amber-50 text-amber-700' },
  chore: { label: 'chore', cls: 'bg-gray-100 text-gray-500' },
};

export default function ReleaseNotesPage() {
  return (
    <AppShell>
      <div className="bg-background min-h-full flex flex-col">
        <header
          className="border-b border-white/10 px-6 py-4 sticky top-0 z-10"
          style={{ background: '#142032' }}
        >
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-black tracking-tighter" style={{ color: '#F71963' }}>VTEX</span>
            <span className="text-white/20 text-lg font-thin">|</span>
            <h1 className="text-sm font-semibold text-white/90">Release Notes</h1>
          </div>
        </header>

        <main className="flex-1 px-6 py-6 max-w-2xl">
          <div className="space-y-6">
            {RELEASES.map((release) => (
              <div key={release.version} className="rounded-xl border border-border bg-card overflow-hidden">
                <div
                  className="flex items-center gap-3 px-5 py-3 border-b border-border/60"
                  style={{ background: 'linear-gradient(to right, #142032 0%, #1e2f44 100%)' }}
                >
                  <span className="text-sm font-bold text-white font-mono">{release.version}</span>
                  {release.tag && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: '#F71963', color: '#fff' }}
                    >
                      {release.tag}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-white/40">{release.date}</span>
                </div>

                <ul className="divide-y divide-border/40">
                  {release.changes.map((change, i) => {
                    const style = CHANGE_TYPE_STYLE[change.type];
                    return (
                      <li key={i} className="flex items-start gap-3 px-5 py-2.5">
                        <span className={`mt-0.5 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${style.cls}`}>
                          {style.label}
                        </span>
                        <span className="text-sm text-foreground leading-snug">{change.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </main>

        <Footer />
      </div>
    </AppShell>
  );
}
