import type { ErrorEvent, EventHint } from '@sentry/nextjs';

/**
 * Frontend GlitchTip scrubber — shared par les 3 runtimes
 * (sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts).
 *
 * Rôle :
 *  1. Filtrer les erreurs LÉGITIMES qui pollueraient le signal sans
 *     apporter d'info actionable (return null → drop event).
 *  2. Nettoyer le user context (drop email, garder seulement id UUID).
 *  3. Drop request body côté server pour ne pas exfiltrer de form data.
 *
 * Symétrique du scrubber backend `backend/src/common/observability/glitchtip/
 * scrubber.ts` (même décision XCH 2026-05-08 sur user.email), mais sans le
 * SECRET_REGEX_BUNDLE — le frontend ne manipule pas directement les colonnes
 * sensibles de la DB ; les regex anti-leak appartiennent au backend.
 */

/**
 * Erreurs légitimes qu'on NE veut PAS dans GlitchTip (handoff S8 §"Erreurs
 * légitimes à filtrer"). Pattern matchés sur error.name + error.message.
 *
 * Ajouter ici plutôt que de tagger côté call-site = single source of truth
 * pour les "non-events", facile à auditer.
 */
const IGNORED_ERROR_PATTERNS: readonly RegExp[] = [
  // Réseau côté browser : navigation user, pas une vraie erreur
  /^AbortError$/,
  /aborted/i,
  // Next.js HMR ou bundle stale après deploy
  /ChunkLoadError/,
  /Loading chunk \d+ failed/,
  /Loading CSS chunk/,
];

/**
 * Status HTTP attendus business — cf. ADR-021 (RBAC fail-closed) + S5 PR1
 * (deep-link 404 UX). Filtre côté client quand l'erreur est un Response
 * porteuse d'un status, OU côté server via tag `http.status_code`.
 */
const IGNORED_HTTP_STATUSES: ReadonlySet<number> = new Set([401, 403, 404]);

function isIgnoredError(error: unknown): boolean {
  if (!error) return false;

  // Erreur classique avec name/message
  if (typeof error === 'object' && error !== null) {
    const err = error as { name?: string; message?: string; status?: number; statusCode?: number };

    const name = err.name || '';
    const message = err.message || '';
    for (const re of IGNORED_ERROR_PATTERNS) {
      if (re.test(name) || re.test(message)) return true;
    }

    // Response-like : { status: 401 } ou { statusCode: 403 }
    const status = err.status ?? err.statusCode;
    if (typeof status === 'number' && IGNORED_HTTP_STATUSES.has(status)) return true;
  }

  return false;
}

export function scrubEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
  // 1. Filter legitimate errors
  if (hint?.originalException && isIgnoredError(hint.originalException)) {
    return null;
  }
  // Aussi : event.tags.http_status_code peut être set par l'instrumentation Next
  const httpStatusTag = event.tags?.['http.status_code'] ?? event.tags?.['status_code'];
  if (
    typeof httpStatusTag === 'number' &&
    IGNORED_HTTP_STATUSES.has(httpStatusTag)
  ) {
    return null;
  }

  // 2. user context : garder uniquement id (drop email entièrement, décision
  // XCH 2026-05-08).
  if (event.user) {
    const { id } = event.user;
    event.user = id ? { id } : undefined;
  }

  // 3. request context : drop cookies / auth headers / body (côté SSR Next
  // peut peupler request via le instrumentation hook).
  if (event.request) {
    if (event.request.cookies) delete event.request.cookies;
    if (event.request.headers) {
      const headers = event.request.headers as Record<string, string>;
      delete headers['authorization'];
      delete headers['cookie'];
      delete headers['x-csrf-token'];
    }
    if (event.request.data) delete event.request.data;
  }

  return event;
}
