// Catch-all route for Gift Card Provider Protocol endpoints.
// Handles all subpaths under /giftcards/ including _search, /{id}, /{id}/transactions, etc.
// Note: Next.js treats directories starting with _ as private, so _search cannot be a named route.
//
// Path dispatch:
//   POST  ['_search']                                   → search by customer email
//   GET   ['{id}']                                      → get card details
//   POST  ['{id}', 'transactions']                      → create debit transaction
//   GET   ['{id}', 'transactions', '{txId}', 'settlements']   → list settlements
//   POST  ['{id}', 'transactions', '{txId}', 'settlements']   → confirm settlement
//   GET   ['{id}', 'transactions', '{txId}', 'cancellations'] → list cancellations
//   POST  ['{id}', 'transactions', '{txId}', 'cancellations'] → process cancellation

import { NextResponse } from 'next/server';
import {
  handleSearch,
  handleGetCard,
  handleListTransactions,
  handleGetTransaction,
  handleGetAuthorization,
  handleCreateTransaction,
  handleListSettlements,
  handleCreateSettlement,
  handleListCancellations,
  handleCreateCancellation,
} from '@/lib/giftCardHandlers';
import type { GcSearchRequest, GcTransactionRequest } from '@/types/giftCard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ account: string; path: string[] }> };

export async function GET(request: Request, { params }: RouteContext) {
  const start = Date.now();
  const { account, path } = await params;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const serviceUrl = `${url.origin}/api/gift-card/${account}`;

  // GET /giftcards/{id}
  if (path.length === 1) {
    const r = handleGetCard(account, path[0], pathname, start, serviceUrl);
    return NextResponse.json(r.body, { status: r.status });
  }

  // GET /giftcards/{id}/transactions  — list all transactions for this card
  if (path.length === 2 && path[1] === 'transactions') {
    const r = handleListTransactions(account, path[0], pathname, start, serviceUrl);
    return NextResponse.json(r.body, { status: r.status });
  }

  // GET /giftcards/{id}/transactions/{txId}  — get single transaction
  if (path.length === 3 && path[1] === 'transactions') {
    const r = handleGetTransaction(account, path[0], path[2], pathname, start);
    return NextResponse.json(r.body, { status: r.status });
  }

  // GET /giftcards/{id}/transactions/{txId}/authorization
  if (path.length === 4 && path[1] === 'transactions' && path[3] === 'authorization') {
    const r = handleGetAuthorization(account, path[0], path[2], pathname, start);
    return NextResponse.json(r.body, { status: r.status });
  }

  // GET /giftcards/{id}/transactions/{txId}/settlements
  if (path.length === 4 && path[1] === 'transactions' && path[3] === 'settlements') {
    const r = handleListSettlements(account, path[0], path[2], pathname, start);
    return NextResponse.json(r.body, { status: r.status });
  }

  // GET /giftcards/{id}/transactions/{txId}/cancellations
  if (path.length === 4 && path[1] === 'transactions' && path[3] === 'cancellations') {
    const r = handleListCancellations(account, path[0], path[2], pathname, start);
    return NextResponse.json(r.body, { status: r.status });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: Request, { params }: RouteContext) {
  const start = Date.now();
  const { account, path } = await params;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const serviceUrl = `${url.origin}/api/gift-card/${account}`;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // some endpoints don't require a body
  }

  // POST /giftcards/_search
  if (path.length === 1 && path[0] === '_search') {
    const r = handleSearch(account, body as GcSearchRequest, pathname, start, serviceUrl);
    return NextResponse.json(r.body, { status: r.status });
  }

  // POST /giftcards/{id}/transactions
  if (path.length === 2 && path[1] === 'transactions') {
    const r = handleCreateTransaction(account, path[0], body as GcTransactionRequest, pathname, start, serviceUrl);
    return NextResponse.json(r.body, { status: r.status });
  }

  // POST /giftcards/{id}/transactions/{txId}/settlements
  if (path.length === 4 && path[1] === 'transactions' && path[3] === 'settlements') {
    const r = handleCreateSettlement(account, path[0], path[2], body, pathname, start);
    return NextResponse.json(r.body, { status: r.status });
  }

  // POST /giftcards/{id}/transactions/{txId}/cancellations
  if (path.length === 4 && path[1] === 'transactions' && path[3] === 'cancellations') {
    const r = handleCreateCancellation(account, path[0], path[2], body, pathname, start);
    return NextResponse.json(r.body, { status: r.status });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
