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
/**
 * Extrait l'origin (`scheme://host[:port]`) du DSN GlitchTip frontend pour
 * l'autoriser dans `connect-src`. Source unique : on parse depuis
 * `NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND` plutôt que d'avoir une env var
 * dédiée à maintenir en parallèle (décision S8 / item 5).
 *
 * Si la var n'est pas set ou est malformée, retourne `null` → la CSP est
 * inchangée et le browser SDK (qui sera no-op faute de DSN de toute façon)
 * n'a rien à atteindre. Pas de bruit en dev local.
 */
function glitchtipIngestOrigin(): string | null {
  const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND;
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    // Format Sentry/GlitchTip : `<scheme>://<key>@<host>[:<port>]/<id>`.
    // `URL.origin` ignore le user-info → exactement ce qu'on veut autoriser.
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * @param secureTransport — la requête est-elle servie en HTTPS (directement
 *   ou via un proxy qui pose `X-Forwarded-Proto`) ? `upgrade-insecure-requests`
 *   n'est émis QUE dans ce cas : sur un déploiement HTTP pur (IP sans TLS,
 *   install on-prem sans domaine), cette directive force le navigateur à
 *   réécrire tous les assets `_next/static` en https:// alors que rien
 *   n'écoute sur 443 → ERR_CONNECTION_CLOSED, page figée.
 */
export function buildCsp(nonce: string, secureTransport: boolean = true): string {
  const isDev = process.env.NODE_ENV === 'development';
  const ingestOrigin = glitchtipIngestOrigin();
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
    // APIs called from the browser :
    //   - 'self'                                    (same-origin, via NPM)
    //   - blob:                                     (uploads/exports)
    //   - https://nominatim.openstreetmap.org       (geocoding direct)
    //   - <ingestOrigin> (S8)                       (GlitchTip events POST)
    `connect-src 'self' blob: https://nominatim.openstreetmap.org${ingestOrigin ? ` ${ingestOrigin}` : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (secureTransport) {
    directives.push('upgrade-insecure-requests');
  }
  return directives.join('; ');
}
