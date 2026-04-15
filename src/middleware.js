import { NextResponse } from 'next/server';

export function middleware(request) {
  // 1. Get the cookie
  const authCookie = request.cookies.get('asmita_auth');
  
  // 2. ME FIX: Check if the cookie EXISTS (since it's a JWT, not the word "true")
  const isAuthenticated = !!authCookie; 
  
  const path = request.nextUrl.pathname;

  // 3. Protect the Dashboard
  if (path.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      console.log("Middleware: No token found, redirecting to /login");
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // 4. Redirect logged-in users away from Login/Root
  if (path === '/login' || path === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else if (path === '/') {
      // If not logged in and on root, go to login
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Matches all paths except static files and API routes
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};