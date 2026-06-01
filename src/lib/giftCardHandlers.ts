// Business logic for Gift Card Provider Protocol routes.
// Account-scoped — account is always the first argument.

import { createHash, randomUUID } from 'crypto';
import {
  getGcConfig,
  getCard,
  upsertCard,
  listTransactionsForCard,
  upsertTransaction,
  getTransaction,
  appendSettlement,
  appendCancellation,
  appendCallLog,
} from '@/lib/giftCardStore';
import type { GcSearchRequest, GcTransactionRequest } from '@/types/giftCard';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Deterministic card ID per account + email — same customer always gets the same card
function cardIdForEmail(account: string, email: string): string {
  const hash = createHash('sha256')
    .update(`${account}:${email.toLowerCase().trim()}`)
    .digest('hex')
    .slice(0, 12);
  return `gc-${hash}`;
}

function redemptionCode(email: string): string {
  const prefix = email.split('@')[0].toUpperCase().slice(0, 6).replace(/[^A-Z0-9]/g, '');
  return `DEMO-${prefix}-GC`;
}

function buildCardResponse(card: ReturnType<typeof getCard>, balance: number) {
  if (!card) return null;
  return {
    id: card.id,
    redemptionCode: card.redemptionCode,
    balance,
    expiryDate: card.expiryDate,
    caption: card.caption,
    provider: 'DemoGiftCard',
    groupName: 'DemoGiftCard',
    inUse: false,
    isSpecialCard: false,
  };
}

// Balance = initialBalance minus value of non-cancelled transactions
function computeBalance(
  initialBalance: number,
  transactions: ReturnType<typeof listTransactionsForCard>
): number {
  const used = transactions.reduce((sum, tx) => {
    const cancelled = tx.cancellations.reduce((s, op) => s + op.value, 0);
    return sum + tx.value - cancelled;
  }, 0);
  return Math.max(0, initialBalance - used);
}

function inferEndpoint(method: string, path: string): string {
  if (path.endsWith('/_search')) return 'search';
  if (path.endsWith('/settlements')) return method === 'GET' ? 'list-settlements' : 'settle';
  if (path.endsWith('/cancellations')) return method === 'GET' ? 'list-cancellations' : 'cancel';
  if (path.endsWith('/transactions')) return 'create-transaction';
  if (/\/giftcards\/[^/]+$/.test(path)) return 'get-card';
  return 'unknown';
}

// ── Search ────────────────────────────────────────────────────────────────────

