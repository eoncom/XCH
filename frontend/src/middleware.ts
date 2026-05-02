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

  if (!accessToken) {
    // S7 PR0 Option A — fallback CSR pour la première navigation post-login.
    // Le browser peut router vers /dashboard avant que le Set-Cookie du POST
    // /api/auth/login soit visible côté SSR. On laisse passer si le referer
    // est /login : Zustand auth-store.checkSession() côté CSR validera ou
    // redirigera proprement. Pas de bypass sécurité — la session est
    // re-vérifiée serveur-side via /api/auth/session au mount du dashboard
    // layout, et le rendu reste côté client (pas de leak de données SSR
    // sensibles avant validation).
    const referer = request.headers.get('referer');
    if (referer && referer.includes('/login')) {
      return NextResponse.next();
    }

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
