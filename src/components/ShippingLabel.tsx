'use client';

import { useEffect, useRef } from 'react';
import type { ErpOrderRecord } from '@/types';

interface Props {
  order: ErpOrderRecord;
}

export function ShippingLabel({ order }: Props) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!barcodeRef.current || !order.orderId) return;
    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        JsBarcode(barcodeRef.current, order.orderId, {
          format: 'CODE128',
          width: 2,
          height: 64,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch {
        // orderId may contain characters invalid for CODE128 — fail silently
      }
    });
  }, [order.orderId]);

  function handlePrint() {
    const barcodeHtml = barcodeRef.current?.outerHTML ?? '';
    const win = window.open('', '_blank', 'width=520,height=720,toolbar=0,menubar=0');
    if (!win) return;
    win.document.write(buildPrintHtml(order, barcodeHtml));
    win.document.close();
  }

  const fromName = order.account ? `VTEX · ${order.account}` : 'VTEX';

  return (
    <div className="border border-gray-300 rounded bg-white max-w-xs text-sm shadow-sm select-none">

      {/* Header: From + QR placeholder */}
      <div className="flex border-b border-gray-300">
        <div className="flex-1 p-3 border-r border-gray-300">
          <div className="font-bold text-sm leading-tight">{fromName}</div>
          <div className="text-[11px] text-gray-500 mt-1">São Paulo, SP, Brasil</div>
          <div className="text-[11px] text-gray-500">vtex.com</div>
        </div>
        <div className="w-[72px] flex items-center justify-center p-2">
          <div className="w-14 h-14 border border-gray-300 rounded flex items-center justify-center">
            <svg viewBox="0 0 40 40" width="48" height="48" className="opacity-30">
              <rect x="2" y="2" width="12" height="12" fill="none" stroke="#000" strokeWidth="2"/>
              <rect x="5" y="5" width="6" height="6" fill="#000"/>
              <rect x="26" y="2" width="12" height="12" fill="none" stroke="#000" strokeWidth="2"/>
              <rect x="29" y="5" width="6" height="6" fill="#000"/>
              <rect x="2" y="26" width="12" height="12" fill="none" stroke="#000" strokeWidth="2"/>
              <rect x="5" y="29" width="6" height="6" fill="#000"/>
              <rect x="18" y="2" width="2" height="2" fill="#000"/><rect x="22" y="2" width="2" height="2" fill="#000"/>
              <rect x="18" y="6" width="4" height="2" fill="#000"/>
              <rect x="18" y="18" width="2" height="6" fill="#000"/>
              <rect x="22" y="18" width="4" height="2" fill="#000"/>
              <rect x="26" y="18" width="2" height="4" fill="#000"/>
              <rect x="30" y="18" width="4" height="2" fill="#000"/>
              <rect x="34" y="22" width="4" height="2" fill="#000"/>
              <rect x="26" y="26" width="2" height="4" fill="#000"/>
              <rect x="30" y="28" width="4" height="2" fill="#000"/>
              <rect x="34" y="30" width="4" height="6" fill="#000"/>
              <rect x="26" y="34" width="6" height="2" fill="#000"/>
            </svg>
          </div>
        </div>
      </div>

      {/* To: fields */}
      <div className="p-3 border-b border-gray-300">
        <div className="font-semibold text-xs mb-2">To:</div>
        <div className="grid gap-y-[3px]" style={{ gridTemplateColumns: '68px 1fr', fontSize: '11px' }}>
          <span className="text-gray-500">Name</span>
          <span>: <span className="font-medium">{order.customerName ?? '—'}</span></span>

          <span className="text-gray-500">Email</span>
          <span>: {order.customerEmailMasked ?? '—'}</span>

          <span className="text-gray-500">Carrier</span>
          <span>: {order.shippingSummary ?? '—'}</span>

          <span className="text-gray-500">Items</span>
          <span>: {order.itemCount ?? '—'}</span>

          <span className="text-gray-500">Order ID</span>
          <span className="font-mono">: {order.orderId}</span>

          {order.sequence && (
            <>
              <span className="text-gray-500">Sequence</span>
              <span>: {order.sequence}</span>
            </>
          )}

          <span className="text-gray-500">Payment</span>
          <span>: {order.paymentSummary ?? '—'}</span>
        </div>
      </div>

      {/* Barcode */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-300 flex flex-col items-center">
        <svg ref={barcodeRef} className="w-full" />
        <span className="text-[10px] font-mono mt-1 tracking-widest text-gray-700">{order.orderId}</span>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="text-[10px] text-gray-500 leading-tight">
          <div>Tracking # : <span className="font-mono font-semibold text-gray-800">{order.orderId}</span></div>
          {order.sequence && <div>Lot # : {order.sequence}</div>}
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors shrink-0"
          style={{ background: '#142032', color: '#fff' }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 1a2 2 0 0 0-2 2v1h10V3a2 2 0 0 0-2-2H5zm6 8H5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z"/>
            <path d="M0 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2H2a2 2 0 0 1-2-2V7zm2.5 1a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
          </svg>
          Print Label
        </button>
      </div>
    </div>
  );
}

function buildPrintHtml(order: ErpOrderRecord, barcodeHtml: string): string {
  const fromName = order.account ? `VTEX · ${order.account}` : 'VTEX';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Shipping Label — ${order.orderId}</title>
  <style>
    @page { size: 4in 6in; margin: 0.25in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; background: #fff; }
    .label { border: 1px solid #ccc; width: 100%; }
    .header { display: flex; border-bottom: 1px solid #ccc; }
    .from { flex: 1; padding: 10px 12px; border-right: 1px solid #ccc; }
    .from-name { font-weight: bold; font-size: 14px; }
    .from-sub { color: #666; font-size: 10px; margin-top: 2px; }
    .qr-cell { width: 76px; display: flex; align-items: center; justify-content: center; padding: 8px; }
    .qr-box { width: 60px; height: 60px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #999; }
    .to { padding: 10px 12px; border-bottom: 1px solid #ccc; }
    .to-title { font-weight: bold; margin-bottom: 6px; }
    .to-grid { display: grid; grid-template-columns: 70px 1fr; gap: 3px 0; font-size: 11px; }
    .lbl { color: #666; }
    .barcode-section { padding: 10px 12px; border-bottom: 1px solid #ccc; text-align: center; }
    .barcode-section svg { width: 100%; max-width: 340px; }
    .barcode-num { font-family: monospace; font-size: 11px; margin-top: 3px; letter-spacing: 2px; color: #444; }
    .footer { padding: 6px 12px; font-size: 10px; color: #555; display: flex; justify-content: space-between; }
    .footer strong { font-family: monospace; color: #000; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="label">
    <div class="header">
      <div class="from">
        <div class="from-name">${fromName}</div>
        <div class="from-sub">São Paulo, SP, Brasil</div>
        <div class="from-sub">vtex.com</div>
      </div>
      <div class="qr-cell"><div class="qr-box">QR</div></div>
    </div>
    <div class="to">
      <div class="to-title">To:</div>
      <div class="to-grid">
        <span class="lbl">Name</span><span>: <strong>${order.customerName ?? '—'}</strong></span>
        <span class="lbl">Email</span><span>: ${order.customerEmailMasked ?? '—'}</span>
        <span class="lbl">Carrier</span><span>: ${order.shippingSummary ?? '—'}</span>
        <span class="lbl">Items</span><span>: ${order.itemCount ?? '—'}</span>
        <span class="lbl">Order ID</span><span>: <strong>${order.orderId}</strong></span>
        ${order.sequence ? `<span class="lbl">Sequence</span><span>: ${order.sequence}</span>` : ''}
        <span class="lbl">Payment</span><span>: ${order.paymentSummary ?? '—'}</span>
      </div>
    </div>
    <div class="barcode-section">
      ${barcodeHtml}
      <div class="barcode-num">${order.orderId}</div>
    </div>
    <div class="footer">
      <span>Tracking # : <strong>${order.orderId}</strong></span>
      ${order.sequence ? `<span>Lot # : <strong>${order.sequence}</strong></span>` : ''}
    </div>
  </div>
  <script>
    window.onload = function() { window.print(); };
    window.onafterprint = function() { window.close(); };
  </script>
</body>
</html>`;
}
