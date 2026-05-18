import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request) {
  const token = request.cookies.get('asmita_auth')?.value;
  const { pathname } = request.nextUrl;
  
  // Force lowercase to prevent case-sensitive URL bypasses (e.g., /dashboard/Partners)
  const path = pathname.toLowerCase();

  if (path === '/' || path === '/login') {
    if (token) return NextResponse.redirect(new URL('/dashboard', request.url));
    if (path === '/') return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  if (path.startsWith('/dashboard')) {
    if (!token) return NextResponse.redirect(new URL('/login', request.url));

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      
      // Normalize role to lowercase, trim spaces, and check nested payload.user structure safely
      const role = (payload.role || payload.user?.role || '').toLowerCase().trim();

      if (path.startsWith('/dashboard/users')) {
        if (role !== 'super admin') {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }

      if (path.startsWith('/dashboard/partners')) {
        const allowedRoles = ['super admin', 'admin', 'crm', 'sales'];
        if (!allowedRoles.includes(role)) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }

      const propertyWritePaths = ['/dashboard/add', '/dashboard/edit'];
      const isPropertyWritePath = propertyWritePaths.some(p => path.startsWith(p));

      if (isPropertyWritePath) {
        const allowedRoles = ['super admin', 'admin', 'crm', 'sales', 'field executive'];
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