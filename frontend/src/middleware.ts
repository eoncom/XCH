import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildCsp } from './lib/csp';

// Middleware checks accessToken cookie to protect authenticated routes
// AND injects a per-request CSP nonce (S9 PR17). The nonce is:
//   - generated below via crypto.randomUUID() (Edge runtime Web Crypto)
//   - propagated as the `x-nonce` request header so the root layout
//     can read it via headers().get('x-nonce') and pass it to every
//     <Script nonce={...}> Next.js renders
//   - referenced by the Content-Security-Policy header so inline
//     <script> / <style> without that exact nonce are rejected
//     by the browser
//
// The matcher excludes static assets, API routes, and the PWA manifest
// — none of those serve HTML, so they have no use for the CSP and
// running middleware on them adds latency for no benefit.

function buildAuthRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Allow public routes (no auth check)
  const publicRoutes = ['/login', '/register', '/setup'];
  if (publicRoutes.includes(pathname)) {
    return null;
  }

  // Check if user is authenticated via accessToken cookie
  const accessToken = request.cookies.get('accessToken');
  if (accessToken) {
    return null;
  }

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
    return null;
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

// Détecte si la requête est arrivée en HTTPS. Derrière nginx (intégré ou
// externe), le proxy pose `X-Forwarded-Proto: $scheme` ; en accès direct
// (mode dev), on se rabat sur le protocole de l'URL. Utilisé pour ne
// PAS émettre `upgrade-insecure-requests` sur un déploiement HTTP pur
// (IP sans TLS) — voir buildCsp().
function isSecureRequest(request: NextRequest): boolean {
  const xfProto = request.headers.get('x-forwarded-proto');
  if (xfProto) {
    return xfProto.split(',')[0].trim() === 'https';
  }
  return request.nextUrl.protocol === 'https:';
}

export function middleware(request: NextRequest) {
  // Generate the per-request nonce (32 hex chars, ~128 bits of entropy).
  // crypto.randomUUID() is part of the Web Crypto API exposed to Edge
  // middleware; the dashes are stripped so the value is CSP-safe.
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const secureTransport = isSecureRequest(request);

  // Auth gate first — if the caller must be redirected to /login, do so
  // immediately. We still attach the CSP header to the redirect so the
  // browser remains in strict mode while it follows the 307.
  const redirect = buildAuthRedirect(request);
  if (redirect) {
    redirect.headers.set('Content-Security-Policy', buildCsp(nonce, secureTransport));
    return redirect;
  }

  // Forward the nonce to the rest of the request pipeline as a request
  // header so server components (notably layout.tsx) can read it via
  // `headers().get('x-nonce')` and propagate it to <Script nonce={...}>.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', buildCsp(nonce, secureTransport));
  return response;
}

export const config = {
  // Match every HTML route. Exclude:
  //   - api/*           (proxied to backend, no HTML body)
  //   - _next/static/*  (static JS/CSS chunks — already served with their
  //                      own headers, no inline scripts)
  //   - _next/image/*   (image optimisation pipeline)
  //   - manifest.json   (PWA manifest, application/json)
  //   - favicon.ico + image / font assets in /public served by name
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.(?:png|ico|svg|jpg|jpeg|webp|gif|woff|woff2|ttf)).*)',
  ],
};
