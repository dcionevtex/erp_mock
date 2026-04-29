'use client';

function BrazilianEngineeringLogo() {
  return (
    <div className="flex flex-col items-start select-none">
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
      className="border-t mt-auto px-4 py-4"
      style={{ background: '#142032', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 flex-wrap">
        <BrazilianEngineeringLogo />
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
      </div>
    </footer>
  );
}
