import { ApiError } from './api-client';

const HTTP_FALLBACKS: Record<number, string> = {
  400: 'Requête invalide',
  401: 'Session expirée, reconnectez-vous',
  403: "Accès refusé pour cette opération",
  404: 'Ressource introuvable',
  409: 'Conflit avec l\'état actuel des données',
  413: 'Fichier trop volumineux',
  422: 'Données invalides',
  429: 'Trop de requêtes, patientez un instant',
  500: 'Erreur serveur, réessayez dans un instant',
  502: 'Service temporairement indisponible',
  503: 'Service temporairement indisponible',
  504: 'Délai serveur dépassé',
};

/**
 * Translate any error into a user-facing French message.
 * Trusts ApiError.message when the server provided one (validation messages
 * from class-validator are already FR), falls back to HTTP code mapping
 * otherwise. For network/timeout/aborted errors, uses kind-specific copy.
 */
export function mapApiErrorToFr(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'timeout') return 'Délai dépassé, vérifiez votre connexion';
    if (err.kind === 'network') return 'Connexion réseau indisponible';
    if (err.kind === 'aborted') return 'Opération annulée';

    // Server-provided message wins (NestJS validation, business errors).
    if (err.message && err.message !== `HTTP ${err.status}`) return err.message;

    return HTTP_FALLBACKS[err.status] ?? `Erreur serveur (code ${err.status})`;
  }

  if (err instanceof Error) return err.message || 'Erreur inconnue';
  return 'Erreur inconnue';
}
