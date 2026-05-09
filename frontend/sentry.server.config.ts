/**
 * Sentry/GlitchTip — Node SSR runtime init.
 * Chargé via `frontend/instrumentation.ts` register() hook quand
 * NEXT_RUNTIME === 'nodejs' (App Router SSR + RSC + route handlers).
 *
 * Même DSN que le client (un seul projet GlitchTip `xch-frontend` côté UI),
 * la facette `runtime` permet de filtrer browser vs ssr.
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
  attachStacktrace: false,

  initialScope: {
    tags: { runtime: 'ssr' },
  },
});
