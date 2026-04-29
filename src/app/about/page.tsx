import Link from 'next/link';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'About — VTEX ERP Connect',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="border-b border-border px-4 py-0 flex items-stretch justify-between gap-4 sticky top-0 z-10" style={{ background: '#142032' }}>
        <div className="flex items-center gap-4 py-3">
          <span className="text-xl font-black tracking-tighter leading-none" style={{ color: '#F71963' }}>VTEX</span>
          <span className="text-white/20 text-lg font-thin">|</span>
          <span className="text-sm font-semibold text-white/90">ERP Connect</span>
          <span className="text-white/20 text-lg font-thin hidden sm:block">|</span>
          <span className="text-sm text-white/50 hidden sm:block">Documentation</span>
        </div>
        <div className="flex items-center">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors rounded"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11L5 7l4-4" />
            </svg>
            Back to Console
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 max-w-4xl mx-auto w-full space-y-8">

        {/* Hero */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-5" style={{ background: '#142032' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl font-black tracking-tighter" style={{ color: '#F71963' }}>VTEX</span>
                  <span className="text-xl font-semibold text-white">ERP Connect</span>
                </div>
                <p className="text-white/60 text-sm max-w-xl leading-relaxed">
                  A demo-grade middleware that simulates the operational handoff between VTEX OMS and an external ERP system — using the official VTEX Feed and Hook integration patterns.
                </p>
              </div>
              <div className="shrink-0 hidden sm:flex flex-col items-end gap-1">
                <Badge color="pink">Demo App</Badge>
                <Badge color="navy">Next.js 16</Badge>
                <Badge color="navy">Vercel</Badge>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-muted/30 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Integration modes" value="Feed + Hook" />
            <Stat label="VTEX APIs used" value="3" />
            <Stat label="API endpoints" value="11" />
            <Stat label="Persistence" value="Neon Postgres" />
          </div>
        </div>

        {/* What it does */}
        <Section title="What It Does">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            ERP Connect simulates the external ERP side of a VTEX order integration. When an order is placed in VTEX, this app receives the event (via Hook or Feed), fetches the full order from VTEX OMS, normalizes it into an ERP payload, simulates ERP acceptance, and calls VTEX Start Handling to confirm the handoff.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <FeatureCard
              icon={<HookIcon />}
              title="Hook Mode"
              description="VTEX pushes order events to the app's webhook endpoint in real time. Ideal for low-latency ERP handoffs."
            />
            <FeatureCard
              icon={<FeedIcon />}
              title="Feed Mode"
              description="The operator manually polls the VTEX Feed queue. The app reads up to 5 pending events and processes each one."
            />
            <FeatureCard
              icon={<InboxIcon />}
              title="ERP Inbox"
              description="Every processed order lands in a unified inbox with status tracking, timeline, payload viewer, and manual actions."
            />
          </div>
        </Section>

        {/* Integration flows */}
        <Section title="Integration Flows">
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Hook Flow</h3>
              <Flow steps={[
                { label: 'VTEX OMS', sub: 'order placed' },
                { label: 'POST /api/vtex/hook', sub: 'event received' },
                { label: 'Get Order', sub: 'VTEX API' },
                { label: 'ERP Simulate', sub: 'normalize + accept' },
                { label: 'Start Handling', sub: 'VTEX API' },
                { label: 'ERP Inbox', sub: 'order visible' },
              ]} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Feed Flow</h3>
              <Flow steps={[
                { label: 'Poll Feed Now', sub: 'operator action' },
                { label: 'VTEX Feed API', sub: 'fetch queue' },
                { label: 'Deduplicate', sub: 'skip seen events' },
                { label: 'Get Order', sub: 'VTEX API' },
                { label: 'ERP Simulate', sub: 'normalize + accept' },
                { label: 'Start Handling', sub: 'VTEX API' },
              ]} />
            </div>
          </div>
        </Section>

        {/* Configuration */}
        <Section title="Configuration">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Open the Configuration panel on the main console. All fields are optional if the equivalent environment variables are set.
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left text-muted-foreground uppercase tracking-wide text-[10px]">
                  <th className="px-4 py-2.5 font-semibold">Field</th>
                  <th className="px-4 py-2.5 font-semibold">Env Variable</th>
                  <th className="px-4 py-2.5 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {[
                  ['VTEX Account', 'VTEX_ACCOUNT', 'Your VTEX store account name (e.g. mystore)'],
                  ['Environment', 'VTEX_ENVIRONMENT', 'Default: vtexcommercestable.com.br'],
                  ['App Key', 'VTEX_APP_KEY', 'VTEX App Key — not a secret, displayed in UI'],
                  ['App Token', 'VTEX_APP_TOKEN', 'VTEX App Token — encrypted, never returned to client'],
                  ['Integration Mode', '—', 'FEED or HOOK — determines active integration path'],
                  ['Auto Commit Feed', 'AUTO_COMMIT_FEED', 'Acknowledge feed handles after processing (true/false)'],
                  ['Simulate ERP Failure', 'SIMULATE_ERP_FAILURE', 'Force ERP simulation to fail for testing error flows'],
                ].map(([field, env, desc]) => (
                  <tr key={field} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{field}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{env}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Credentials are persisted to Neon Postgres so webhook calls work across serverless cold starts. Re-save credentials once after each Vercel deployment.
          </p>
        </Section>

        {/* Order status reference */}
        <Section title="Order Status Reference">
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left text-muted-foreground uppercase tracking-wide text-[10px]">
                  <th className="px-4 py-2.5 font-semibold">ERP Status</th>
                  <th className="px-4 py-2.5 font-semibold">Meaning</th>
                  <th className="px-4 py-2.5 font-semibold">Next step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {[
                  ['RECEIVED', 'Event received, pipeline not yet started', 'Automatic — processing begins immediately'],
                  ['PROCESSING', 'Pipeline is actively running', 'Wait'],
                  ['ERP_ACCEPTED', 'ERP simulation succeeded, Start Handling pending', 'Start Handling will be called automatically'],
                  ['START_HANDLING_SUCCESS', 'Full pipeline completed — terminal success', 'No action needed'],
                  ['START_HANDLING_ERROR', 'ERP accepted but Start Handling failed', 'Use Retry Start Handling action'],
                  ['ERROR', 'Pipeline failed (Get Order or ERP simulation)', 'Use Reprocess action after fixing credentials'],
                  ['DUPLICATE_IGNORED', 'Event already processed — skipped', 'No action needed'],
                  ['MANUALLY_RESOLVED', 'Marked resolved by operator — terminal', 'No action needed'],
                  ['CANCELLED', 'Order was cancelled in VTEX', 'No action needed'],
                ].map(([status, meaning, next]) => (
                  <tr key={status} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-medium text-foreground">{status}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{meaning}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* API Reference */}
        <Section title="API Reference">
          <div className="space-y-2">
            {[
              { method: 'POST', path: '/api/vtex/hook', desc: 'Receive a VTEX order event — runs the full pipeline' },
              { method: 'POST', path: '/api/vtex/feed/poll', desc: 'Poll the VTEX Feed queue and process up to 5 events' },
              { method: 'POST', path: '/api/vtex/orders/:orderId/start-handling', desc: 'Manually trigger Start Handling for an order' },
              { method: 'GET',  path: '/api/erp/orders', desc: 'List all ERP orders — supports filter, search, sort' },
              { method: 'GET',  path: '/api/erp/orders/:orderId', desc: 'Get a single order record with full payload and timeline' },
              { method: 'POST', path: '/api/erp/orders/:orderId/reprocess', desc: 'Reset and re-run the full pipeline for an order' },
              { method: 'POST', path: '/api/erp/orders/:orderId/retry-start-handling', desc: 'Retry Start Handling without reprocessing' },
              { method: 'POST', path: '/api/erp/orders/:orderId/resolve', desc: 'Mark an order as MANUALLY_RESOLVED' },
              { method: 'DELETE', path: '/api/erp/orders/:orderId', desc: 'Permanently delete an order from the inbox' },
              { method: 'GET',  path: '/api/config', desc: 'Read public-safe configuration (App Token is never returned)' },
              { method: 'POST', path: '/api/config', desc: 'Update runtime configuration and credentials' },
              { method: 'GET',  path: '/api/erp/events', desc: 'Read the technical event log (newest first)' },
              { method: 'DELETE', path: '/api/erp/events', desc: 'Clear the entire event log' },
              { method: 'GET',  path: '/api/health', desc: 'DB connectivity check + row counts' },
            ].map(({ method, path, desc }) => (
              <div key={path} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors">
                <span className={`shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${methodColor(method)}`}>
                  {method}
                </span>
                <code className="text-xs font-mono text-foreground shrink-0 pt-0.5">{path}</code>
                <span className="text-xs text-muted-foreground pt-0.5 leading-relaxed">{desc}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Tech Stack */}
        <Section title="Tech Stack">
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { name: 'Next.js 16', role: 'App framework — App Router, serverless API routes' },
              { name: 'TypeScript', role: 'Full type safety across client and server' },
              { name: 'Tailwind CSS v4', role: 'Utility-first styling with oklch color space' },
              { name: 'Neon Postgres', role: 'Serverless Postgres — order + event persistence' },
              { name: 'iron-session', role: 'Encrypted HttpOnly cookie for credential storage' },
              { name: 'JsBarcode', role: 'CODE128 barcode generation for shipping labels' },
              { name: 'Vercel', role: 'Deployment — serverless functions + edge network' },
            ].map(({ name, role }) => (
              <div key={name} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border bg-card">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#F71963' }} />
                <div>
                  <div className="text-sm font-semibold text-foreground">{name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{role}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Built by */}
        <div className="rounded-xl border border-border bg-card px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Built by</div>
            <a
              href="https://github.com/dcionevtex"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-foreground hover:underline"
            >
              @dcionevtex
            </a>
            <span className="text-xs text-muted-foreground ml-2">· VTEX</span>
          </div>
          <a
            href="https://developers.vtex.com/docs/guides/erp-integration-set-up-order-integration"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            VTEX ERP Integration Guide
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 9.5l7-7M4 2.5h5.5v5.5" />
            </svg>
          </a>
        </div>

      </main>
      <Footer />
    </div>
  );
}

/* ─── Local components ─────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-3">
        <span className="w-1 h-5 rounded-full shrink-0" style={{ background: '#F71963' }} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: 'pink' | 'navy' }) {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={
        color === 'pink'
          ? { background: '#F71963', color: '#fff' }
          : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }
      }
    >
      {children}
    </span>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(247,25,99,0.08)' }}>
        {icon}
      </div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground leading-relaxed">{description}</div>
    </div>
  );
}

function Flow({ steps }: { steps: { label: string; sub: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-0">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center px-3 py-2 rounded-lg border border-border bg-card text-center min-w-[90px]">
            <span className="text-xs font-medium text-foreground leading-tight">{step.label}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{step.sub}</span>
          </div>
          {i < steps.length - 1 && (
            <svg className="w-5 h-5 text-muted-foreground/40 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7.293 4.293a1 1 0 0 1 1.414 0l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L11.586 10 7.293 5.707a1 1 0 0 1 0-1.414z" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

function methodColor(method: string) {
  if (method === 'GET') return 'bg-blue-50 text-blue-600';
  if (method === 'POST') return 'bg-emerald-50 text-emerald-600';
  if (method === 'DELETE') return 'bg-red-50 text-red-600';
  return 'bg-muted text-muted-foreground';
}

function HookIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="#F71963" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2l4 4-4 4M2 8h8a4 4 0 0 1 0 8H8" />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="#F71963" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M2 8h8M2 12h5" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="#F71963" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10l2-7h8l2 7H2zM2 10v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
      <path d="M6 13a2 2 0 0 0 4 0" />
    </svg>
  );
}
