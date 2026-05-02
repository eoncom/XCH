import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Refuse l'accès aux endpoints décorés tant que NODE_ENV vaut 'production'.
 *
 * S7 PR0 — utilisé par les endpoints de reset scoped par domaine
 * (POST /api/seed/reset/:domain) pour empêcher leur exécution accidentelle
 * sur l'environnement pilote. Combine avec @RequireManage côté contrôleur
 * pour une défense en profondeur (rôle + environnement).
 */
@Injectable()
export class TestEnvOnlyGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Endpoint réservé aux environnements de test (NODE_ENV != production).',
      );
    }
    return true;
  }
}
