'use client';

import { useState } from 'react';

export function AccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 group text-left"
      >
        <h2 className="text-base font-semibold text-foreground flex items-center gap-3">
          <span
            className="w-1 h-5 rounded-full shrink-0 transition-opacity"
            style={{ background: '#F71963', opacity: open ? 1 : 0.4 }}
          />
          {title}
        </h2>
        <svg
          className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-all duration-200"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '9999px' : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="pt-4 space-y-4">
          {children}
        </div>
      </div>
    </section>
  );
}
