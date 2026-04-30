'use client';

function BrazilianEngineeringLogo() {
  return (
    <div className="flex flex-col items-center select-none">
      {/* Wordmark */}
      <span
        className="font-black italic leading-none tracking-tight"
        style={{ fontSize: '1.25rem', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
      >
        #BrazilianEngineering
      </span>

      {/* Swoosh + flag badge */}
      <svg
        viewBox="0 0 240 16"
        width="240"
        height="16"
        className="mt-1"
        aria-hidden="true"
      >
        {/* Left arc — yellow */}
        <path
          d="M 2 8 C 60 15 100 13 112 8"
          stroke="#FEDF00"
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
        />
        {/* Right arc — white/subtle */}
        <path
          d="M 128 8 C 145 13 185 15 238 8"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        {/* Flag badge — green diamond */}
        <polygon points="120,1 130,8 120,15 110,8" fill="#009B3A" />
        {/* Yellow rhombus */}
        <polygon points="120,3.5 128,8 120,12.5 112,8" fill="#FEDF00" />
        {/* Blue circle */}
        <circle cx="120" cy="8" r="4" fill="#002776" />
        {/* White arc — suggests the equatorial band */}
        <path
          d="M 116.5 8 A 4 4 0 0 1 123.5 8"
          stroke="white"
          strokeWidth="0.7"
          fill="none"
        />
      </svg>
    </div>
  );
}

export function Footer() {
  return (
    <footer
      className="border-t mt-auto"
      style={{ background: '#142032', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      {/* Vision strip */}
      <div className="border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-center sm:text-left leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>VTEX ERP Connect</span>
            {' '}— A reference implementation of the official VTEX OMS → ERP integration pattern.
            Demonstrates Feed &amp; Hook consumption, order normalization, Start Handling, invoice flow, and multi-account routing in a single deployable demo.
          </p>
          <p className="text-[10px] whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.25)' }}>
            All data auto-purged every 7 days
          </p>
        </div>
      </div>

      {/* Demo disclaimer bar */}
      <div className="border-b px-4 py-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(220,38,38,0.10)' }}>
        <p className="max-w-[1600px] mx-auto text-center text-[10px] leading-relaxed" style={{ color: 'rgba(252,165,165,0.8)' }}>
          <svg className="inline-block w-3 h-3 mr-1 mb-0.5 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M6.39 1.56a.45.45 0 0 0-.78 0L1.05 9a.45.45 0 0 0 .39.69h9.12a.45.45 0 0 0 .39-.69L6.39 1.56zM6 4.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5zm.5 4.75a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" clipRule="evenodd" />
          </svg>
          <strong>Demo &amp; Test Use Only</strong> — Never use real production credentials or real customer data.
          The authors and VTEX bear no responsibility for any misuse, data loss, or unintended API calls made against live environments.
        </p>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
        <a
          href="https://github.com/dcionevtex"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-opacity hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          Built by{' '}
          <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            @dcionevtex
          </span>
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

        {/* Spacer to keep logo centered */}
        <div className="w-[120px] hidden sm:block" />
      </div>
    </footer>
  );
}
