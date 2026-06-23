import Link from 'next/link';

type Simulator = 'platform' | 'erp' | 'ppp' | 'marketplace' | 'giftcard' | 'idp';

type ReleaseEntry = {
  version: string;
  date: string;
  tag?: 'latest';
  simulators: Simulator[];
  changes: Array<{ type: 'feat' | 'fix' | 'chore'; text: string }>;
};

const SIMULATOR_STYLE: Record<Simulator, { label: string; cls: string }> = {
  platform:    { label: 'Platform',          cls: 'bg-white/8 text-white/40' },
  erp:         { label: 'ERP Simulator',     cls: 'bg-emerald-500/10 text-emerald-400' },
  ppp:         { label: 'Payment Provider',  cls: 'bg-violet-500/10 text-violet-400' },
  marketplace: { label: 'External Seller',   cls: 'bg-sky-500/10 text-sky-400' },
  giftcard:    { label: 'Gift Card',          cls: 'bg-amber-500/10 text-amber-400' },
  idp:         { label: 'External IDP',      cls: 'bg-violet-500/10 text-violet-300' },
};

const CHANGE_TYPE_STYLE: Record<'feat' | 'fix' | 'chore', { label: string; color: string; bg: string }> = {
  feat:  { label: 'feat',  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  fix:   { label: 'fix',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  chore: { label: 'chore', color: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.05)' },
};

const RELEASES: ReleaseEntry[] = [
  {
    version: '1.6.0',
    date: 'June 23, 2026',
    tag: 'latest',
    simulators: ['idp'],
    changes: [
      { type: 'feat', text: 'External IDP Simulator — full OAuth 2.0 Authorization Code flow mock. VTEX storefronts can now point their Authentication settings at this simulator and complete a real login handshake.' },
      { type: 'feat', text: 'Three compliant endpoints: Authorization URL (login page + redirect), Token URL (code → access token exchange), and User Info URL (returns userId, email, name)' },
      { type: 'feat', text: 'Account-scoped isolation — each VTEX account gets its own client_id, client_secret, test users, and call log' },
      { type: 'feat', text: 'Login page at /idp/[account]/authorize — dark-themed, shows test users as one-click buttons with quick-login support' },
      { type: 'feat', text: 'Live call log in the dashboard shows every authorize, token exchange, and userinfo request with email, status code, and expandable details' },
      { type: 'feat', text: 'Test user management — add and remove users from the dashboard; changes reflect immediately on the login page' },
      { type: 'feat', text: 'Client secret regeneration — reset the OAuth client_secret from the Config tab without losing users or call history' },
      { type: 'feat', text: 'Setup guide with step-by-step instructions for configuring the IDP in VTEX Admin → Authentication → OAuth2' },
      { type: 'chore', text: 'External IDP Simulator added to the platform launcher as a new tool card' },
    ],
  },
  {
    version: '1.5.0',
    date: 'June 12, 2026',
    simulators: ['platform', 'ppp', 'marketplace', 'giftcard', 'erp'],
    changes: [
      { type: 'feat', text: 'Beta simulators (PPP, External Seller, Gift Card) now show a pink "Start here" callout above the account input on first load when no account is configured' },
      { type: 'feat', text: 'Account commit button label changed from "Set" to "Connect" across all Beta simulators for clarity' },
      { type: 'fix', text: 'Replaced 250+ sub-pixel font sizes (text-[10px], text-[11px], text-[9px]) with text-xs (12px minimum) across PPP, External Seller, Gift Card, and ERP order row — panel content is now readable on all display sizes' },
      { type: 'fix', text: 'Active tab border now uses the VTEX Rebel Pink token (#F71963) instead of Tailwind border-pink-500 across all Beta simulators' },
      { type: 'fix', text: 'StatusBadge: ERROR, START_HANDLING_ERROR, INVOICE_ERROR now use solid red fill (bg-red-500 text-white) to stand out in the order table; SUCCESS and INVOICED use solid green fill' },
      { type: 'fix', text: 'ERP table column "SH Status" renamed to "Start Handling" and "Tries" renamed to "Attempts" for clarity during demos' },
    ],
  },
  {
    version: '1.4.0',
    date: 'May 31, 2026',
    simulators: ['giftcard'],
    changes: [
      { type: 'feat', text: 'Gift Card Provider mock — implements the VTEX Gift Card Provider Protocol endpoints (search, get, transaction, settlement, cancellation)' },
      { type: 'feat', text: 'Any customer email at checkout auto-returns a fictional gift card with configurable balance (default 9999)' },
      { type: 'feat', text: 'Account-scoped isolation — each VTEX account gets its own service URL, cards, and call log' },
      { type: 'feat', text: 'Live call log with request/response inspector for every protocol call VTEX makes' },
      { type: 'feat', text: 'Checkout flow diagram showing search → get card → debit → settle progression' },
      { type: 'feat', text: 'Scenario toggle: return card (approved) or return empty (no cards at checkout)' },
      { type: 'chore', text: 'Gift Card Provider added to the platform launcher as a new tool card' },
    ],
  },
  {
    version: '1.3.0',
    date: 'May 24, 2026',
    simulators: ['marketplace'],
    changes: [
      { type: 'feat', text: 'Unified Register SKU flow — Change Notification is sent first; if SKU exists (200) the flow stops; if not found (404) SKU Suggestion is sent automatically' },
      { type: 'feat', text: 'Step-by-step result panel shows each API call with its status and VTEX response' },
      { type: 'feat', text: 'Seller account name field added to credentials (used as the `an` query param in Change Notification)' },
      { type: 'feat', text: 'Catalog tab links to VTEX Change Notification and Suggestions API docs' },
      { type: 'fix', text: 'Corrected VTEX Suggestions API base URL from vtexcommercestable.com.br to api.vtex.com — fixes 400 account resolution error' },
      { type: 'chore', text: 'SKU Suggestion tab renamed to Catalog; both catalog flows live in one panel' },
      { type: 'fix', text: 'Dimension fields (H/W/L/Wt) default to 1, stock to 99, price to 99.99, image to placehold.co placeholder' },
      { type: 'fix', text: 'Currency code field replaces hardcoded BRL — fully currency-agnostic' },
      { type: 'fix', text: 'Setup guide step 4 now explains catalog tab shortcut and credential requirement with direct tab link' },
    ],
  },
  {
    version: '1.2.0',
    date: 'May 21, 2026',
    simulators: ['ppp'],
    changes: [
      { type: 'feat', text: 'Payment Provider Simulator is now account-scoped — each VTEX account gets an isolated base URL, payment log, and scenario' },
      { type: 'feat', text: 'Account name input added to PPP dashboard; saved in localStorage' },
      { type: 'chore', text: 'All PPP API routes migrated to /api/payment-provider/[account]/ path' },
    ],
  },
  {
    version: '1.1.1',
    date: 'May 21, 2026',
    simulators: ['marketplace', 'platform'],
    changes: [
      { type: 'fix', text: 'Order Placement now spreads the full VTEX input and returns an array response, matching the External Seller Fulfillment protocol exactly' },
      { type: 'fix', text: 'Checkout no longer fails with "The requested order couldn\'t be created" — selectedSla and shippingData preserved from VTEX request' },
      { type: 'feat', text: 'Unavailable and Partial scenarios marked as Coming Soon in External Seller Simulator' },
      { type: 'feat', text: 'External Seller Simulator status updated from Work in Progress to Beta' },
      { type: 'feat', text: 'The Lab section added to launcher with upcoming experimental tools' },
    ],
  },
  {
    version: '1.1.0',
    date: 'May 20, 2026',
    simulators: ['platform', 'ppp', 'marketplace'],
    changes: [
      { type: 'feat', text: 'VTEX Demo Platform launcher introduced — single entry point for all simulators' },
      { type: 'feat', text: 'Payment Provider Protocol Simulator added — exposes all required PPP endpoints with per-scenario control' },
      { type: 'feat', text: 'External Seller Simulator added — Simulation, Placement, Authorize, and Cancellation endpoints with live call inspector' },
      { type: 'feat', text: 'Per-account namespacing on External Seller Simulator — each account gets an isolated Fulfillment URL' },
      { type: 'feat', text: 'Step-by-step setup guide for connecting a VTEX external seller' },
      { type: 'feat', text: 'Google OAuth SSO login — @vtex.com accounts only' },
      { type: 'chore', text: 'ERP Simulator migrated to /erp sub-path' },
    ],
  },
  {
    version: '1.0.6',
    date: 'May 7, 2026',
    simulators: ['erp'],
    changes: [
      { type: 'feat', text: 'Electronic Invoice sheet available on invoiced orders with printable A4 layout' },
      { type: 'feat', text: 'Access key barcode generated deterministically from orderId using CODE128' },
      { type: 'feat', text: 'Full NF-e layout: emitente, destinatário, produtos, cálculo de imposto, transportadora' },
    ],
  },
  {
    version: '1.0.5',
    date: 'May 7, 2026',
    simulators: ['erp'],
    changes: [
      { type: 'feat', text: 'Bulk select on orders inbox — checkbox per row with select-all, bulk delete and resolve actions' },
      { type: 'feat', text: 'Release Notes moved to dedicated sidebar page' },
      { type: 'feat', text: 'Collapsible sidebar with localStorage persistence' },
      { type: 'feat', text: 'Pagination — 50 orders per page on inbox and event log' },
    ],
  },
  {
    version: '1.0.4',
    date: 'May 3–4, 2026',
    simulators: ['erp'],
    changes: [
      { type: 'feat', text: 'Account mismatch guard — blocks VTEX API calls when account does not match configured credentials' },
      { type: 'feat', text: 'Multi-select account filter dropdown on orders inbox' },
      { type: 'feat', text: 'Order detail opens in modal instead of inline accordion' },
      { type: 'fix', text: 'Hook endpoint acks VTEX immediately and processes order async to prevent retries' },
    ],
  },
  {
    version: '1.0.3',
    date: 'April 30, 2026',
    simulators: ['erp'],
    changes: [
      { type: 'feat', text: 'Hook & Feed configuration editor with status filter and auto-commit toggle' },
      { type: 'feat', text: 'Weekly auto-purge cron — orders older than 7 days removed automatically' },
      { type: 'feat', text: 'Styled webhook endpoint display card with copy button' },
      { type: 'feat', text: 'Credentials isolated per browser session — no cross-user leakage' },
    ],
  },
  {
    version: '1.0.2',
    date: 'April 29–30, 2026',
    simulators: ['erp'],
    changes: [
      { type: 'feat', text: 'Shipping label mockup with CODE128 barcode and print support' },
      { type: 'feat', text: 'Manual invoice & tracking flow — send invoice and tracking number to VTEX' },
      { type: 'feat', text: 'Cancel Order button calling VTEX cancel API' },
      { type: 'feat', text: 'Neon Postgres persistence — orders and events survive cold starts' },
      { type: 'feat', text: 'Multi-account support with per-account hook routing' },
    ],
  },
  {
    version: '1.0.1',
    date: 'April 29, 2026',
    simulators: ['erp'],
    changes: [
      { type: 'feat', text: 'ERP orders inbox — unified Feed and Hook view with full accordion order detail' },
      { type: 'feat', text: 'Processing timeline per order with all pipeline steps' },
      { type: 'feat', text: 'Product image thumbnails in order items table' },
      { type: 'feat', text: 'About/Docs page with full integration documentation' },
    ],
  },
  {
    version: '1.0.0',
    date: 'April 28, 2026',
    simulators: ['erp'],
    changes: [
      { type: 'feat', text: 'VTEX Hook endpoint (POST /api/vtex/hook) — receives and processes order events from VTEX' },
      { type: 'feat', text: 'VTEX Feed polling (POST /api/vtex/feed/poll) with manual trigger from dashboard' },
      { type: 'feat', text: 'VTEX Get Order API client, ERP payload normalizer, simulated ERP acceptance' },
      { type: 'feat', text: 'Mandatory Start Handling after successful ERP acceptance' },
      { type: 'feat', text: 'PII masking, event deduplication, technical event log' },
      { type: 'feat', text: 'In-memory store with optional Postgres persistence via DATABASE_URL' },
    ],
  },
];

export default function ReleaseNotesPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d1826' }}>

      {/* Header */}
      <header className="border-b border-white/10 px-8 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <path d="M12 5l-5 5 5 5" />
            </svg>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>All tools</span>
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-black tracking-tighter" style={{ color: '#F71963' }}>VTEX</span>
            <span className="text-sm text-white/50 font-medium">Demo Platform</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
            <span className="text-sm text-white/70">Release Notes</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex justify-center px-6 py-10">
        <div className="w-full max-w-2xl space-y-4">

          {/* Legend */}
          <div className="flex items-center gap-2 flex-wrap pb-2">
            {(Object.entries(SIMULATOR_STYLE) as [Simulator, { label: string; cls: string }][]).map(([, style]) => (
              <span key={style.label} className={`text-[10px] font-medium px-2 py-0.5 rounded ${style.cls}`}>
                {style.label}
              </span>
            ))}
          </div>

          {RELEASES.map((release) => (
            <div
              key={release.version}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
            >
              {/* Version header */}
              <div
                className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <span className="text-sm font-bold font-mono text-white/90">{release.version}</span>
                {release.tag && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: '#F71963', color: '#fff' }}
                  >
                    {release.tag}
                  </span>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {release.simulators.map(sim => (
                    <span key={sim} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${SIMULATOR_STYLE[sim].cls}`}>
                      {SIMULATOR_STYLE[sim].label}
                    </span>
                  ))}
                </div>
                <span className="ml-auto text-xs text-white/30">{release.date}</span>
              </div>

              {/* Changes */}
              <ul className="divide-y divide-white/[0.04]">
                {release.changes.map((change, i) => {
                  const style = CHANGE_TYPE_STYLE[change.type];
                  return (
                    <li key={i} className="flex items-start gap-3 px-5 py-2.5">
                      <span
                        className="mt-0.5 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: style.color, background: style.bg }}
                      >
                        {style.label}
                      </span>
                      <span className="text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        {change.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </main>

    </div>
  );
}
