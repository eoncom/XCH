/**
 * Sentry/GlitchTip — Edge runtime init (middleware.ts + Edge route handlers).
 * Chargé via `frontend/instrumentation.ts` register() hook quand
 * NEXT_RUNTIME === 'edge'.
 *
 * On a très peu de surface Edge (notre middleware.ts gère uniquement la
 * génération du CSP nonce — pas de logique applicative qui produirait des
 * exceptions intéressantes). Init quand même par cohérence — si un
 * runtime crash arrive, on veut le voir.
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

  tracesSampleRate: 0,
  beforeSend: scrubEvent,
  beforeSendTransaction: () => null,
  sendDefaultPii: false,

  initialScope: {
    tags: { runtime: 'edge' },
  },
});
