import Link from 'next/link';

type Simulator = 'platform' | 'erp' | 'ppp' | 'marketplace' | 'giftcard' | 'idp' | 'tax' | 'promotion';

type ReleaseEntry = {
  version: string;
  date: string;
  tag?: 'latest';
  simulators: Simulator[];
  changes: Array<{ type: 'feat' | 'fix' | 'chore'; text: string }>;
};

const SIMULATOR_STYLE: Record<Simulator, { label: string; cls: string }> = {
  platform:    { label: 'Platform',          cls: 'bg-muted text-muted-foreground' },
  erp:         { label: 'ERP/OMS Simulator', cls: 'bg-emerald-50 text-emerald-700' },
  ppp:         { label: 'Payment Provider',  cls: 'bg-violet-50 text-violet-700' },
  marketplace: { label: 'External Seller',   cls: 'bg-sky-50 text-sky-700' },
  giftcard:    { label: 'Gift Card',          cls: 'bg-warning-faded text-warning-foreground' },
  idp:         { label: 'External IDP',      cls: 'bg-indigo-50 text-indigo-700' },
  tax:         { label: 'Tax Provider',      cls: 'bg-rose-50 text-rose-700' },
  promotion:   { label: 'Promotion Provider', cls: 'bg-fuchsia-50 text-fuchsia-700' },
};

const CHANGE_TYPE_STYLE: Record<'feat' | 'fix' | 'chore', { label: string; cls: string }> = {
  feat:  { label: 'feat',  cls: 'bg-secondary text-primary' },
  fix:   { label: 'fix',   cls: 'bg-warning-faded text-warning-foreground' },
  chore: { label: 'chore', cls: 'bg-muted text-muted-foreground' },
};

