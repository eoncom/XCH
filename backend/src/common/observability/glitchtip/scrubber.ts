import type { Event, EventHint } from '@sentry/node';

/**
 * Anti-leak regex bundle — single source of truth for "must NEVER end up
 * in an exported wire payload" patterns.
 *
 * Origin : initialement gravée dans `backend/src/modules/auth/dto-shape.spec.ts`
 * (S9 PR #15 anti-leak discipline). Déplacée ici en S8 pour permettre la
 * réutilisation par le scrubber Sentry/GlitchTip — le spec ré-importe ce
 * bundle pour rester aligné avec le filet de sécurité runtime.
 *
 * Couverture :
 *  - Field names sensibles (passwordHash, totpSecret, totpBackupCodes,
 *    inviteToken, resetToken, failedLoginAttempts, lockedUntil, externalId)
 *  - Valeurs canoniques utilisées dans les fixtures (bcrypt prefix, TOTP
 *    base32 sample, hex tokens, OIDC sub) — utiles pour catcher les leaks
 *    par valeur quand un autre champ porte le secret.
 */
export const SECRET_REGEX_BUNDLE: readonly RegExp[] = [
  /passwordHash/,
  /\$2[aby]\$/,                       // bcrypt prefix
  /totpSecret/,
  /JBSWY3DPEHPK3PXP/,                 // example TOTP base32 value
  /totpBackupCodes/,
  /inviteToken/,
  /resetToken/,
  /a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6/, // sample invite token value
  /f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5/, // sample reset token value
  /failedLoginAttempts/,
  /lockedUntil/,
  /externalId/,
  /oidc-sub-abc123/,
];

/**
 * Sentry `beforeSend` hook — drops events qui contiennent un pattern du
 * bundle (fail-closed) et nettoie le user context conformément à la
 * décision XCH (drop user.email entièrement, garder seulement user.id UUID).
 *
 * Pourquoi drop entièrement plutôt que redact in-place :
 *  - Un match du bundle dans un event est un signal qu'un secret a fuité
 *    dans un message d'erreur ou une stack — la valeur exacte peut être
 *    ailleurs dans la même structure (extra, contexts, breadcrumbs). Drop
 *    full event évite la fuite résiduelle qu'un redact partiel pourrait
 *    laisser passer.
 *  - L'event reste consultable dans les logs applicatifs (qui ont leur
 *    propre scrubbing). On perd uniquement la centralisation Sentry, pas
 *    la visibilité.
 *
 * Le hook reste un FILET. La discipline première = ne PAS mettre de secrets
 * dans les contextes d'erreur (DTO discipline S9, structured logging avec
 * field allow-list).
 */
export function scrubEvent(event: Event, _hint?: EventHint): Event | null {
  // 1. Fail-closed sur le bundle anti-leak.
  let serialized: string;
  try {
    serialized = JSON.stringify(event);
  } catch {
    // Event non-sérialisable (cycle, BigInt) → on drop par sécurité plutôt
    // que d'envoyer un truncated qui pourrait masquer un leak.
    return null;
  }
  for (const re of SECRET_REGEX_BUNDLE) {
    if (re.test(serialized)) {
      return null;
    }
  }

  // 2. Nettoyage user context — garder uniquement `id` (UUID).
  // Décision user 2026-05-08 : pas de hash email, pas d'email tout court.
  if (event.user) {
    const { id } = event.user;
    event.user = id ? { id } : undefined;
  }

  // 3. Nettoyage request context : drop cookies, headers d'auth, et tout
  // body éventuel qui pourrait contenir un password de login form.
  if (event.request) {
    if (event.request.cookies) delete event.request.cookies;
    if (event.request.headers) {
      const headers = event.request.headers as Record<string, string>;
      delete headers['authorization'];
      delete headers['cookie'];
      delete headers['x-csrf-token'];
    }
    // Body : on ne sait pas distinguer un champ sensible d'un benign
    // sans un parser sémantique → drop entirely. La stack trace + l'URL
    // suffisent pour diagnostiquer 95% des cas.
    if (event.request.data) delete event.request.data;
  }

  return event;
}
