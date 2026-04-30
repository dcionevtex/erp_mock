'use client';

function BrazilianEngineeringLogo() {
  return (
    <div className="flex flex-col items-center select-none">
      <span
        className="font-black italic leading-none tracking-tight"
        style={{ fontSize: '1.25rem', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
      >
        #BrazilianEngineering
      </span>
      <svg viewBox="0 0 240 16" width="240" height="16" className="mt-1" aria-hidden="true">
        <path d="M 2 8 C 60 15 100 13 112 8" stroke="#FEDF00" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <path d="M 128 8 C 145 13 185 15 238 8" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <polygon points="120,1 130,8 120,15 110,8" fill="#009B3A" />
        <polygon points="120,3.5 128,8 120,12.5 112,8" fill="#FEDF00" />
        <circle cx="120" cy="8" r="4" fill="#002776" />
        <path d="M 116.5 8 A 4 4 0 0 1 123.5 8" stroke="white" strokeWidth="0.7" fill="none" />
      </svg>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t mt-auto" style={{ background: '#0e1a27', borderColor: 'rgba(255,255,255,0.08)' }}>

      {/* Main info block */}
      <div className="border-b px-6 py-6" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Vision */}
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base font-black tracking-tighter" style={{ color: '#F71963' }}>VTEX</span>
              <span className="text-sm font-semibold text-white">ERP Connect</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(247,25,99,0.15)', color: '#F71963' }}>
                Demo
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              A reference implementation of the official <strong style={{ color: 'rgba(255,255,255,0.85)' }}>VTEX OMS → ERP integration pattern</strong>.
              Demonstrates Feed &amp; Hook consumption, order normalization, Start Handling,
              invoice &amp; tracking flow, and multi-account routing — in a single deployable demo.
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Built to show partners and merchants exactly how a production ERP integration works,
              end-to-end, with real VTEX APIs.
            </p>
          </div>

          {/* Data policy */}
          <div className="space-y-3">
            <div className="rounded-lg px-4 py-3 space-y-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#F71963" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6.5" cy="6.5" r="5" />
                  <path d="M6.5 4v3.5M6.5 9h.01" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>Data policy</span>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                All orders and event logs are <strong style={{ color: 'rgba(255,255,255,0.65)' }}>auto-purged every Sunday</strong> at midnight UTC to keep the demo environment clean.
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Account credentials are retained so hook routing continues to work after each purge.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent disclaimer */}
      <div className="px-6 py-4 border-b" style={{ background: 'rgba(220,38,38,0.14)', borderColor: 'rgba(239,68,68,0.2)' }}>
        <div className="max-w-[1600px] mx-auto flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 1.5L16.5 15H1.5L9 1.5z" fill="rgba(239,68,68,0.25)" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M9 7v3.5" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="9" cy="13" r="0.9" fill="#ef4444" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold" style={{ color: 'rgba(252,165,165,1)' }}>
              Demo &amp; Test Use Only — Do not use with real production data.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(252,165,165,0.75)' }}>
              Never configure real App Keys or App Tokens. Never process real customer orders or personal data through this application.
              This tool may trigger actual VTEX OMS API calls including Start Handling and invoice notifications.
              <strong style={{ color: 'rgba(252,165,165,0.9)' }}> The authors and VTEX bear no responsibility</strong> for any data loss,
              order disruption, or misuse resulting from operating this tool against live environments.
            </p>
          </div>
        </div>
      </div>

      {/* Author row */}
      <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <a
          href="https://github.com/dcionevtex"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-opacity hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Built by{' '}
          <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>@dcionevtex</span>
          {' '}· VTEX
        </a>
        <a
          href="https://brazilian.engineering/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity hover:opacity-80"
          aria-label="Brazilian Engineering"
        >
          <BrazilianEngineeringLogo />
        </a>
        <div className="w-[140px] hidden sm:block" />
      </div>

    </footer>
  );
}
