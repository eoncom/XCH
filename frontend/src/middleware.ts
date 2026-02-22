import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware checks accessToken cookie to protect authenticated routes

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  const publicRoutes = ['/login', '/register', '/setup'];
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check if user is authenticated via accessToken cookie
  const accessToken = request.cookies.get('accessToken');

  // If no access token, redirect to login
  if (!accessToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated, allow request
  return NextResponse.next();
}

export const config = {
  // Exclude: API routes, Next.js internals, static files (icons, manifest, favicon)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|.*\\.png|.*\\.ico|.*\\.svg|apple-touch-icon).*)'],
};
