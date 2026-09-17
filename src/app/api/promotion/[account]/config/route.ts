import { NextResponse } from 'next/server';
import {
  getPromotionConfig,
  setPromotionScenario,
  setAuthHeaderName,
  setAuthHeaderValue,
  regenerateSecret,
  addPromotionRule,
  updatePromotionRule,
  removePromotionRule,
  listPromotionCallLog,
  clearPromotionCallLog,
} from '@/lib/promotionStore';
import type { PromotionScenario, PromotionDiscountType } from '@/types/promotion';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const config = getPromotionConfig(account);
  const calls = listPromotionCallLog(account);
  return NextResponse.json({ config, calls });
}

type ConfigPatch = {
  scenario?: PromotionScenario;
  authHeaderName?: string;
  authHeaderValue?: string;
  regenerateSecret?: boolean;
  addRule?: { name: string; description?: string; type: PromotionDiscountType; value: number; couponCode?: string | null };
  updateRule?: { id: string; name?: string; description?: string; type?: PromotionDiscountType; value?: number; couponCode?: string | null; active?: boolean };
  removeRule?: { id: string };
  clear?: boolean;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const body = (await request.json()) as ConfigPatch;

  if (body.clear) {
    clearPromotionCallLog(account);
    return NextResponse.json({ ok: true, config: getPromotionConfig(account) });
  }

  if (body.scenario) setPromotionScenario(account, body.scenario);
  if (body.authHeaderName !== undefined) setAuthHeaderName(account, body.authHeaderName);
  if (body.authHeaderValue !== undefined) setAuthHeaderValue(account, body.authHeaderValue);
  if (body.regenerateSecret) regenerateSecret(account);
  if (body.addRule) {
    addPromotionRule(account, {
      name: body.addRule.name,
      description: body.addRule.description ?? '',
      type: body.addRule.type,
      value: body.addRule.value,
      couponCode: body.addRule.couponCode ?? null,
    });
  }
  if (body.updateRule) {
    const { id, ...patch } = body.updateRule;
    updatePromotionRule(account, id, patch);
  }
  if (body.removeRule) removePromotionRule(account, body.removeRule.id);

  return NextResponse.json({ ok: true, config: getPromotionConfig(account) });
}
