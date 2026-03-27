import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Only /login is public — all other routes require ADMIN role
const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Allow public paths through without auth check
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'))) {
    return NextResponse.next();
  }

  // Check for ADMIN role cookie
  const adminRole = request.cookies.get('felly_admin_role')?.value;
  if (adminRole !== 'ADMIN') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
