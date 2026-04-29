'use client';

import { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';
import type { ErpOrderRecord, ErpTimelineEntry } from '@/types';

type ActionType = 'reprocess' | 'retry-start-handling' | 'resolve' | 'cancel' | 'copy-erp' | 'copy-vtex';

interface OrderRowProps {
  order: ErpOrderRecord;
  onAction: (action: ActionType, orderId: string) => void;
}

export function OrderRow({ order, onAction }: OrderRowProps) {
  const [open, setOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  function fmt(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
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
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(order.lastAttemptAt)}</td>
        <td className="px-3 py-2 text-xs text-center">{order.attempts}</td>
        <td className="px-3 py-2 text-xs text-destructive max-w-[140px] truncate" title={order.errorMessage}>{order.errorMessage ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-center text-muted-foreground">{open ? '▲' : '▼'}</td>
      </tr>

      {open && (
        <tr>
          <td colSpan={17} className="bg-muted/20 border-b border-border px-4 py-4">
            <div className="space-y-4 max-w-5xl">

              {/* 1. ERP Summary */}
              <Section title="ERP Summary">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <Pair label="Order ID" value={order.orderId} />
                  <Pair label="Sequence" value={order.sequence} />
                  <Pair label="Customer" value={order.customerName} />
                  <Pair label="Email" value={order.customerEmailMasked} />
                  <Pair label="Total" value={fmtCurrency(order.totalValue)} />
                  <Pair label="Payment" value={order.paymentSummary} />
                  <Pair label="Shipping" value={order.shippingSummary} />
                  <Pair label="ERP Status" value={<StatusBadge status={order.erpStatus} />} />
                  <Pair label="SH Status" value={<StatusBadge status={order.startHandlingStatus} />} />
                </dl>
              </Section>

              {/* 2. Order Items */}
              {order.erpPayload && order.erpPayload.items.length > 0 && (
                <Section title="Order Items">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="pb-1 pr-3">SKU</th>
                        <th className="pb-1 pr-3">Product ID</th>
                        <th className="pb-1 pr-3">Name</th>
                        <th className="pb-1 pr-3 text-right">Qty</th>
                        <th className="pb-1 pr-3 text-right">Unit Price</th>
                        <th className="pb-1 pr-3 text-right">Selling Price</th>
                        <th className="pb-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.erpPayload.items.map((item, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-1 pr-3 font-mono">{item.skuId ?? '—'}</td>
                          <td className="py-1 pr-3 font-mono">{item.productId ?? '—'}</td>
                          <td className="py-1 pr-3">{item.name ?? '—'}</td>
                          <td className="py-1 pr-3 text-right">{item.quantity ?? '—'}</td>
                          <td className="py-1 pr-3 text-right">{fmtCurrency(item.price)}</td>
                          <td className="py-1 pr-3 text-right">{fmtCurrency(item.sellingPrice)}</td>
                          <td className="py-1 text-right">{fmtCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {/* 3. Shipping Details */}
              {order.erpPayload?.logisticsInfo != null && (
                <Section title="Shipping Details">
                  <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-32">
                    {JSON.stringify(order.erpPayload.logisticsInfo, null, 2)}
                  </pre>
                </Section>
              )}

              {/* 4. Payment Details */}
              {order.erpPayload?.paymentSummary && (
                <Section title="Payment Details">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <Pair label="Payment Summary" value={order.erpPayload.paymentSummary} />
                    <Pair label="Total" value={fmtCurrency(order.totalValue)} />
                  </dl>
                </Section>
              )}

              {/* 5. ERP Normalized Payload */}
              {order.erpPayload && (
                <Section title="ERP Normalized Payload">
                  <JsonViewer data={order.erpPayload} />
                </Section>
              )}

              {/* 6. Raw VTEX Order Payload (collapsed by default) */}
              {order.vtexOrderRaw != null && (
                <div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRawOpen((v) => !v); }}
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground flex items-center gap-1"
                  >
                    Raw VTEX Payload {rawOpen ? '▲' : '▼'}
                  </button>
                  {rawOpen && (
                    <div className="mt-2">
                      <JsonViewer data={order.vtexOrderRaw} maxHeight="max-h-64" />
                    </div>
                  )}
                </div>
              )}

              {/* 7. Processing Timeline */}
              <Section title="Processing Timeline">
                {order.timeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No timeline entries.</p>
                ) : (
                  <ol className="space-y-1">
                    {order.timeline.map((entry, i) => (
                      <TimelineEntry key={i} entry={entry} />
                    ))}
                  </ol>
                )}
              </Section>

              {/* 8. Actions */}
              <Section title="Actions">
                <div
                  className="flex flex-wrap gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ActionBtn onClick={() => onAction('reprocess', order.orderId)}>Reprocess Order</ActionBtn>
                  <ActionBtn
                    onClick={() => onAction('retry-start-handling', order.orderId)}
                    disabled={order.startHandlingStatus === 'SUCCESS'}
                  >
                    Retry Start Handling
                  </ActionBtn>
                  <ActionBtn onClick={() => onAction('resolve', order.orderId)}>Mark as Resolved</ActionBtn>
                  <ActionBtn
                    variant="danger"
                    onClick={() => onAction('cancel', order.orderId)}
                    disabled={order.erpStatus === 'CANCELLED'}
                  >
                    Cancel Order
                  </ActionBtn>
                  <ActionBtn
                    variant="ghost"
                    onClick={() => {
                      if (order.erpPayload) {
                        navigator.clipboard.writeText(JSON.stringify(order.erpPayload, null, 2)).catch(() => {});
                      }
                    }}
                  >
                    Copy ERP Payload
                  </ActionBtn>
                  <ActionBtn
                    variant="ghost"
                    onClick={() => {
                      if (order.vtexOrderRaw != null) {
                        navigator.clipboard.writeText(JSON.stringify(order.vtexOrderRaw, null, 2)).catch(() => {});
                      }
                    }}
                  >
                    Copy VTEX Payload
                  </ActionBtn>
                </div>
              </Section>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium truncate">{value ?? '—'}</dd>
    </div>
  );
}

function JsonViewer({ data, maxHeight = 'max-h-48' }: { data: unknown; maxHeight?: string }) {
  return (
    <pre className={cn('text-xs bg-muted rounded p-3 overflow-auto', maxHeight)}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

const TIMELINE_COLORS: Record<string, string> = {
  SUCCESS: 'bg-green-500',
  ERROR:   'bg-red-500',
  INFO:    'bg-blue-400',
  SKIPPED: 'bg-gray-300',
};

function TimelineEntry({ entry }: { entry: ErpTimelineEntry }) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <span className={cn('mt-1 h-2 w-2 rounded-full shrink-0', TIMELINE_COLORS[entry.status] ?? 'bg-gray-300')} />
      <span className="text-muted-foreground shrink-0 w-36">{new Date(entry.timestamp).toLocaleTimeString()}</span>
      <span className="font-mono text-foreground">{entry.step}</span>
      {entry.message && <span className="text-muted-foreground ml-2">{entry.message}</span>}
    </li>
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
        'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-40 disabled:pointer-events-none',
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
