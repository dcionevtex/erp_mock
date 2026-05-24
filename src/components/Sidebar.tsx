'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const NAV_ITEMS = [
  {
    label: 'ERP Orders',
    href: '/erp',
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="16" height="14" rx="2" />
        <path d="M2 7h16" />
        <path d="M5 11h4M5 14h7" />
      </svg>
    ),
  },
  {
    label: 'Documentation',
    href: '/erp/about',
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h9l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
        <path d="M13 2v5h5M7 10h6M7 13h6" />
      </svg>
    ),
  },
  {
    label: 'Release Notes',
    href: '/release-notes',
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v4l2.5 2.5" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    if (saved !== null) setExpanded(saved === 'true');
  }, []);

  function toggle() {
    setExpanded((prev) => {
      localStorage.setItem('sidebar_expanded', String(!prev));
      return !prev;
    });
  }

  return (
    <aside
      className="flex flex-col shrink-0 transition-[width] duration-200 ease-in-out border-r border-white/10 overflow-hidden"
      style={{
        width: expanded ? 220 : 60,
        background: '#0d1826',
        minHeight: '100%',
      }}
    >
      {/* Hamburger row */}
      <div className="flex items-center h-14 px-3.5 border-b border-white/10 shrink-0">
        <button
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label={expanded ? 'Collapse menu' : 'Expand menu'}
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        {expanded && (
          <span className="ml-3 text-sm font-semibold text-white/70 truncate whitespace-nowrap">
            ERP Simulator
          </span>
        )}
      </div>

      {/* Back to platform */}
      <div className="px-2 pt-3 pb-1 shrink-0">
        <Link
          href="/"
          title={!expanded ? 'All tools' : undefined}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-white/50 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap border border-white/10 hover:border-white/20"
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
          {expanded && <span>All tools</span>}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!expanded ? item.label : undefined}
              className={[
                'flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors text-sm font-medium whitespace-nowrap',
                active
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/90 hover:bg-white/5',
              ].join(' ')}
              style={active ? { background: 'rgba(247,25,99,0.15)', color: '#F71963' } : {}}
            >
              {item.icon}
              {expanded && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* VTEX brand + contact */}
      <div className="px-3.5 py-3 border-t border-white/10 shrink-0 overflow-hidden">
        {expanded ? (
          <div className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-black tracking-tighter" style={{ color: '#F71963' }}>VTEX</span>
              <span className="text-[11px] text-white/30 truncate">OMS Integration</span>
            </div>
            <a
              href="https://github.com/dcionevtex"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              @dcionevtex
            </a>
          </div>
        ) : (
          <span className="text-xs font-black tracking-tighter" style={{ color: '#F71963' }}>V</span>
        )}
      </div>

      {/* Sign out */}
      <div className="px-2 pb-3 shrink-0">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={!expanded ? 'Sign out' : undefined}
          className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 w-full text-sm font-medium text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3" />
            <path d="M13 14l3-4-3-4" />
            <path d="M16 10H7" />
          </svg>
          {expanded && <span className="truncate">Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
