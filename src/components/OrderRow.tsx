'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { StatusBadge } from './StatusBadge';
import { ShippingLabel } from './ShippingLabel';
import { DanfeSheet } from './DanfeSheet';
import { cn } from '@/lib/utils';
import type { ErpOrderRecord, ErpTimelineEntry } from '@/types';

type ActionType = 'reprocess' | 'retry-start-handling' | 'resolve' | 'cancel' | 'delete' | 'copy-erp' | 'copy-vtex' | 'send-invoice' | 'refresh';

interface OrderRowProps {
  order: ErpOrderRecord;
  onAction: (action: ActionType, orderId: string) => void;
  configAccount?: string;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function OrderRow({ order, onAction, configAccount, selected = false, onSelect }: OrderRowProps) {
  const [modalOpen, setModalOpen] = useState(false);

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
          'border-b border-border text-sm hover:bg-muted/40 transition-colors',
          selected ? 'bg-primary/5' : 'cursor-pointer',
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-checkbox]')) return;
          setModalOpen(true);
        }}
      >
        <td className="pl-3 pr-1 py-2 w-8 shrink-0" data-checkbox>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect?.(order.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded accent-primary cursor-pointer"
            aria-label={`Select order ${order.orderId}`}
          />
        </td>
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
        <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={order.invoiceStatus} /></td>
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(order.receivedAt)}</td>
        <td className="px-3 py-2 text-xs text-center">{order.attempts}</td>
        <td className="px-3 py-2 text-xs text-destructive max-w-[140px] truncate" title={order.errorMessage}>{order.errorMessage ?? '—'}</td>
        <td className="px-3 py-2 text-center">
          {/* open icon */}
          <svg className="w-3.5 h-3.5 text-muted-foreground inline-block" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8M9 2h3v3M6 8l5-5" />
          </svg>
        </td>
      </tr>

      {modalOpen && (
        <OrderDetailModal
          order={order}
          configAccount={configAccount}
          onClose={() => setModalOpen(false)}
          onAction={(action, orderId) => {
            if (action === 'delete') setModalOpen(false);
            onAction(action, orderId);
          }}
        />
      )}
    </>
  );
}

/* ─── Modal ───────────────────────────────────────────────────── */

// Actions that make live VTEX API calls — blocked when account credentials don't match.
const VTEX_API_ACTIONS: ActionType[] = ['reprocess', 'retry-start-handling', 'send-invoice', 'cancel'];

