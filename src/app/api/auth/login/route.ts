export const runtime = 'nodejs';

import { getSession } from '@/lib/session';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'vtex2024';

export async function POST(request: Request): Promise<Response> {
  let body: { password?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!body.password || body.password !== DEMO_PASSWORD) {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }

  const session = await getSession();
  session.authenticated = true;
  await session.save();

  return Response.json({ ok: true });
}
