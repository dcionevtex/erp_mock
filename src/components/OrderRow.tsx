'use client';

import { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { ShippingLabel } from './ShippingLabel';
import { cn } from '@/lib/utils';
import type { ErpOrderRecord, ErpTimelineEntry } from '@/types';

type ActionType = 'reprocess' | 'retry-start-handling' | 'resolve' | 'cancel' | 'delete' | 'copy-erp' | 'copy-vtex';

interface OrderRowProps {
  order: ErpOrderRecord;
  onAction: (action: ActionType, orderId: string) => void;
}

export function OrderRow({ order, onAction }: OrderRowProps) {
  const [open, setOpen] = useState(false);

  function fmt(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtCurrency(val?: number) {
    if (val == null) return '—';
    return `R$ ${(val / 100).toFixed(2)}`;
  }

  return (
    <>
      <tr
        className={cn(
          'border-b border-border text-sm cursor-pointer hover:bg-muted/40 transition-colors',
          open && 'bg-muted/30',
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={order.erpStatus} /></td>
        <td className="px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">{order.account ?? '—'}</td>
        <td className="px-3 py-2 font-mono text-xs max-w-[140px] truncate" title={order.orderId}>{order.orderId}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{order.sequence ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{order.vtexStatus ?? '—'}</td>
        <td className="px-3 py-2">
          <span className={cn(
            'text-xs font-medium px-1.5 py-0.5 rounded',
            order.source === 'HOOK' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600',
          )}>
            {order.source}
          </span>
        </td>
        <td className="px-3 py-2 text-xs max-w-[120px] truncate">{order.customerName ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[130px] truncate">{order.customerEmailMasked ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-right">{fmtCurrency(order.totalValue)}</td>
        <td className="px-3 py-2 text-xs text-center">{order.itemCount ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[100px] truncate">{order.shippingSummary ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[100px] truncate">{order.paymentSummary ?? '—'}</td>
        <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={order.startHandlingStatus} /></td>
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(order.receivedAt)}</td>
        <td className="px-3 py-2 text-xs text-center">{order.attempts}</td>
        <td className="px-3 py-2 text-xs text-destructive max-w-[140px] truncate" title={order.errorMessage}>{order.errorMessage ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-center text-muted-foreground">
          <Chevron open={open} />
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={17} className="border-b border-border bg-muted/10">
            <div className="px-5 py-5 space-y-3 max-w-6xl">

              {/* Row 1: Summary + Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                {/* Order Summary */}
                <InfoCard title="Order Summary" className="lg:col-span-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
                    <Field label="Account" value={order.account} mono />
                    <Field label="Order ID" value={order.orderId} mono />
                    <Field label="Sequence" value={order.sequence} />
                    <Field label="Customer" value={order.customerName} />
                    <Field label="Email" value={order.customerEmailMasked} />
                    <Field label="Total" value={fmtCurrency(order.totalValue)} />
                    <Field label="Payment" value={order.paymentSummary} />
                    <Field label="Shipping" value={order.shippingSummary} />
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">ERP Status</span>
                      <StatusBadge status={order.erpStatus} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">SH Status</span>
                      <StatusBadge status={order.startHandlingStatus} />
                    </div>
                  </div>
                  {order.errorMessage && (
                    <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                      <svg className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.5v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0zm0 6.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"/>
                      </svg>
                      <span className="text-xs text-destructive leading-relaxed">{order.errorMessage}</span>
                    </div>
                  )}
                </InfoCard>

                {/* Processing Timeline */}
                <InfoCard title="Processing Timeline">
                  {order.timeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">No entries yet.</p>
                  ) : (
                    <ol className="relative space-y-0">
                      {order.timeline.map((entry, i) => (
                        <TimelineEntry key={i} entry={entry} last={i === order.timeline.length - 1} />
                      ))}
                    </ol>
                  )}
                </InfoCard>
              </div>

              {/* Row 2: Order Items */}
              {order.erpPayload?.items && order.erpPayload.items.length > 0 && (
                <InfoCard title="Order Items">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-border">
                        <th className="pb-2 pr-3 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-10"></th>
                        <th className="pb-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">SKU</th>
                        <th className="pb-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Product ID</th>
                        <th className="pb-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Name</th>
                        <th className="pb-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] text-right">Qty</th>
                        <th className="pb-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] text-right">Unit Price</th>
                        <th className="pb-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] text-right">Selling Price</th>
                        <th className="pb-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.erpPayload.items.map((item, i) => (
                        <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3">
                            {item.imageUrl ? (
                              <div className="w-8 h-8 rounded-md overflow-hidden border border-border bg-muted shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.imageUrl}
                                  alt={item.name ?? ''}
                                  width={32}
                                  height={32}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-md border border-border bg-muted flex items-center justify-center shrink-0">
                                <svg className="w-3.5 h-3.5 text-muted-foreground/40" viewBox="0 0 16 16" fill="currentColor">
                                  <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                                  <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13zm0 1h13a.5.5 0 0 1 .5.5v6l-3.775-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12v.54A.505.505 0 0 1 1 12.5v-9a.5.5 0 0 1 .5-.5z"/>
                                </svg>
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-4 font-mono text-foreground">{item.skuId ?? '—'}</td>
                          <td className="py-2 pr-4 font-mono text-muted-foreground">{item.productId ?? '—'}</td>
                          <td className="py-2 pr-4 text-foreground font-medium">{item.name ?? '—'}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{item.quantity ?? '—'}</td>
                          <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{fmtCurrency(item.price)}</td>
                          <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{fmtCurrency(item.sellingPrice)}</td>
                          <td className="py-2 text-right tabular-nums font-semibold">{fmtCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </InfoCard>
              )}

              {/* Row 3: Shipping Details + Payment + Shipping Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {order.erpPayload?.logisticsInfo != null && (
                  <CollapsibleCard title="Shipping Details">
                    <JsonViewer data={order.erpPayload.logisticsInfo} maxHeight="max-h-56" />
                  </CollapsibleCard>
                )}

                {order.erpPayload?.paymentSummary && (
                  <CollapsibleCard title="Payment Details">
                    <div className="space-y-3 py-1">
                      <Field label="Method" value={order.erpPayload.paymentSummary} />
                      <Field label="Total charged" value={fmtCurrency(order.totalValue)} />
                    </div>
                  </CollapsibleCard>
                )}

                <CollapsibleCard title="Shipping Label">
                  <div className="flex justify-center py-2" onClick={(e) => e.stopPropagation()}>
                    <ShippingLabel order={order} />
                  </div>
                </CollapsibleCard>
              </div>

              {/* Row 4: JSON payloads side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {order.erpPayload && (
                  <CollapsibleCard title="ERP Normalized Payload" tag="JSON">
                    <JsonViewer data={order.erpPayload} maxHeight="max-h-72" />
                  </CollapsibleCard>
                )}
                {order.vtexOrderRaw != null && (
                  <CollapsibleCard title="Raw VTEX Payload" tag="JSON">
                    <JsonViewer data={order.vtexOrderRaw} maxHeight="max-h-72" />
                  </CollapsibleCard>
                )}
              </div>

              {/* Actions */}
              <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                <ActionBtn onClick={() => onAction('reprocess', order.orderId)}>
                  <BtnIcon d="M4 4v3h3M12 12v-3h-3M3.5 7a5.5 5.5 0 1 1 .7 4" />
                  Reprocess
                </ActionBtn>
                <ActionBtn
                  onClick={() => onAction('retry-start-handling', order.orderId)}
                  disabled={order.startHandlingStatus === 'SUCCESS'}
                >
                  <BtnIcon d="M5 12h7M9 8l4 4-4 4" />
                  Retry Start Handling
                </ActionBtn>
                <ActionBtn onClick={() => onAction('resolve', order.orderId)}>
                  <BtnIcon d="M4 8l3 3 5-5" />
                  Mark Resolved
                </ActionBtn>
                <div className="w-px self-stretch bg-border mx-1" />
                <ActionBtn
                  variant="ghost"
                  onClick={() => {
                    if (order.erpPayload) navigator.clipboard.writeText(JSON.stringify(order.erpPayload, null, 2)).catch(() => {});
                  }}
                >
                  <BtnIcon d="M8 4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2M8 4h6l2 2v4M8 4v4h6" />
                  Copy ERP
                </ActionBtn>
                <ActionBtn
                  variant="ghost"
                  onClick={() => {
                    if (order.vtexOrderRaw != null) navigator.clipboard.writeText(JSON.stringify(order.vtexOrderRaw, null, 2)).catch(() => {});
                  }}
                >
                  <BtnIcon d="M8 4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2M8 4h6l2 2v4M8 4v4h6" />
                  Copy VTEX
                </ActionBtn>
                <div className="flex-1" />
                <ActionBtn
                  variant="danger"
                  onClick={() => onAction('cancel', order.orderId)}
                  disabled={order.erpStatus === 'CANCELLED'}
                >
                  Cancel
                </ActionBtn>
                <ActionBtn variant="danger" onClick={() => onAction('delete', order.orderId)}>
                  Delete
                </ActionBtn>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform duration-150', open && 'rotate-180', className)}
      viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M3 5l4 4 4-4" />
    </svg>
  );
}

function InfoCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
      <div className="px-4 py-2.5 border-b border-border bg-muted/30">
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CollapsibleCard({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border hover:bg-muted/50 transition-colors text-left gap-2"
      >
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
          {tag && (
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
              {tag}
            </span>
          )}
        </div>
        <Chevron open={open} />
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn('text-sm font-medium text-foreground truncate', mono && 'font-mono text-xs')}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function JsonViewer({ data, maxHeight = 'max-h-48' }: { data: unknown; maxHeight?: string }) {
  return (
    <pre className={cn('text-[11px] leading-relaxed bg-muted/60 rounded-md p-3 overflow-auto font-mono', maxHeight)}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

const TIMELINE_STYLES: Record<string, { dot: string; icon: string }> = {
  SUCCESS: { dot: 'bg-emerald-500 ring-emerald-200', icon: 'text-emerald-600' },
  ERROR:   { dot: 'bg-red-500 ring-red-200',         icon: 'text-red-600' },
  INFO:    { dot: 'bg-blue-400 ring-blue-200',        icon: 'text-blue-600' },
  SKIPPED: { dot: 'bg-gray-300 ring-gray-100',        icon: 'text-gray-400' },
};

function TimelineEntry({ entry, last }: { entry: ErpTimelineEntry; last: boolean }) {
  const style = TIMELINE_STYLES[entry.status] ?? TIMELINE_STYLES.SKIPPED;
  return (
    <li className="relative flex gap-3 pb-3 last:pb-0">
      {/* Connecting line */}
      {!last && <div className="absolute left-[5px] top-[14px] bottom-0 w-px bg-border" />}
      {/* Dot */}
      <span className={cn('mt-1 h-3 w-3 rounded-full shrink-0 ring-2', style.dot)} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono font-medium text-foreground">{entry.step}</span>
          <span className="text-[10px] text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>
        </div>
        {entry.message && (
          <span className={cn('text-[11px] leading-snug', style.icon)}>{entry.message}</span>
        )}
      </div>
    </li>
  );
}

function BtnIcon({ d }: { d: string }) {
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled = false,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'ghost' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-40 disabled:pointer-events-none',
        variant === 'ghost'
          ? 'border-border bg-background hover:bg-muted text-foreground'
          : variant === 'danger'
          ? 'border-transparent bg-red-600 text-white hover:bg-red-700'
          : 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {children}
    </button>
  );
}
