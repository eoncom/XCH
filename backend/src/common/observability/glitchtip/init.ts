/**
 * GlitchTip / Sentry init — side-effect import.
 *
 * À importer en TOUT PREMIER dans `main.ts` (avant tout `import` de
 * NestJS / Prisma) pour que les async hooks et les patches d'instrumentation
 * Sentry s'attachent avant que les libs instrumentées (http, pg, etc.)
 * soient chargées.
 *
 * Pattern :
 *   // backend/src/main.ts (ligne 1)
 *   import './common/observability/glitchtip/init';
 *   import { NestFactory } from '@nestjs/core';
 *   ...
 *
 * Si `GLITCHTIP_DSN_BACKEND` n'est pas set (dev local sans GlitchTip),
 * `Sentry.init({ dsn: undefined })` reste un no-op : SDK initialisé,
 * `captureException` ne lève pas, mais aucun event n'est envoyé. Pas besoin
 * de wrapper `if (process.env.GLITCHTIP_DSN_BACKEND)` côté call sites.
 */
import * as Sentry from '@sentry/node';
import { scrubEvent } from './scrubber';

const dsn = process.env.GLITCHTIP_DSN_BACKEND;
const environment = process.env.GLITCHTIP_ENVIRONMENT || process.env.NODE_ENV || 'development';
const release = process.env.GLITCHTIP_RELEASE; // souvent injecté par CI (git sha ou tag)

Sentry.init({
  dsn,
  environment,
  release,

  // Pas de tracing (events seulement). Réduit drastiquement le volume
  // d'ingestion côté GlitchTip + évite un coupling supplémentaire avec
  // l'instrumentation HTTP/DB.
  tracesSampleRate: 0,

  // Les profiles sont disabled de toute façon sans le profiling integration ;
  // explicite pour qu'un futur dev ne réactive pas par accident.
  profilesSampleRate: 0,

  // Filet anti-leak runtime — voir `scrubber.ts` pour la rationale.
  beforeSend: scrubEvent,

  // Pas de capture des transactions / spans non plus.
  beforeSendTransaction: () => null,

  // Désactive l'attachStacktrace sur les message events — on capture
  // explicitement via `Sentry.captureException(err)` dans le filter, où
  // la vraie stack est déjà attachée à l'erreur.
  attachStacktrace: false,

  // PII sensitive : default-pii OFF (Sentry SDK n'inclut pas request body,
  // headers, cookies, IP automatiquement). Le scrubber `beforeSend` est un
  // 2e niveau de défense en cas d'event capture custom.
  sendDefaultPii: false,

  // Tag toutes les events avec le mode (api / worker) — permet de filtrer
  // côté UI GlitchTip sans avoir 2 projets distincts pour le même backend.
  initialScope: {
    tags: {
      mode:
        process.argv.includes('--worker') || (process.env.XCH_MODE || '').toLowerCase() === 'worker'
          ? 'worker'
          : 'api',
    },
  },
});
