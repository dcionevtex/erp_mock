'use client';

import { useEffect, useRef } from 'react';
import type { ErpOrderRecord } from '@/types';

// Deterministic 44-digit mock NF-e access key derived from orderId
function mockAccessKey(orderId: string): string {
  let h = 5381;
  for (let i = 0; i < orderId.length; i++) h = ((h << 5) + h) ^ orderId.charCodeAt(i);
  const now = new Date();
  const cUF = '35'; // SP
  const aamm = `${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const cnpj = '00000000000191';
  const mod = '55'; // NF-e
  const serie = '001';
  const nNF = Math.abs(h % 999999999).toString().padStart(9, '0');
  const tpEmis = '1';
  const cNF = Math.abs((h >> 8) % 99999999).toString().padStart(8, '0');
  const key44 = `${cUF}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
  return key44.slice(0, 43).padEnd(43, '0') + '0'; // cDV placeholder
}

function fmtKey(key: string): string {
  return key.match(/.{1,4}/g)?.join(' ') ?? key;
}

function R$(val?: number): string {
  if (val == null) return 'R$ 0,00';
  return `R$ ${(val / 100).toFixed(2).replace('.', ',')}`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

interface Props {
  order: ErpOrderRecord;
}

export function DanfeSheet({ order }: Props) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const accessKey = mockAccessKey(order.orderId);
  const invoiceNumber = (order.invoiceNumber ?? '1').replace(/\D/g, '').padStart(9, '0');
  const items = order.erpPayload?.items ?? [];
  const emitente = order.account ? order.account.toUpperCase() : 'VTEX COMMERCE BRASIL LTDA';
  const icmsBase = Math.round((order.totalValue ?? 0) * 0.12);

  useEffect(() => {
    if (!barcodeRef.current) return;
    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        JsBarcode(barcodeRef.current, accessKey, {
          format: 'CODE128',
          width: 1.2,
          height: 32,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch {}
    });
  }, [accessKey]);

  function handlePrint() {
    const barcodeHtml = barcodeRef.current?.outerHTML ?? '';
    const win = window.open('', '_blank', 'width=960,height=740,toolbar=0,menubar=0,scrollbars=1');
    if (!win) return;
    win.document.write(buildPrintHtml({ order, accessKey, invoiceNumber, emitente, icmsBase, barcodeHtml }));
    win.document.close();
  }

  return (
    <div className="border border-gray-400 rounded bg-white text-[10px] shadow-sm select-none" style={{ fontFamily: 'Arial, sans-serif' }}>

      {/* ── Header ── */}
      <div className="flex border-b border-gray-400" style={{ minHeight: 70 }}>
        {/* Emitente */}
        <div className="flex-1 p-2 border-r border-gray-400">
          <div className="text-[8px] text-gray-500 uppercase tracking-wider">IDENTIFICAÇÃO DO EMITENTE</div>
          <div className="font-black text-sm mt-0.5 leading-tight">{emitente}</div>
          <div className="text-[9px] text-gray-600 mt-0.5">CNPJ: 00.000.000/0001-91</div>
          <div className="text-[9px] text-gray-600">IE: 000.000.000.000 · IM: 12345-6</div>
          <div className="text-[9px] text-gray-600">São Paulo, SP, Brasil · vtex.com</div>
        </div>
        {/* DANFE center block */}
        <div className="w-[108px] flex flex-col items-center justify-center p-2 border-r border-gray-400 text-center">
          <div className="text-xl font-black tracking-widest leading-none">INVOICE</div>
          <div className="text-[8px] leading-snug mt-1 text-gray-500">Simulated Electronic<br />Invoice Document</div>
          <div className="mt-2 flex gap-3 text-[9px]">
            <span>Entrada <b>1</b></span>
            <span className="border border-gray-800 px-1 font-black">2</span>
            <span>Saída <b>2</b></span>
          </div>
        </div>
        {/* NF number */}
        <div className="w-[96px] flex flex-col justify-center p-2 text-center gap-1">
          <div>
            <div className="text-[8px] text-gray-500 uppercase">Nº</div>
            <div className="text-sm font-black font-mono">{invoiceNumber}</div>
          </div>
          <div>
            <div className="text-[8px] text-gray-500 uppercase">Série</div>
            <div className="font-bold">001</div>
          </div>
          <div className="text-[8px] text-gray-500">Folha 1/1</div>
        </div>
      </div>

      {/* ── Chave de acesso ── */}
      <div className="px-2 py-1.5 border-b border-gray-400">
        <div className="text-[8px] text-gray-500 uppercase tracking-wider">Chave de Acesso</div>
        <div className="text-[9px] font-bold font-mono tracking-wider text-center mt-0.5">{fmtKey(accessKey)}</div>
        <svg ref={barcodeRef} className="w-full mt-1" style={{ height: '28px' }} />
      </div>

      {/* ── Natureza + CNPJ ── */}
      <div className="flex border-b border-gray-400">
        <div className="flex-1 p-2 border-r border-gray-400">
          <div className="text-[8px] text-gray-500 uppercase">Natureza da Operação</div>
          <div className="text-[10px] font-semibold">VENDA DE MERCADORIA</div>
        </div>
        <div className="p-2 border-r border-gray-400 w-[130px]">
          <div className="text-[8px] text-gray-500 uppercase">Protocolo de Autorização</div>
          <div className="text-[9px] font-mono">000000000000000</div>
        </div>
        <div className="p-2 w-[120px]">
          <div className="text-[8px] text-gray-500 uppercase">Data/Hora Emissão</div>
          <div className="text-[10px] font-semibold">{fmtDate(order.invoiceIssuedAt)}</div>
        </div>
      </div>

      {/* ── Destinatário ── */}
      <div className="px-2 py-1.5 border-b border-gray-400">
        <div className="text-[8px] text-gray-500 uppercase tracking-wider mb-0.5">Destinatário / Remetente</div>
        <div className="grid gap-x-4 gap-y-0.5 text-[9px]" style={{ gridTemplateColumns: '1fr 1fr 80px' }}>
          <div><span className="text-gray-500">Nome: </span><span className="font-semibold">{order.customerName ?? '—'}</span></div>
          <div><span className="text-gray-500">Email: </span>{order.customerEmailMasked ?? '—'}</div>
          <div><span className="text-gray-500">UF: </span>SP</div>
          <div><span className="text-gray-500">CPF/CNPJ: </span>***.***.***-**</div>
          <div><span className="text-gray-500">Pedido VTEX: </span><span className="font-mono">{order.orderId}</span></div>
          <div><span className="text-gray-500">IE: </span>ISENTO</div>
        </div>
      </div>

      {/* ── Cálculo do imposto ── */}
      <div className="border-b border-gray-400">
        <div className="px-2 pt-1 text-[8px] text-gray-500 uppercase tracking-wider">Cálculo do Imposto</div>
        <div className="grid text-center" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
          {[
            ['BC ICMS', R$(icmsBase)],
            ['Vl. ICMS', R$(icmsBase)],
            ['BC IPI', 'R$ 0,00'],
            ['Vl. IPI', 'R$ 0,00'],
            ['Vl. Produtos', R$(order.totalValue)],
            ['Vl. Total NF', R$(order.totalValue)],
          ].map(([label, val], i) => (
            <div key={i} className={`py-1 px-1 ${i > 0 ? 'border-l border-gray-300' : ''}`}>
              <div className="text-[8px] text-gray-500 uppercase leading-tight">{label}</div>
              <div className="text-[9px] font-bold">{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Transportadora ── */}
      <div className="px-2 py-1.5 border-b border-gray-400">
        <div className="text-[8px] text-gray-500 uppercase tracking-wider mb-0.5">Transportador / Volumes Transportados</div>
        <div className="grid gap-x-4 gap-y-0.5 text-[9px]" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div><span className="text-gray-500">Transportadora: </span>{order.shippingSummary ?? '—'}</div>
          <div><span className="text-gray-500">Frete por conta: </span>Destinatário (CIF)</div>
          {order.invoiceTracking?.trackingNumber && (
            <div><span className="text-gray-500">Nr. Rastreio: </span><span className="font-mono">{order.invoiceTracking.trackingNumber}</span></div>
          )}
        </div>
      </div>

      {/* ── Produtos ── compact */}
      <div className="border-b border-gray-400">
        <div className="px-2 pt-1 text-[8px] text-gray-500 uppercase tracking-wider">Dados dos Produtos / Serviços</div>
        <table className="w-full text-[9px]">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-left border-y border-gray-300">
              <th className="px-1.5 py-0.5">Código</th>
              <th className="px-1.5 py-0.5">Descrição</th>
              <th className="px-1.5 py-0.5 text-center">Qtd</th>
              <th className="px-1.5 py-0.5 text-right">V. Unit</th>
              <th className="px-1.5 py-0.5 text-right">V. Total</th>
            </tr>
          </thead>
          <tbody>
            {(items.length === 0 ? [{ skuId: '—', name: 'Produto simulado', quantity: 1, price: order.totalValue, total: order.totalValue }] : items.slice(0, 6)).map((item, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="px-1.5 py-0.5 font-mono">{item.skuId ?? `SKU${i + 1}`}</td>
                <td className="px-1.5 py-0.5 max-w-[120px] truncate">{item.name ?? '—'}</td>
                <td className="px-1.5 py-0.5 text-center">{item.quantity ?? 1}</td>
                <td className="px-1.5 py-0.5 text-right">{R$(item.price)}</td>
                <td className="px-1.5 py-0.5 text-right font-semibold">{R$(item.total ?? (item.price ?? 0) * (item.quantity ?? 1))}</td>
              </tr>
            ))}
            {items.length > 6 && (
              <tr><td colSpan={5} className="px-1.5 py-0.5 text-gray-400 italic">… mais {items.length - 6} produto(s) no documento completo</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Dados adicionais + Print ── */}
      <div className="px-2 py-2 flex items-end justify-between gap-2">
        <div className="text-[9px] text-gray-500 leading-snug">
          <div className="text-[8px] text-gray-500 uppercase tracking-wider mb-0.5">Informações Complementares</div>
          <div>Pedido: <span className="font-mono font-semibold text-gray-800">{order.orderId}</span></div>
          <div>Pagamento: {order.paymentSummary ?? '—'}</div>
          <div className="text-gray-400 italic text-[8px] mt-0.5">DOCUMENTO SIMULADO — USO EXCLUSIVO PARA DEMONSTRAÇÃO</div>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded shrink-0 transition-colors"
          style={{ background: '#142032', color: '#fff' }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 1a2 2 0 0 0-2 2v1h10V3a2 2 0 0 0-2-2H5zm6 8H5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z"/>
            <path d="M0 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2H2a2 2 0 0 1-2-2V7zm2.5 1a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
          </svg>
          Print Invoice
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Print HTML — A4 portrait, faithful DANFE layout
// ────────────────────────────────────────────────────────────────────────────

interface PrintArgs {
  order: ErpOrderRecord;
  accessKey: string;
  invoiceNumber: string;
  emitente: string;
  icmsBase: number;
  barcodeHtml: string;
}

function R$print(val?: number): string {
  if (val == null) return 'R$ 0,00';
  return `R$ ${(val / 100).toFixed(2).replace('.', ',')}`;
}

function buildPrintHtml({ order, accessKey, invoiceNumber, emitente, icmsBase, barcodeHtml }: PrintArgs): string {
  const items = order.erpPayload?.items ?? [];
  const fmtKey = (k: string) => k.match(/.{1,4}/g)?.join(' ') ?? k;
  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };
  const itemRows = (items.length === 0
    ? [{ skuId: '—', name: 'Produto simulado', quantity: 1, price: order.totalValue, total: order.totalValue }]
    : items
  ).map((item, i) => `
    <tr>
      <td>${item.skuId ?? `SKU${i+1}`}</td>
      <td>${item.name ?? '—'}</td>
      <td class="center">${item.quantity ?? 1}</td>
      <td class="right">${R$print(item.price)}</td>
      <td class="right">${R$print(item.total ?? (item.price ?? 0) * (item.quantity ?? 1))}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Electronic Invoice — NF ${invoiceNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; background: #fff; }

    .danfe { border: 1px solid #555; width: 100%; }

    /* shared */
    .section { border-bottom: 1px solid #555; }
    .label { font-size: 7pt; color: #555; text-transform: uppercase; letter-spacing: 0.03em; }
    .value { font-size: 9pt; font-weight: bold; }
    .mono  { font-family: 'Courier New', monospace; }
    .center { text-align: center; }
    .right  { text-align: right; }

    /* header */
    .header { display: flex; border-bottom: 1px solid #555; }
    .emitente { flex: 1; padding: 6px 8px; border-right: 1px solid #555; }
    .emitente-name { font-weight: 900; font-size: 13pt; }
    .emitente-sub  { font-size: 8pt; color: #444; margin-top: 1px; }
    .danfe-center { width: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; border-right: 1px solid #555; text-align: center; }
    .danfe-title  { font-size: 18pt; font-weight: 900; letter-spacing: 3px; }
    .danfe-sub    { font-size: 7pt; color: #555; line-height: 1.3; margin-top: 2px; }
    .danfe-tipo   { margin-top: 6px; font-size: 8pt; display: flex; gap: 8px; align-items: center; }
    .danfe-tipo-box { border: 2px solid #000; padding: 1px 5px; font-weight: 900; font-size: 11pt; }
    .nf-block  { width: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; gap: 4px; }

    /* chave */
    .chave { padding: 4px 8px; border-bottom: 1px solid #555; text-align: center; }
    .chave-key { font-family: 'Courier New', monospace; font-size: 8.5pt; font-weight: bold; letter-spacing: 1px; word-break: break-all; }
    .chave svg { max-width: 100%; height: 40px; display: block; margin: 4px auto 0; }

    /* two-col rows */
    .row { display: flex; border-bottom: 1px solid #555; }
    .cell { padding: 4px 8px; border-right: 1px solid #555; }
    .cell:last-child { border-right: none; }
    .cell-grow { flex: 1; }

    /* tax grid */
    .tax-grid { display: grid; grid-template-columns: repeat(6, 1fr); border-bottom: 1px solid #555; }
    .tax-cell { padding: 4px 6px; text-align: center; border-right: 1px solid #ddd; }
    .tax-cell:last-child { border-right: none; }

    /* items table */
    .items-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    .items-table th { background: #eee; border: 1px solid #bbb; padding: 3px 5px; font-size: 7pt; text-transform: uppercase; }
    .items-table td { border: 1px solid #ddd; padding: 3px 5px; }

    /* footer */
    .complementar { padding: 5px 8px; font-size: 8pt; }
    .watermark { font-size: 7pt; color: #aaa; font-style: italic; margin-top: 4px; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="danfe">

  <!-- Header -->
  <div class="header">
    <div class="emitente">
      <div class="label">Identificação do Emitente</div>
      <div class="emitente-name">${emitente}</div>
      <div class="emitente-sub">CNPJ: 00.000.000/0001-91 · IE: 000.000.000.000 · IM: 12345-6</div>
      <div class="emitente-sub">Av. Brigadeiro Faria Lima, 4055 — Itaim Bibi — São Paulo, SP — 04538-132</div>
      <div class="emitente-sub">vtex.com</div>
    </div>
    <div class="danfe-center">
      <div class="danfe-title">INVOICE</div>
      <div class="danfe-sub">Simulated Electronic<br>Invoice Document</div>
      <div class="danfe-tipo">
        <span>Entrada <b>1</b></span>
        <span class="danfe-tipo-box">2</span>
        <span>Saída <b>2</b></span>
      </div>
    </div>
    <div class="nf-block">
      <div>
        <div class="label" style="text-align:center">Nº</div>
        <div class="value mono" style="font-size:13pt;text-align:center">${invoiceNumber}</div>
      </div>
      <div>
        <div class="label" style="text-align:center">Série</div>
        <div class="value" style="text-align:center">001</div>
      </div>
      <div class="label" style="text-align:center;margin-top:4px">Folha 1/1</div>
    </div>
  </div>

  <!-- Chave de acesso -->
  <div class="chave">
    <div class="label">Chave de Acesso</div>
    <div class="chave-key">${fmtKey(accessKey)}</div>
    ${barcodeHtml}
    <div style="font-size:7pt;color:#555;margin-top:2px">Consulte a autenticidade no portal da SEFAZ</div>
  </div>

  <!-- Natureza + protocolo + data -->
  <div class="row">
    <div class="cell cell-grow">
      <div class="label">Natureza da Operação</div>
      <div class="value">VENDA DE MERCADORIA</div>
    </div>
    <div class="cell" style="width:160px">
      <div class="label">Protocolo de Autorização</div>
      <div class="value mono">000000000000000</div>
    </div>
    <div class="cell" style="width:130px">
      <div class="label">Data / Hora de Emissão</div>
      <div class="value">${fmtDate(order.invoiceIssuedAt)}</div>
    </div>
  </div>

  <!-- Destinatário -->
  <div class="section" style="padding:5px 8px">
    <div class="label">Destinatário / Remetente</div>
    <div style="display:grid;grid-template-columns:2fr 1.5fr 80px;gap:6px;margin-top:3px;font-size:9pt">
      <div><span style="color:#555">Nome: </span><b>${order.customerName ?? '—'}</b></div>
      <div><span style="color:#555">Email: </span>${order.customerEmailMasked ?? '—'}</div>
      <div><span style="color:#555">UF: </span>SP</div>
      <div><span style="color:#555">CPF/CNPJ: </span>***.***.***/****</div>
      <div><span style="color:#555">Pedido VTEX: </span><span class="mono">${order.orderId}</span></div>
      <div><span style="color:#555">IE: </span>ISENTO</div>
    </div>
  </div>

  <!-- Cálculo do imposto -->
  <div>
    <div style="padding:3px 8px"><div class="label">Cálculo do Imposto</div></div>
    <div class="tax-grid">
      ${[
        ['Base de Cálculo ICMS', R$print(icmsBase)],
        ['Valor do ICMS', R$print(icmsBase)],
        ['Base de Cálculo IPI', 'R$ 0,00'],
        ['Valor do IPI', 'R$ 0,00'],
        ['Valor dos Produtos', R$print(order.totalValue)],
        ['Valor Total da NF', R$print(order.totalValue)],
      ].map(([l, v]) => `<div class="tax-cell"><div class="label">${l}</div><div class="value">${v}</div></div>`).join('')}
    </div>
  </div>

  <!-- Transportadora -->
  <div class="section" style="padding:5px 8px">
    <div class="label">Transportador / Volumes Transportados</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:3px;font-size:9pt">
      <div><span style="color:#555">Transportadora: </span>${order.shippingSummary ?? '—'}</div>
      <div><span style="color:#555">Frete por conta: </span>Destinatário</div>
      ${order.invoiceTracking?.trackingNumber ? `<div><span style="color:#555">Nr. Rastreio: </span><span class="mono">${order.invoiceTracking.trackingNumber}</span></div>` : ''}
    </div>
  </div>

  <!-- Produtos -->
  <div class="section" style="padding:5px 8px">
    <div class="label" style="margin-bottom:4px">Dados dos Produtos / Serviços</div>
    <table class="items-table">
      <thead>
        <tr>
          <th>Código</th>
          <th>Descrição do Produto / Serviço</th>
          <th class="center">Qtd</th>
          <th class="right">V. Unitário</th>
          <th class="right">V. Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  </div>

  <!-- Informações complementares -->
  <div class="complementar">
    <div class="label">Informações Complementares / Dados Adicionais do Fisco</div>
    <div style="margin-top:4px">Pedido: <span class="mono"><b>${order.orderId}</b></span></div>
    <div>Forma de Pagamento: ${order.paymentSummary ?? '—'}</div>
    ${order.sequence ? `<div>Sequência: ${order.sequence}</div>` : ''}
    <div class="watermark">DOCUMENTO SIMULADO — GERADO PELO ERP CONNECT DEMO — USO EXCLUSIVO PARA TESTES E DEMONSTRAÇÕES. NÃO TEM VALIDADE FISCAL.</div>
  </div>

</div>
<script>
  window.onload = function() { window.print(); };
  window.onafterprint = function() { window.close(); };
</script>
</body>
</html>`;
}
