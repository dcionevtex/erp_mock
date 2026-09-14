import { NextResponse } from 'next/server';
import {
  getTaxConfig,
  setTaxScenario,
  setMarketplaceResponsible,
  regenerateSecret,
  addTaxRule,
  updateTaxRule,
  removeTaxRule,
  listTaxCallLog,
  clearTaxCallLog,
} from '@/lib/taxStore';
import type { TaxScenario } from '@/types/tax';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ account: string }> },
) {
  const { account } = await params;
  const config = getTaxConfig(account);
  const calls = listTaxCallLog(account);
  return NextResponse.json({ config, calls });
}

type ConfigPatch = {
  scenario?: TaxScenario;
  isMarketplaceResponsibleForTaxes?: boolean;
  regenerateSecret?: boolean;
  addRule?: { name: string; description?: string; percentage: number };
  updateRule?: { id: string; name?: string; description?: string; percentage?: number; active?: boolean };
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
    clearTaxCallLog(account);
    return NextResponse.json({ ok: true, config: getTaxConfig(account) });
  }

  if (body.scenario) setTaxScenario(account, body.scenario);
  if (body.isMarketplaceResponsibleForTaxes !== undefined) {
    setMarketplaceResponsible(account, body.isMarketplaceResponsibleForTaxes);
  }
  if (body.regenerateSecret) regenerateSecret(account);
  if (body.addRule) {
    addTaxRule(account, {
      name: body.addRule.name,
      description: body.addRule.description ?? '',
      percentage: body.addRule.percentage,
    });
  }
  if (body.updateRule) {
    const { id, ...patch } = body.updateRule;
    updateTaxRule(account, id, patch);
  }
  if (body.removeRule) removeTaxRule(account, body.removeRule.id);

  return NextResponse.json({ ok: true, config: getTaxConfig(account) });
}
