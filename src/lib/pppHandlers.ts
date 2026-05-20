// Shared business logic for PPP routes — used by both the scenario-in-URL routes
// (/api/payment-provider/[scenario]/...) and the legacy stateful routes.

import { randomUUID } from 'crypto';
import { upsertPayment, getPayment, appendCallLog } from '@/lib/pppStore';
import type { PppScenario, PppCreatePaymentRequest } from '@/types/ppp';

export const PPP_MANIFEST = {
  paymentMethods: [
    { name: 'Visa', allowsSplit: 'onAuthorize' },
    { name: 'Mastercard', allowsSplit: 'onAuthorize' },
    { name: 'American Express', allowsSplit: 'onAuthorize' },
    { name: 'Boleto Bancário', allowsSplit: 'disabled' },
    { name: 'Pix', allowsSplit: 'disabled' },
  ],
  customFields: [],
  autoSettleDelay: { minimum: '0', maximum: '720' },
};

export function buildPaymentResponse(paymentId: string, scenario: PppScenario) {
  const base = {
    paymentId,
    tid: randomUUID(),
    acquirer: 'VTEX Demo Acquirer',
    code: null as string | null,
    message: null as string | null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };

  switch (scenario) {
    case 'approved':
      return { ...base, status: 'approved', authorizationId: randomUUID(), nsu: String(Date.now()) };
    case 'denied':
      return { ...base, status: 'denied', authorizationId: null, nsu: null, code: 'cancel', message: 'Payment denied by simulator' };
    case 'pending':
      return { ...base, status: 'pending', authorizationId: null, nsu: null, message: 'Awaiting async callback' };
    case 'undefined':
      return { ...base, status: 'undefined', authorizationId: null, nsu: null, message: 'Payment status undefined — callback required' };
    default:
      return { ...base, status: 'approved', authorizationId: randomUUID(), nsu: String(Date.now()) };
  }
}

export function handleManifest(pathname: string, start: number) {
  const response = PPP_MANIFEST;
  appendCallLog({
    timestamp: new Date().toISOString(),
    method: 'GET',
    path: pathname,
    responseBody: response,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });
  return response;
}

export function handleCreatePayment(body: PppCreatePaymentRequest, pathname: string, scenario: PppScenario, start: number) {
  const paymentId = body.paymentId ?? randomUUID();
  const now = new Date().toISOString();

  upsertPayment({
    paymentId,
    orderId: body.orderId,
    transactionId: body.transactionId,
    paymentMethod: body.paymentMethod,
    value: body.value,
    currency: body.currency,
    installments: body.installments,
    callbackUrl: body.callbackUrl,
    status: scenario,
    scenario,
    authorizationId: scenario === 'approved' ? randomUUID() : undefined,
    createdAt: now,
    requestBody: body,
  });

  const responseBody = buildPaymentResponse(paymentId, scenario);

  appendCallLog({
    timestamp: now,
    method: 'POST',
    path: pathname,
    paymentId,
    requestBody: body,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return responseBody;
}

export function handleGetPayment(paymentId: string, pathname: string, start: number) {
  const record = getPayment(paymentId);
  const now = new Date().toISOString();

  if (!record) {
    const body = { error: 'Payment not found' };
    appendCallLog({ timestamp: now, method: 'GET', path: pathname, paymentId, responseBody: body, httpStatus: 404, durationMs: Date.now() - start });
    return { body, status: 404 };
  }

  const body = {
    paymentId: record.paymentId,
    status: record.status,
    authorizationId: record.authorizationId ?? null,
    nsu: null,
    acquirer: 'VTEX Demo Acquirer',
    code: null,
    message: null,
  };
  appendCallLog({ timestamp: now, method: 'GET', path: pathname, paymentId, responseBody: body, httpStatus: 200, durationMs: Date.now() - start });
  return { body, status: 200 };
}

export function handleSettlement(paymentId: string, body: Record<string, unknown>, pathname: string, start: number) {
  const record = getPayment(paymentId);
  const now = new Date().toISOString();
  const settleId = randomUUID();
  if (record) upsertPayment({ ...record, settleId, settledAt: now });

  const responseBody = { paymentId, settleId, value: body.value ?? null, code: null, message: 'Successfully settled', requestId: body.requestId ?? null };
  appendCallLog({ timestamp: now, method: 'POST', path: pathname, paymentId, requestBody: body, responseBody, httpStatus: 200, durationMs: Date.now() - start });
  return responseBody;
}

export function handleCancellation(paymentId: string, body: Record<string, unknown>, pathname: string, start: number) {
  const record = getPayment(paymentId);
  const now = new Date().toISOString();
  const cancellationId = randomUUID();
  if (record) upsertPayment({ ...record, cancellationId, cancelledAt: now, status: 'denied' });

  const responseBody = { paymentId, cancellationId, code: null, message: 'Successfully cancelled', requestId: body.requestId ?? null };
  appendCallLog({ timestamp: now, method: 'POST', path: pathname, paymentId, requestBody: body, responseBody, httpStatus: 200, durationMs: Date.now() - start });
  return responseBody;
}

export function handleRefund(paymentId: string, body: Record<string, unknown>, pathname: string, start: number) {
  const record = getPayment(paymentId);
  const now = new Date().toISOString();
  const refundId = randomUUID();
  if (record) upsertPayment({ ...record, refundId, refundedAt: now });

  const responseBody = { paymentId, refundId, value: body.value ?? null, code: null, message: 'Successfully refunded', requestId: body.requestId ?? null };
  appendCallLog({ timestamp: now, method: 'POST', path: pathname, paymentId, requestBody: body, responseBody, httpStatus: 200, durationMs: Date.now() - start });
  return responseBody;
}
