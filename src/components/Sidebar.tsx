'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    label: 'ERP Orders',
    href: '/',
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
    href: '/about',
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h9l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
        <path d="M13 2v5h5M7 10h6M7 13h6" />
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
            ERP Connect
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
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

      {/* VTEX brand */}
      <div className="px-3.5 py-3 border-t border-white/10 shrink-0 overflow-hidden">
        {expanded ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-black tracking-tighter" style={{ color: '#F71963' }}>VTEX</span>
            <span className="text-[11px] text-white/30 truncate">OMS Integration</span>
          </div>
        ) : (
          <span className="text-xs font-black tracking-tighter" style={{ color: '#F71963' }}>V</span>
        )}
      </div>
    </aside>
  );
}