function OrderDetailModal({
  order,
  configAccount,
  onClose,
  onAction,
}: {
  order: ErpOrderRecord;
  configAccount?: string;
  onClose: () => void;
  onAction: (action: ActionType, orderId: string) => void;
}) {
  const accountMismatch =
    !!order.account && !!configAccount && order.account !== configAccount;
  const [trackingFormOpen, setTrackingFormOpen] = useState(false);
  const [trackingForm, setTrackingForm] = useState({ courier: '', trackingNumber: '', trackingUrl: '' });
  const [trackingSubmitting, setTrackingSubmitting] = useState(false);

  const isCancelled = order.erpStatus === 'CANCELLED';

  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  async function handleUpdateTracking(e: React.FormEvent) {
    e.preventDefault();
    setTrackingSubmitting(true);
    try {
      await fetch(`/api/erp/orders/${encodeURIComponent(order.orderId)}/update-tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingForm),
      });
      setTrackingFormOpen(false);
      onAction('refresh', order.orderId);
    } finally {
      setTrackingSubmitting(false);
    }
  }

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

  const modal = (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-border"
        style={{ background: 'var(--background)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between gap-4 px-6 py-4 shrink-0 border-b border-border"
          style={{ background: '#142032' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-black tracking-tighter" style={{ color: '#F71963' }}>VTEX</span>
            <span className="text-white/20 font-thin">|</span>
            <span className="font-mono text-sm font-semibold text-white truncate">{order.orderId}</span>
            {order.sequence && (
              <span className="text-xs text-white/40 hidden sm:inline">#{order.sequence}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={order.erpStatus} />
            <StatusBadge status={order.startHandlingStatus} />
            <button
              type="button"
              onClick={onClose}
              className="ml-2 flex items-center justify-center w-7 h-7 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Row 1: Summary + Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Invoice</span>
                  <StatusBadge status={order.invoiceStatus} />
                </div>
              </div>
              {order.errorMessage && (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                  <svg className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.5v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0zm0 6.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z" />
                  </svg>
                  <span className="text-xs text-destructive leading-relaxed">{order.errorMessage}</span>
                </div>
              )}
            </InfoCard>

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

          {/* Order Items */}
          {order.erpPayload?.items && order.erpPayload.items.length > 0 && (
            <InfoCard title="Order Items">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="pb-2 pr-3 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-10" />
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
                            <img src={item.imageUrl} alt={item.name ?? ''} width={32} height={32} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-md border border-border bg-muted flex items-center justify-center shrink-0">
                            <svg className="w-3.5 h-3.5 text-muted-foreground/40" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                              <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13zm0 1h13a.5.5 0 0 1 .5.5v6l-3.775-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12v.54A.505.505 0 0 1 1 12.5v-9a.5.5 0 0 1 .5-.5z" />
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

          {/* Invoice Details */}
          {order.startHandlingStatus === 'SUCCESS' && (
            <InfoCard title="Invoice (Nota Fiscal)">
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Status</span>
                    <StatusBadge status={order.invoiceStatus} />
                  </div>
                  <Field label="Invoice Number" value={order.invoiceNumber} mono />
                  <Field label="Issued At" value={order.invoiceIssuedAt ? fmt(order.invoiceIssuedAt) : undefined} />
                  {order.invoiceTracking?.trackingNumber && <Field label="Tracking #" value={order.invoiceTracking.trackingNumber} mono />}
                  {order.invoiceTracking?.courier && <Field label="Carrier" value={order.invoiceTracking.courier} />}
                  {order.invoiceTracking?.trackingUrl && (
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tracking URL</span>
                      <a href={order.invoiceTracking.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">
                        {order.invoiceTracking.trackingUrl}
                      </a>
                    </div>
                  )}
                </div>
                {order.invoiceStatus === 'SUCCESS' && (
                  <div className="border-t border-border pt-3">
                    {!trackingFormOpen ? (
                      <button type="button" onClick={() => setTrackingFormOpen(true)} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <svg className="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2v10M2 7h10" /></svg>
                        Update Tracking
                      </button>
                    ) : (
                      <form onSubmit={handleUpdateTracking} className="space-y-3">
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Update Tracking Info</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] text-muted-foreground">Carrier</label>
                            <input type="text" placeholder="e.g. Correios" value={trackingForm.courier} onChange={(e) => setTrackingForm((f) => ({ ...f, courier: e.target.value }))} className="rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] text-muted-foreground">Tracking Number</label>
                            <input type="text" placeholder="e.g. BR123456789BR" value={trackingForm.trackingNumber} onChange={(e) => setTrackingForm((f) => ({ ...f, trackingNumber: e.target.value }))} className="rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] text-muted-foreground">Tracking URL (optional)</label>
                            <input type="url" placeholder="https://..." value={trackingForm.trackingUrl} onChange={(e) => setTrackingForm((f) => ({ ...f, trackingUrl: e.target.value }))} className="rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={trackingSubmitting} className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                            {trackingSubmitting ? 'Saving…' : 'Save Tracking'}
                          </button>
                          <button type="button" onClick={() => setTrackingFormOpen(false)} className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors">
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </InfoCard>
          )}

          {/* Shipping + Payment + Label */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="flex justify-center py-2">
                <ShippingLabel order={order} />
              </div>
            </CollapsibleCard>
            {order.invoiceStatus === 'SUCCESS' && (
              <CollapsibleCard title="Electronic Invoice">
                <div className="py-2">
                  <DanfeSheet order={order} />
                </div>
              </CollapsibleCard>
            )}
          </div>

          {/* JSON payloads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Account mismatch warning */}
          {accountMismatch && (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Account mismatch — VTEX API actions are disabled
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                  This order belongs to account <strong>{order.account}</strong>, but your configured credentials are for <strong>{configAccount}</strong>.
                  Operations that call the VTEX API (Reprocess, Start Handling, Invoice, Cancel) will not work with the wrong credentials.
                  Switch to the <strong>{order.account}</strong> account in Configuration to perform these actions.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-wrap gap-2">
            {isCancelled ? (
              <ActionBtn variant="danger" onClick={() => onAction('delete', order.orderId)}>
                <BtnIcon d="M3 6h10M8 6V4M5 6l.5 8h5l.5-8" />
                Delete Order
              </ActionBtn>
            ) : (
              <>
                <ActionBtn disabled={accountMismatch} onClick={() => onAction('reprocess', order.orderId)}>
                  <BtnIcon d="M4 4v3h3M12 12v-3h-3M3.5 7a5.5 5.5 0 1 1 .7 4" />
                  Reprocess
                </ActionBtn>
                <ActionBtn disabled={accountMismatch || order.startHandlingStatus === 'SUCCESS'} onClick={() => onAction('retry-start-handling', order.orderId)}>
                  <BtnIcon d="M5 12h7M9 8l4 4-4 4" />
                  Retry Start Handling
                </ActionBtn>
                <ActionBtn disabled={accountMismatch || order.startHandlingStatus !== 'SUCCESS' || order.invoiceStatus === 'SUCCESS'} onClick={() => onAction('send-invoice', order.orderId)}>
                  <BtnIcon d="M2 4h10v6H2zM5 10v2m4-2v2M1 12h10" />
                  {order.invoiceStatus === 'ERROR' ? 'Retry Invoice' : 'Send Invoice'}
                </ActionBtn>
                <ActionBtn onClick={() => onAction('resolve', order.orderId)}>
                  <BtnIcon d="M4 8l3 3 5-5" />
                  Mark Resolved
                </ActionBtn>
                <div className="w-px self-stretch bg-border mx-1" />
                <ActionBtn variant="ghost" onClick={() => { if (order.erpPayload) navigator.clipboard.writeText(JSON.stringify(order.erpPayload, null, 2)).catch(() => {}); }}>
                  <BtnIcon d="M8 4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2M8 4h6l2 2v4M8 4v4h6" />
                  Copy ERP
                </ActionBtn>
                <ActionBtn variant="ghost" onClick={() => { if (order.vtexOrderRaw != null) navigator.clipboard.writeText(JSON.stringify(order.vtexOrderRaw, null, 2)).catch(() => {}); }}>
                  <BtnIcon d="M8 4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2-2v-2M8 4h6l2 2v4M8 4v4h6" />
                  Copy VTEX
                </ActionBtn>
                <div className="flex-1" />
                {order.invoiceStatus === 'SUCCESS' ? (
                  <span title="Order cannot be cancelled after invoice is sent">
                    <ActionBtn variant="danger" onClick={() => {}} disabled>Cancel</ActionBtn>
                  </span>
                ) : (
                  <ActionBtn variant="danger" disabled={accountMismatch} onClick={() => onAction('cancel', order.orderId)}>Cancel</ActionBtn>
                )}
                <ActionBtn variant="danger" onClick={() => onAction('delete', order.orderId)}>Delete</ActionBtn>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

/* ─── Sub-components ──────────────────────────────────────────── */

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
        onClick={() => setOpen((v) => !v)}
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
        <svg
          className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform duration-150', open && 'rotate-180')}
          viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M3 5l4 4 4-4" />
        </svg>
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
      {!last && <div className="absolute left-[5px] top-[14px] bottom-0 w-px bg-border" />}
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

function ActionBtn({ children, onClick, disabled = false, variant = 'default' }: {
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
        variant === 'ghost'  ? 'border-border bg-background hover:bg-muted text-foreground'
        : variant === 'danger' ? 'border-transparent bg-red-600 text-white hover:bg-red-700'
        : 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {children}
    </button>
  );
}