export function handleSearch(
  account: string,
  body: GcSearchRequest,
  pathname: string,
  start: number
) {
  const { scenario, mockBalance } = getGcConfig(account);

  if (scenario === 'empty') {
    appendCallLog(account, {
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: pathname,
      endpoint: 'search',
      requestBody: body,
      responseBody: [],
      httpStatus: 200,
      durationMs: Date.now() - start,
    });
    return { body: [], status: 200 };
  }

  const email =
    body.client?.email ||
    body.client?.id ||
    'unknown@demo.com';

  const cardId = cardIdForEmail(account, email);
  const now = new Date().toISOString();

  // Auto-create the card on first search
  let card = getCard(account, cardId);
  if (!card) {
    card = {
      id: cardId,
      redemptionCode: redemptionCode(email),
      caption: 'Demo Gift Card',
      initialBalance: mockBalance,
      expiryDate: '2099-12-31T00:00:00',
      owner: email,
      account,
      createdAt: now,
    };
    upsertCard(account, card);
  }

  const txs = listTransactionsForCard(account, cardId);
  const balance = computeBalance(card.initialBalance, txs);
  const responseCard = buildCardResponse(card, balance);
  const responseBody = balance > 0 ? [responseCard] : [];

  appendCallLog(account, {
    timestamp: now,
    method: 'POST',
    path: pathname,
    endpoint: 'search',
    requestBody: body,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return { body: responseBody, status: 200 };
}

// ── Get card ──────────────────────────────────────────────────────────────────

// Auto-create a card from just the cardId — used when the card is missing from this
// instance's memory (e.g. Vercel cold start or cross-instance request after _search).
function ensureCard(account: string, cardId: string, now: string) {
  let card = getCard(account, cardId);
  if (!card) {
    const { mockBalance } = getGcConfig(account);
    card = {
      id: cardId,
      redemptionCode: `DEMO-${cardId.slice(3, 9).toUpperCase()}`,
      caption: 'Demo Gift Card',
      initialBalance: mockBalance,
      expiryDate: '2099-12-31T00:00:00',
      owner: 'restored@demo.vtex',
      account,
      createdAt: now,
    };
    upsertCard(account, card);
  }
  return card;
}

export function handleGetCard(
  account: string,
  cardId: string,
  pathname: string,
  start: number
) {
  const now = new Date().toISOString();
  const card = ensureCard(account, cardId, now);

  const txs = listTransactionsForCard(account, cardId);
  const balance = computeBalance(card.initialBalance, txs);
  const body = buildCardResponse(card, balance);

  appendCallLog(account, {
    timestamp: now,
    method: 'GET',
    path: pathname,
    endpoint: 'get-card',
    responseBody: body,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return { body, status: 200 };
}

// ── Create card (optional endpoint VTEX may call) ─────────────────────────────

export function handleCreateCard(
  account: string,
  body: Record<string, unknown>,
  pathname: string,
  start: number
) {
  const { mockBalance } = getGcConfig(account);
  const now = new Date().toISOString();
  const cardId = `gc-${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  const card = {
    id: cardId,
    redemptionCode: `DEMO-${cardId.slice(3, 9).toUpperCase()}`,
    caption: (body.caption as string) || 'Demo Gift Card',
    initialBalance: (body.balance as number) || mockBalance,
    expiryDate: (body.expiryDate as string) || '2099-12-31T00:00:00',
    owner: (body.owner as string) || 'unknown@demo.com',
    account,
    createdAt: now,
  };

  upsertCard(account, card);

  const responseBody = buildCardResponse(card, card.initialBalance);
  appendCallLog(account, {
    timestamp: now,
    method: 'POST',
    path: pathname,
    endpoint: 'create-card',
    requestBody: body,
    responseBody,
    httpStatus: 201,
    durationMs: Date.now() - start,
  });

  return { body: responseBody, status: 201 };
}

// ── Create transaction ────────────────────────────────────────────────────────

export function handleCreateTransaction(
  account: string,
  cardId: string,
  body: GcTransactionRequest,
  pathname: string,
  start: number
) {
  const now = new Date().toISOString();
  ensureCard(account, cardId, now); // restore card if cross-instance cold start

  const txId = randomUUID();
  const tx = {
    id: txId,
    giftCardId: cardId,
    value: body.value ?? 0,
    description: body.description ?? 'Purchase',
    date: now,
    settlements: [],
    cancellations: [],
  };

  upsertTransaction(account, tx);

  const responseBody = {
    id: txId,
    giftcardId: cardId,
    value: tx.value,
    description: tx.description,
    date: tx.date,
  };

  appendCallLog(account, {
    timestamp: now,
    method: 'POST',
    path: pathname,
    endpoint: 'create-transaction',
    requestBody: body,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return { body: responseBody, status: 200 };
}

// ── List settlements ──────────────────────────────────────────────────────────

export function handleListSettlements(
  account: string,
  cardId: string,
  transactionId: string,
  pathname: string,
  start: number
) {
  const tx = getTransaction(account, transactionId);
  const now = new Date().toISOString();
  const body = tx ? tx.settlements : [];

  appendCallLog(account, {
    timestamp: now,
    method: 'GET',
    path: pathname,
    endpoint: 'list-settlements',
    responseBody: body,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return { body, status: 200 };
}

// ── Create settlement ─────────────────────────────────────────────────────────

export function handleCreateSettlement(
  account: string,
  cardId: string,
  transactionId: string,
  body: Record<string, unknown>,
  pathname: string,
  start: number
) {
  const now = new Date().toISOString();
  const op = { oid: randomUUID(), value: (body.value as number) ?? 0, date: now };
  const updated = appendSettlement(account, transactionId, op);

  // If transaction not found (cross-instance), still return a valid settlement response
  const responseBody = op;

  appendCallLog(account, {
    timestamp: now,
    method: 'POST',
    path: pathname,
    endpoint: 'settle',
    requestBody: body,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return { body: responseBody, status: 200 };
}

// ── List cancellations ────────────────────────────────────────────────────────

export function handleListCancellations(
  account: string,
  cardId: string,
  transactionId: string,
  pathname: string,
  start: number
) {
  const tx = getTransaction(account, transactionId);
  const now = new Date().toISOString();
  const body = tx ? tx.cancellations : [];

  appendCallLog(account, {
    timestamp: now,
    method: 'GET',
    path: pathname,
    endpoint: 'list-cancellations',
    responseBody: body,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return { body, status: 200 };
}

// ── Create cancellation ───────────────────────────────────────────────────────

export function handleCreateCancellation(
  account: string,
  cardId: string,
  transactionId: string,
  body: Record<string, unknown>,
  pathname: string,
  start: number
) {
  const now = new Date().toISOString();
  const op = { oid: randomUUID(), value: (body.value as number) ?? 0, date: now };
  const updated = appendCancellation(account, transactionId, op);

  // If transaction not found (cross-instance), still return a valid cancellation response
  const responseBody = op;

  appendCallLog(account, {
    timestamp: now,
    method: 'POST',
    path: pathname,
    endpoint: 'cancel',
    requestBody: body,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return { body: responseBody, status: 200 };
}

export { inferEndpoint };
