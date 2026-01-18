import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ⚠️ DISABLED - HTTP-only cookies with cross-subdomain don't work reliably in Next.js Edge Middleware
// Auth protection is handled client-side via useAuthStore + checkSession in layout.tsx

export function middleware(request: NextRequest) {
  // Allow all requests - auth is checked client-side
  return NextResponse.next();
}

export const config = {
  // Exclude: API routes, Next.js internals, static files (icons, manifest, favicon)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|.*\\.png|.*\\.ico|.*\\.svg|apple-touch-icon).*)'],
};
