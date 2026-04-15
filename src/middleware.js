import { NextResponse } from 'next/server';

export function middleware(request) {
  const authCookie = request.cookies.get('asmita_auth');
  const isAuthenticated = authCookie?.value === 'true';
  const path = request.nextUrl.pathname;

  if (path.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (path === '/login' || path === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else if (path === '/') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};