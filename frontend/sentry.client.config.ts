/**
 * Sentry/GlitchTip — Browser SDK init.
 *
 * Pourquoi `sentry.client.config.ts` (et pas `instrumentation-client.ts`) :
 * Next 15.1 ne supporte pas encore `instrumentation-client.ts` (introduit en
 * 15.3+). `sentry.client.config.ts` est la convention officielle pour Next
 * 15.0–15.2 et n'est PAS deprecated sur ces versions.
 *
 * S8 / ADR-024 — DSN public (browser-reachable via NPM glitch.eoncom.io,
 * pas le réseau Docker interne). Si vide → no-op silencieux.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/observability/glitchtip-scrubber';

const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND;
const environment =
  process.env.NEXT_PUBLIC_GLITCHTIP_ENVIRONMENT ||
  process.env.NODE_ENV ||
  'development';
const release = process.env.NEXT_PUBLIC_GLITCHTIP_RELEASE;

Sentry.init({
  dsn,
  environment,
  release,

  // Pas de tracing (events seulement) — réduit le volume + évite l'overhead
  // d'instrumentation des fetch/XHR côté browser.
  tracesSampleRate: 0,
  // Pas de session replay (pas de besoin produit + risque PII).
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Filet anti-leak / filtre erreurs légitimes (cf. handoff S8).
  beforeSend: scrubEvent,
  beforeSendTransaction: () => null,

  // PII : SDK ne joint pas automatiquement IP, user-agent dérivé, etc.
  sendDefaultPii: false,

  // Erreurs déjà filtrées via beforeSend, mais Sentry expose aussi
  // `ignoreErrors` qui drop AVANT l'event (économise un beforeSend call).
  // On garde la liste minimale pour ne pas dupliquer la logique du scrubber.
  ignoreErrors: [
    // Erreurs réseau classiques côté browser
    'NetworkError',
    'Failed to fetch',
    'Load failed',
    // Extensions navigateur, pas notre code
    /chrome-extension:\/\//,
    /^moz-extension:\/\//,
  ],

  initialScope: {
    tags: { runtime: 'browser' },
  },
});
