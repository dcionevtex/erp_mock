import { randomUUID, createHash } from 'crypto';
import type { IdpConfig, IdpCode, IdpToken, IdpCallLogEntry } from '@/types/idp';

// Derive a stable secret from the account name — survives Vercel cold starts
// without needing a database. Reset via the dashboard regenerates and stores
// a random override in the in-memory map.
function stableSecret(account: string): string {
  return createHash('sha256').update(`vtex-idp-secret:${account}`).digest('hex').slice(0, 32);
}

declare global {
  var __idpConfig: Map<string, IdpConfig> | undefined;
  var __idpCodes: Map<string, Map<string, IdpCode>> | undefined;
  var __idpTokens: Map<string, Map<string, IdpToken>> | undefined;
  var __idpCallLog: Map<string, IdpCallLogEntry[]> | undefined;
}

function cfgMap(): Map<string, IdpConfig> {
  return (globalThis.__idpConfig ??= new Map());
}
function codesMap(): Map<string, Map<string, IdpCode>> {
  return (globalThis.__idpCodes ??= new Map());
}
function tokensMap(): Map<string, Map<string, IdpToken>> {
  return (globalThis.__idpTokens ??= new Map());
}
function callLogMap(): Map<string, IdpCallLogEntry[]> {
  return (globalThis.__idpCallLog ??= new Map());
}

function defaultConfig(account: string): IdpConfig {
  return {
    clientId: `idp-${account}`,
    clientSecret: stableSecret(account),
    users: [
      { email: `admin@${account}.com`, name: 'Admin User', password: 'demo123' },
      { email: `buyer@${account}.com`, name: 'Test Buyer', password: 'demo123' },
    ],
  };
}

// ── Config ──────────────────────────────────────────────────────────────────

export function getIdpConfig(account: string): IdpConfig {
  if (!cfgMap().has(account)) cfgMap().set(account, defaultConfig(account));
  return cfgMap().get(account)!;
}

export function setIdpUsers(account: string, users: IdpConfig['users']): IdpConfig {
  const cfg = getIdpConfig(account);
  const updated = { ...cfg, users };
  cfgMap().set(account, updated);
  return updated;
}

export function resetIdpSecret(account: string): IdpConfig {
  const cfg = getIdpConfig(account);
  const updated = { ...cfg, clientSecret: randomUUID().replace(/-/g, '') };
  cfgMap().set(account, updated);
  return updated;
}

// ── Auth codes ───────────────────────────────────────────────────────────────

export function issueCode(account: string, data: IdpCode): string {
  const map = codesMap();
  if (!map.has(account)) map.set(account, new Map());
  // >64 chars per VTEX spec (single-use authorization code)
  const code = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const accountCodes = map.get(account)!;
  accountCodes.set(code, data);
  // Prune expired codes
  const cutoff = Date.now() - 5 * 60 * 1000;
  accountCodes.forEach((v, k) => { if (v.createdAt < cutoff) accountCodes.delete(k); });
  return code;
}

export function consumeCode(account: string, code: string): IdpCode | null {
  const accountCodes = codesMap().get(account);
  if (!accountCodes) return null;
  const entry = accountCodes.get(code);
  if (!entry) return null;
  accountCodes.delete(code); // single-use
  if (Date.now() - entry.createdAt > 5 * 60 * 1000) return null; // expired
  return entry;
}

// ── Tokens ───────────────────────────────────────────────────────────────────
// Tokens are stateless: user info is encoded inside the token value itself.
// This survives Vercel cold starts — no memory lookup needed.

export function issueToken(_account: string, data: IdpToken): string {
  const payload = {
    email: data.email,
    name: data.name,
    userId: data.userId,
    exp: data.createdAt + 60 * 60 * 1000,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function lookupToken(_account: string, token: string): IdpToken | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const payload = JSON.parse(raw) as { email: string; name: string; userId: string; exp: number };
    if (Date.now() > payload.exp) return null;
    return { email: payload.email, name: payload.name, userId: payload.userId, createdAt: payload.exp - 60 * 60 * 1000 };
  } catch {
    return null;
  }
}

// ── Call log ─────────────────────────────────────────────────────────────────

export function appendIdpCall(
  account: string,
  entry: Omit<IdpCallLogEntry, 'id' | 'timestamp'>,
): IdpCallLogEntry {
  const map = callLogMap();
  if (!map.has(account)) map.set(account, []);
  const full: IdpCallLogEntry = {
    ...entry,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const log = map.get(account)!;
  log.push(full);
  if (log.length > 200) log.splice(0, log.length - 200);
  return full;
}

export function listIdpCalls(account: string): IdpCallLogEntry[] {
  return callLogMap().get(account) ?? [];
}

export function clearIdpCalls(account: string): void {
  callLogMap().set(account, []);
}
