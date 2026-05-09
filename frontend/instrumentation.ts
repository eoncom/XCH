/**
 * Next 15 instrumentation hook (App Router root).
 *
 * Chargé UNE FOIS par runtime au boot du serveur Next. Sentry/GlitchTip
 * a besoin de ce hook pour s'attacher aux async hooks Node AVANT que les
 * libs instrumentées (http, pg, etc.) soient chargées.
 *
 * On NE wrap PAS `next.config.mjs` avec `withSentryConfig` (S8 décision) :
 *  - le webpack plugin Sentry peut entrer en conflit avec
 *    `config.externals['canvas'] = 'canvas'` requis pour Konva SSR ;
 *  - le seul vrai gain de `withSentryConfig` est l'upload auto des source
 *    maps en prod, qu'on peut faire out-of-band via `@sentry/cli` (voir
 *    item 8 backlog) si besoin.
 *
 * `register()` doit être async et retourner avant la fin du boot pour que
 * l'instrumentation soit en place quand la première requête arrive.
 *
 * Le client (browser) init n'est PAS pilotable depuis ici — il vit dans
 * `sentry.client.config.ts` (Next 15.1 — `instrumentation-client.ts` est
 * la convention 15.3+, pas encore disponible ici).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Server-side request error capture hook (Next 15+).
 * Sentry SDK fournit un helper pré-câblé qui marche pour App Router +
 * Pages Router + Route Handlers — on l'expose tel quel.
 */
export { captureRequestError as onRequestError } from '@sentry/nextjs';
