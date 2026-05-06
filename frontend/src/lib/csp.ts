/**
 * Build the Content-Security-Policy header value for the current request.
 *
 * The nonce is generated per-request by `frontend/src/middleware.ts`,
 * propagated via the `x-nonce` request header into the root layout, and
 * passed through to every `<Script nonce={...}>` Next.js renders. Inline
 * scripts and inline styles ARE rejected unless they carry that nonce —
 * which means we no longer need the legacy `'unsafe-inline'` source.
 *
 * Dev-mode escape hatch :
 *   Next.js dev mode injects HMR scripts that do not carry a nonce and
 *   need `eval` for fast-refresh. We keep `'unsafe-eval'` on script-src
 *   in dev only. styled-jsx is NOT used in this codebase (verified by
 *   grep at S9 PR17 audit), so we don't need a dev-only `'unsafe-inline'`
 *   on style-src — the strict nonce policy holds in dev too.
 */
export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "font-src 'self' data: https://fonts.gstatic.com",
    // Tile providers we serve directly to <img> (Leaflet TileLayer):
    //   - tile.openstreetmap.org (default light theme)
    //   - basemaps.cartocdn.com  (Dark Matter, used in dark theme — S6 PR2)
    // unpkg.com + raw.githubusercontent.com host the Leaflet marker icons.
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://unpkg.com https://raw.githubusercontent.com",
    // APIs called from the browser; same-origin + Nominatim direct call.
    "connect-src 'self' blob: https://nominatim.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}
