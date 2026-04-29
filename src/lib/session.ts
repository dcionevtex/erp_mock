import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { IntegrationMode } from '@/types';

export interface SessionData {
  account?: string;
  environment?: string;
  appKey?: string;
  appToken?: string;
  integrationMode?: IntegrationMode;
  autoCommitFeed?: boolean;
  simulateErpFailure?: boolean;
}

// Fallback password is intentionally weak — valid only for local dev with no SESSION_SECRET set.
// Production deployments must set SESSION_SECRET to a random 32+ character string.
const sessionOptions = {
  password: process.env.SESSION_SECRET ?? 'demo-fallback-secret-set-SESSION_SECRET-in-prod',
  cookieName: 'vtex-erp-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
