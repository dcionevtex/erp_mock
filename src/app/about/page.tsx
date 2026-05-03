import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { AccordionSection } from '@/components/AccordionSection';

export const metadata = {
  title: 'About — VTEX A Simple ERP Simulator',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="border-b border-border px-4 py-0 flex items-stretch justify-between gap-4 sticky top-0 z-10" style={{ background: '#142032' }}>
        <div className="flex items-center gap-4 py-3">
          <span className="text-xl font-black tracking-tighter leading-none" style={{ color: '#F71963' }}>VTEX</span>
          <span className="text-white/20 text-lg font-thin">|</span>
          <span className="text-sm font-semibold text-white/90">A Simple ERP Simulator</span>
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
                  <span className="text-xl font-semibold text-white">A Simple ERP Simulator</span>
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
            <Stat label="VTEX APIs used" value="5" />
            <Stat label="API endpoints" value="24" />
            <Stat label="Persistence" value="Neon Postgres" />
          </div>
        </div>

        {/* Seller account notice */}
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#f59e0b' }}>
          <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background: '#f59e0b' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5L14.5 13H1.5L8 1.5z" fill="rgba(0,0,0,0.15)" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M8 6v3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="0.85" fill="white" />
            </svg>
            <span className="text-white font-bold text-xs tracking-wide uppercase">Seller Account Required</span>
          </div>
          <div className="px-5 py-4 space-y-3 bg-amber-50 dark:bg-amber-950/20">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              This app is designed for <strong>seller accounts only</strong>. It will not work correctly with a marketplace account.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 text-xs text-amber-800 dark:text-amber-300">
              <div className="rounded-lg bg-white/70 dark:bg-white/5 border border-amber-200 dark:border-amber-800 px-4 py-3 space-y-1">
                <div className="font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  Seller Account ✓
                </div>
                <p className="leading-relaxed">
                  The account that <strong>owns and fulfills the orders</strong>. When an order is placed, VTEX routes it to the seller. The seller must call <strong>Start Handling</strong> to confirm it has taken responsibility for fulfillment — that's exactly what this app demonstrates.
                </p>
              </div>
              <div className="rounded-lg bg-white/70 dark:bg-white/5 border border-amber-200 dark:border-amber-800 px-4 py-3 space-y-1">
                <div className="font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                  Marketplace Account ✗
                </div>
                <p className="leading-relaxed">
                  The account that <strong>lists products and collects the sale</strong>, but delegates fulfillment to sellers. Marketplace accounts use a different API flow to sync orders with their sellers — <strong>Start Handling is not called by the marketplace</strong>, so this app's pipeline won't behave as expected.
                </p>
              </div>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Not sure which type you have? If your VTEX account has its own warehouse and ships orders directly to customers, it&apos;s a seller account. If it sells products from third-party stores, it&apos;s a marketplace.
            </p>
          </div>
        </div>

        {/* What it does */}
        <AccordionSection title="What It Does">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            A Simple ERP Simulator simulates the external ERP side of a VTEX order integration. When an order is placed in VTEX, this app receives the event (via Hook or Feed), fetches the full order from VTEX OMS, normalizes it into an ERP payload, simulates ERP acceptance, and calls VTEX Start Handling to confirm the handoff.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <FeatureCard
              icon={<HookIcon />}
              title="Hook Mode"
              description="VTEX pushes order events to the app's webhook endpoint in real time. Supports multi-account routing via ?account= — each App Key gets its own hook URL."
            />
            <FeatureCard
              icon={<FeedIcon />}
              title="Feed Mode"
              description="The operator manually polls the VTEX Feed queue. The app reads up to 5 pending events, deduplicates them, and processes each one end-to-end."
            />
            <FeatureCard
              icon={<InboxIcon />}
              title="ERP Inbox"
              description="Every processed order lands in a unified inbox with status tracking, processing timeline, payload viewer, invoice flow, shipping label, and manual actions."
            />
          </div>
        </AccordionSection>

        {/* Integration flows */}
        <AccordionSection title="Integration Flows">
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
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Invoice Flow (post-handling)</h3>
              <Flow steps={[
                { label: 'Start Handling', sub: 'SUCCESS' },
                { label: 'Send Invoice', sub: 'operator action' },
                { label: 'POST /invoice', sub: 'VTEX API' },
                { label: 'verifying-invoice', sub: 'VTEX status' },
                { label: 'Update Tracking', sub: 'optional' },
                { label: 'invoiced', sub: 'terminal' },
              ]} />
              <p className="text-xs text-muted-foreground mt-2">Once an invoice is sent the order becomes non-cancellable in VTEX.</p>
            </div>
          </div>
        </AccordionSection>

        {/* Access */}
        <AccordionSection title="Access &amp; Login">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The app is protected by a shared demo password set via the <code className="font-mono text-xs bg-muted px-1 rounded">DEMO_PASSWORD</code> environment variable (defaults to <code className="font-mono text-xs bg-muted px-1 rounded">vtex2024</code> if not set). On first visit, users are redirected to the login page where they must:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground pl-5 list-disc">
            <li>Enter the demo password.</li>
            <li>Read and explicitly agree to the Terms &amp; Conditions — the Sign in button is disabled until the checkbox is checked.</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            Credentials (VTEX App Key / App Token) are stored in an encrypted HttpOnly session cookie isolated to each browser session — one session cannot see another&apos;s credentials. Sign out destroys the cookie immediately.
          </p>
        </AccordionSection>

        {/* Configuration */}
        <AccordionSection title="Configuration">
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
                  ['Demo Password', 'DEMO_PASSWORD', 'Password for the login page. Defaults to vtex2024 if not set'],
                  ['Session Secret', 'SESSION_SECRET', 'Min 32-char secret used to encrypt the credential cookie. Generate with: openssl rand -base64 32'],
                  ['Cron Secret', 'CRON_SECRET', 'Bearer token Vercel injects when invoking the weekly cleanup cron. Leave blank to allow open access (demo only)'],
                  ['App URL', 'NEXT_PUBLIC_APP_URL', 'Public URL of the deployment — used to render the full Hook URL in the UI (e.g. https://your-app.vercel.app)'],
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
            Credentials are stored in an encrypted HttpOnly session cookie — one set per browser session. The hook endpoint resolves credentials from the per-account registry via <code className="font-mono">?account=</code> in the URL, so each VTEX account has its own isolated hook.
          </p>
        </AccordionSection>

        {/* Order status reference */}
        <AccordionSection title="Order Status Reference">
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
                  ['INVOICED', 'Invoice sent — order advancing to invoiced in VTEX', 'Optionally add tracking number'],
                  ['INVOICE_ERROR', 'Invoice POST failed', 'Retry via Send Invoice button'],
                  ['CANCELLED', 'Order was cancelled in VTEX', 'No action needed — Delete to remove from inbox'],
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
        </AccordionSection>

        {/* API Reference */}
        <AccordionSection title="API Reference">
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
              { method: 'POST', path: '/api/erp/orders/:orderId/send-invoice', desc: 'Send fiscal invoice to VTEX OMS (requires Start Handling SUCCESS)' },
              { method: 'POST', path: '/api/erp/orders/:orderId/update-tracking', desc: 'Add courier + tracking number to an already-invoiced order' },
              { method: 'POST', path: '/api/erp/orders/:orderId/cancel', desc: 'Cancel an order in VTEX (blocked once invoice is sent)' },
              { method: 'GET',  path: '/api/vtex/config/hook', desc: 'Read current VTEX Hook configuration for the account' },
              { method: 'POST', path: '/api/vtex/config/hook', desc: 'Save VTEX Hook configuration (overwrites immediately)' },
              { method: 'GET',  path: '/api/vtex/config/feed', desc: 'Read current VTEX Feed configuration for the account' },
              { method: 'POST', path: '/api/vtex/config/feed', desc: 'Save VTEX Feed configuration (overwrites immediately)' },
              { method: 'GET',  path: '/api/cron/cleanup', desc: 'Weekly cron — delete all orders and clear event log (protected by CRON_SECRET)' },
              { method: 'GET',  path: '/api/health', desc: 'DB connectivity check + row counts' },
              { method: 'POST', path: '/api/auth/login', desc: 'Verify demo password and create an authenticated session cookie' },
              { method: 'POST', path: '/api/auth/logout', desc: 'Destroy the session cookie and redirect to login' },
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

          {/* VTEX Developer References */}
          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <span className="w-3 h-px bg-border inline-block" />
              VTEX Developer References
              <span className="w-3 h-px bg-border inline-block" />
            </h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                {
                  title: 'ERP Integration Guide',
                  desc: 'Official end-to-end guide for setting up Feed/Hook order integration',
                  url: 'https://developers.vtex.com/docs/guides/erp-integration-set-up-order-integration',
                },
                {
                  title: 'Order Processing Guide',
                  desc: 'How to process orders in the ERP after receiving events from VTEX',
                  url: 'https://developers.vtex.com/docs/guides/erp-integration-set-up-order-processing',
                },
                {
                  title: 'Orders API Reference',
                  desc: 'Full VTEX OMS REST API — Get Order, Start Handling, Cancel, Feed, Hook',
                  url: 'https://developers.vtex.com/docs/api-reference/orders-api',
                },
                {
                  title: 'Invoice & Tracking Guide',
                  desc: 'How to send fiscal invoice (nota fiscal) and add tracking after dispatch',
                  url: 'https://developers.vtex.com/docs/guides/external-marketplace-integration-invoice-tracking',
                },
                {
                  title: 'Feed v3 Configuration',
                  desc: 'Set up and configure the VTEX Order Feed queue for your integration',
                  url: 'https://developers.vtex.com/docs/guides/orders-feed',
                },
                {
                  title: 'Order Flow & Statuses',
                  desc: 'VTEX order lifecycle — status transitions, cancellation rules, terminal states',
                  url: 'https://help.vtex.com/tracks/orders--2xkTisx4SXOWXQel8Jg8sa/4811ExCe3WrEiRMV3sy9n8',
                },
              ].map(({ title, desc, url }) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/20 hover:border-[#F71963]/30 transition-colors group"
                >
                  <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#F71963] opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" />
                  </svg>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground group-hover:text-[#F71963] transition-colors">{title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</div>
                  </div>
                  <svg className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground/40 group-hover:text-[#F71963]/60 transition-colors ml-auto" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 9.5l7-7M4 2.5h5.5v5.5" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </AccordionSection>

        {/* Data & Cleanup */}
        <AccordionSection title="Data &amp; Cleanup">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card px-5 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#F71963" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7" cy="7" r="5.5" />
                  <path d="M7 4v3.5l2 1.5" />
                </svg>
                <span className="text-sm font-semibold text-foreground">Weekly Auto-Purge</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A Vercel Cron job runs every <strong>Sunday at 00:00 UTC</strong> and deletes all ERP orders and event log entries. This keeps the demo environment clean for the next week of testing.
              </p>
              <p className="text-xs text-muted-foreground">
                Endpoint: <code className="font-mono text-[10px] bg-muted px-1 rounded">GET /api/cron/cleanup</code>.
                Protected by <code className="font-mono text-[10px] bg-muted px-1 rounded">CRON_SECRET</code> env var when set.
              </p>
              <p className="text-xs text-muted-foreground">
                A live countdown to the next purge is displayed in the app footer.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card px-5 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#F71963" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h10M5 4V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4M12 4l-.8 7.2A1 1 0 0 1 10.2 12H3.8a1 1 0 0 1-1-.8L2 4" />
                </svg>
                <span className="text-sm font-semibold text-foreground">What Gets Cleared</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
                <li>All records in the <code className="font-mono text-[10px] bg-muted px-1 rounded">erp_orders</code> table</li>
                <li>All entries in the <code className="font-mono text-[10px] bg-muted px-1 rounded">event_log</code> table</li>
                <li>In-memory fallback stores (on the same instance)</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-1">
                Account credentials in <code className="font-mono text-[10px] bg-muted px-1 rounded">account_configs</code> are <strong>not</strong> cleared — hook routing continues to work after the purge.
              </p>
            </div>
          </div>
        </AccordionSection>

        {/* Known Issues */}
        <AccordionSection title="Known Issues &amp; Limitations">
          <div className="space-y-3">
            {[
              {
                tag: 'HOOK',
                title: 'Same order processed twice (VTEX hook retry)',
                body: `VTEX expects the hook endpoint to respond 200 within ~3 seconds. Earlier versions of this app processed orders synchronously inside the request (Get Order + ERP simulation + Start Handling could take 3–8 s), causing VTEX to time out and re-deliver the event. The app now responds 200 immediately and processes the order in the background. An in-flight dedup lock prevents concurrent runs for the same order. `,
                fix: 'Fixed in current version — hook now acks immediately and processes async.',
                fixed: true,
              },
              {
                tag: 'FEED',
                title: 'Feed polling is manual only',
                body: 'The app does not poll VTEX Feed automatically. The operator must click "Poll Feed Now". A Vercel Cron-based background poller is listed in the v0 improvement backlog.',
                fix: 'Workaround: poll manually or set up an external cron to call POST /api/vtex/feed/poll.',
                fixed: false,
              },
              {
                tag: 'AUTH',
                title: 'Shared demo password — not production-grade',
                body: 'Access is controlled by a single shared password (DEMO_PASSWORD env var). There is no per-user authentication, session expiry, or rate limiting on the login endpoint.',
                fix: 'Acceptable for demo use. Replace with OAuth or an identity provider before any production deployment.',
                fixed: false,
              },
              {
                tag: 'STORAGE',
                title: 'In-memory fallback loses data on cold start',
                body: 'When DATABASE_URL is not set, orders and events are stored in-memory and lost when the Vercel function cold-starts. With Neon Postgres configured, data persists across restarts.',
                fix: 'Set DATABASE_URL to a Neon (or compatible Postgres) connection string.',
                fixed: false,
              },
            ].map(({ tag, title, body, fix, fixed }) => (
              <div key={title} className={`rounded-lg border px-5 py-4 space-y-2 ${fixed ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20' : 'border-border bg-card'}`}>
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded mt-0.5 ${fixed ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                    {tag}
                  </span>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{title}</span>
                      {fixed && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                          ✓ Fixed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                    <p className="text-xs leading-relaxed" style={{ color: fixed ? '#15803d' : undefined }}>
                      <strong>{fixed ? 'Status:' : 'Workaround:'}</strong> {fix}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AccordionSection>

        {/* Tech Stack */}
        <AccordionSection title="Tech Stack">
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
        </AccordionSection>

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