const RELEASES: ReleaseEntry[] = [
  {
    version: '3.0.1',
    date: 'October 8, 2026',
    tag: 'latest',
    simulators: ['tax'],
    changes: [
      { type: 'fix', text: 'Tax Provider Simulator: per-account config (scenario, tax rules, authorization secret) is now persisted to Neon when DATABASE_URL is set, so it survives cold starts. The call log remains in memory.' },
    ],
  },
  {
    version: '3.0.0',
    date: 'September 14, 2026',
    simulators: ['promotion', 'platform'],
    changes: [
      { type: 'feat', text: 'New Promotion Provider Simulator (/promotion) — implements the VTEX External Promotions Protocol (v1.1): calculatePromotion and notifyUsage. Unlike the other simulators, activation isn\'t self-service — VTEX support enables it per account from a support ticket, so the Setup tab builds that ticket for you with both endpoint URLs and the configurable auth header. Promotion rules are percentage or fixed discounts that stack sequentially against each item\'s running price, optionally gated by a coupon code, with Apply/No promotions/Simulate error scenario toggles, editable rule descriptions, and a live call log. Response items report the protocol\'s required quantity and Nominal discount type (the only type VTEX accepts — Percentual and Shipping are rejected), and notifyUsage validates the request — orderId, the NewOrder/OrderCancellation type enum, and promotionUsages shape — returning 400 on a malformed body instead of silently acknowledging it.' },
    ],
  },
  {
    version: '2.0.0',
    date: 'September 11, 2026',
    simulators: ['tax', 'platform'],
    changes: [
      { type: 'feat', text: 'New Tax Provider Simulator (/tax) — implements the VTEX Tax Service protocol. Unlike PPP/Marketplace/Gift Card, this protocol has no manifest or hub API: VTEX registers a single calculate-tax URL via the Checkout API\'s orderForm.taxConfiguration, and Checkout calls it synchronously on every cart change. Tax rules are configurable flat percentages applied independently per line item, with Apply/No tax/Simulate error scenario toggles and a Register tab that reads and updates the account\'s orderForm config directly from the dashboard.' },
    ],
  },
  {
    version: '1.9.0',
    date: 'September 2, 2026',
    simulators: ['erp'],
    changes: [
      { type: 'feat', text: 'New PIPE-08 guard: Start Handling is only called when Get Order confirms the order is actually ready-for-handling. Previously any status that wasn\'t already past handling would trigger the call, so a hook firing (or being re-delivered) one step early could call Start Handling before VTEX allows it. Guarded orders stay at ERP_ACCEPTED with a SKIPPED timeline entry and pick back up on the next hook/feed delivery or a Reprocess.' },
    ],
  },
  {
    version: '1.8.5',
    date: 'September 2, 2026',
    simulators: ['platform'],
    changes: [
      { type: 'chore', text: 'Moved the Release Notes teaser to the top of the launcher, above the Platform Status carousel.' },
    ],
  },
  {
    version: '1.8.4',
    date: 'September 2, 2026',
    simulators: ['platform'],
    changes: [
      { type: 'feat', text: 'Added Stakeholder Scout to Field Tools, linking to the private se-scout-service repo. Private entries now show a "Private" badge and an inline note to ping Diego Cione on Slack for access.' },
    ],
  },
  {
    version: '1.8.3',
    date: 'September 2, 2026',
    simulators: ['erp'],
    changes: [
      { type: 'fix', text: 'Fixed the per-currency display shipped in 1.8.2 — it read currencyCode off the wrong field and always fell back to BRL. VTEX nests it under storePreferencesData.currencyCode, not on the order root; corrected the extraction so non-BRL accounts (e.g. AED) now show correctly.' },
    ],
  },
  {
    version: '1.8.2',
    date: 'September 2, 2026',
    simulators: ['erp'],
    changes: [
      { type: 'fix', text: 'Order totals and item prices now display in the order’s actual currency (read from VTEX’s currencyCode) instead of always showing R$, so non-BRL demo accounts show the right symbol.' },
    ],
  },
  {
    version: '1.8.1',
    date: 'August 21, 2026',
    simulators: ['erp', 'platform'],
    changes: [
      { type: 'chore', text: 'Renamed "ERP Simulator" to "ERP/OMS Simulator" across the launcher, login page, sidebar, footer, about page, and docs — it always read directly from VTEX OMS, this just makes that visible in the name.' },
    ],
  },
  {
    version: '1.8.0',
    date: 'August 21, 2026',
    simulators: ['idp'],
    changes: [
      { type: 'feat', text: 'Phone login can now be turned off per account — a new "Login Options" toggle in the IDP Config tab hides the phone tab on the login page when off. Saved as part of the account config, so it persists across sessions.' },
      { type: 'feat', text: 'Added a one-off ?phone=true/false override on the Authorization URL for testing a different behavior without changing the saved account default.' },
    ],
  },
  {
    version: '1.7.3',
    date: 'August 19, 2026',
    simulators: ['idp'],
    changes: [
      { type: 'fix', text: 'IDP login page now rejects @vtex.com emails with a clear error, and shows a standing disclaimer explaining why: that domain already has a real VTEX ID tied to it, which breaks the demo login instead of completing it cleanly.' },
    ],
  },
  {
    version: '1.7.2',
    date: 'August 19, 2026',
    simulators: ['platform', 'idp'],
    changes: [
      { type: 'fix', text: 'External IDP login page (/idp/[account]/authorize) is now publicly accessible — it no longer forces end customers going through a VTEX storefront login into signing in to this app with a @vtex.com Google account first. The IDP dashboard and every other page remain gated.' },
    ],
  },
  {
    version: '1.7.1',
    date: 'August 19, 2026',
    simulators: ['platform'],
    changes: [
      { type: 'feat', text: 'Added Stakeholder Scout to the Claude Skills & MCP section on the launcher — profiles deal stakeholders (career history, VTEX vs. competitor platform affinity, champion/blocker signals, warm-intro paths) into a stakeholder map, influence × support matrix, and Slack-ready update.' },
    ],
  },
  {
    version: '1.7.0',
    date: 'July 19, 2026',
    simulators: ['platform', 'erp', 'ppp', 'marketplace', 'giftcard', 'idp'],
    changes: [
      { type: 'feat', text: 'Full VTEX Admin visual redesign across the entire platform — every simulator now follows the styleguide.vtex.com product design system (light surfaces, Action Blue #134CD8 as the primary color) instead of the dark, Rebel-Pink-branded look. Rebel Pink is now reserved for small emphasis accents only (the VTEX wordmark, "Beta"/"Live"/"Latest" tags), matching how the real VTEX Admin separates brand identity from product UI.' },
      { type: 'feat', text: 'New semantic design tokens in globals.css: success/warning/danger states with faded-pill variants, plus a dedicated emphasis token — status badges, scenario toggles, and call-log indicators across all simulators now read state at a glance instead of using ad-hoc Tailwind colors.' },
      { type: 'feat', text: 'PPP, External Seller, and Gift Card simulators gained a proper first-run empty state — a centered card with a clear "Connect your VTEX account" prompt and primary CTA, replacing the low-visibility inline account bar.' },
      { type: 'fix', text: 'ERP order table: Error column moved next to Status (was the last of 19 columns); default view now shows a scannable 6-7 column set with the rest reachable via the existing column-visibility toggle.' },
      { type: 'fix', text: 'StatusBadge severity is now visually distinct — errors use the danger-faded token, success/neutral use success/muted tokens, instead of similar-weight flat color pairs.' },
      { type: 'fix', text: 'Replaced remaining sub-12px arbitrary text sizes (text-[9px]/[10px]/[11px]) across ERP setup panels, About page, and all Beta simulator documentation panels with text-xs minimum.' },
      { type: 'fix', text: 'Fixed a hardcoded, untokenized color value on the Gift Card provider list button; Sidebar active-nav state now uses a blue tint + left border accent instead of pink.' },
      { type: 'chore', text: 'Synced the local vtex-brand-guidelines skill copy in this repo to v0.2.0 (adds product-ui-tokens.md, the source for this redesign’s color tokens, and bundled logo assets).' },
    ],
  },
  {
    version: '1.6.0',
    date: 'June 23, 2026',
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
    <div className="min-h-screen flex flex-col bg-background">

      {/* Header */}
      <header className="border-b border-border bg-card px-8 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
          >
            <svg className="w-3.5 h-3.5 text-muted-foreground" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5l-5 5 5 5" />
            </svg>
            <span className="text-xs text-muted-foreground">All tools</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-black tracking-tighter text-emphasis">VTEX</span>
            <span className="text-sm text-muted-foreground font-medium">Demo Platform</span>
            <span className="text-muted-foreground/40">—</span>
            <span className="text-sm text-foreground">Release Notes</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex justify-center px-6 py-10">
        <div className="w-full max-w-2xl space-y-4">

          {/* Legend */}
          <div className="flex items-center gap-2 flex-wrap pb-2">
            {(Object.entries(SIMULATOR_STYLE) as [Simulator, { label: string; cls: string }][]).map(([, style]) => (
              <span key={style.label} className={`text-xs font-medium px-2 py-0.5 rounded ${style.cls}`}>
                {style.label}
              </span>
            ))}
          </div>

          {RELEASES.map((release) => (
            <div
              key={release.version}
              className="rounded-lg overflow-hidden border border-border bg-card shadow-sm"
            >
              {/* Version header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/60">
                <span className="text-sm font-bold font-mono text-foreground">{release.version}</span>
                {release.tag && (
                  <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emphasis text-emphasis-foreground">
                    {release.tag}
                  </span>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {release.simulators.map(sim => (
                    <span key={sim} className={`text-xs font-medium px-1.5 py-0.5 rounded ${SIMULATOR_STYLE[sim].cls}`}>
                      {SIMULATOR_STYLE[sim].label}
                    </span>
                  ))}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{release.date}</span>
              </div>

              {/* Changes */}
              <ul className="divide-y divide-border">
                {release.changes.map((change, i) => {
                  const style = CHANGE_TYPE_STYLE[change.type];
                  return (
                    <li key={i} className="flex items-start gap-3 px-5 py-2.5">
                      <span className={`mt-0.5 shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${style.cls}`}>
                        {style.label}
                      </span>
                      <span className="text-sm leading-snug text-foreground/80">
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
