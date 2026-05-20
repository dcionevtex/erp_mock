import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Always public: VTEX hook receiver, health check, NextAuth internals
  const ALWAYS_PUBLIC = ['/api/vtex/hook', '/api/health', '/api/auth'];
  if (ALWAYS_PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Other API routes are invoked from the authenticated UI — no redirect needed
  if (pathname.startsWith('/api/')) return NextResponse.next();

  // Redirect authenticated users away from the login page
  if (req.auth && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Redirect unauthenticated users to login (no callbackUrl — always land on launcher after auth)
  if (!req.auth && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
