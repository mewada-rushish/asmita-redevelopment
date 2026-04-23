import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request) {
  const token = request.cookies.get('asmita_auth')?.value;
  const { pathname } = request.nextUrl;

  if (pathname === '/' || pathname === '/login') {
    if (token) return NextResponse.redirect(new URL('/dashboard', request.url));
    if (pathname === '/') return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  if (pathname.startsWith('/dashboard')) {
    if (!token) return NextResponse.redirect(new URL('/login', request.url));

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      const role = payload.role;

      // 1. User Management: Strictly Super Admin Only
      if (pathname.startsWith('/dashboard/users')) {
        if (role !== 'Super Admin') {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }

      // 2. Property Actions: Restricted to authorized roles only
      // Blocks "View Only" or any other unauthorized roles
      const propertyWritePaths = ['/dashboard/add', '/dashboard/edit'];
      const isPropertyWritePath = propertyWritePaths.some(path => pathname.startsWith(path));

      if (isPropertyWritePath) {
        const allowedRoles = ['Super Admin', 'Admin', 'CRM', 'Sales', 'Field Executive'];
        if (!allowedRoles.includes(role)) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }

    } catch (error) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('asmita_auth');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};