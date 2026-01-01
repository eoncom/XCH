# ADR-004 : RBAC/ABAC avec Casbin

Date : 2025-12-31
Statut : Accepté

## Contexte

XCH nécessite un système de permissions robuste :
- **4 rôles** : Admin, Manager, Technicien, Viewer
- **Permissions granulaires** : Par ressource (sites, assets, racks, tasks, users) et action (create, read, update, delete)
- **Multi-tenant** : Isolation permissions par tenant
- **Évolutivité** : Possibilité ABAC (Attribute-Based Access Control) futur

Contraintes :
- Séparation logique permissions du code métier
- Audit trail modifications permissions
- Performance (pas de latence sur chaque requête)
- Maintenabilité (pas de code spaghetti if/else)

## Décision

**Moteur de permissions Casbin** avec modèle RBAC étendu multi-tenant

### Stack

- **Casbin** : Policy-based access control library
- **Adapter** : `@casbin/typeorm-adapter` (persistence PostgreSQL)
- **Intégration** : NestJS Guard custom

### Modèle Casbin (RBAC)

Fichier `casbin_model.conf` :

```conf
[request_definition]
r = sub, obj, act, tenant

[policy_definition]
p = sub, obj, act, tenant

[role_definition]
g = _, _, _  # (user, role, tenant)

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub, r.tenant) && r.obj == p.obj && r.act == p.act && r.tenant == p.tenant
```

**Explication** :
- `r` (request) : `(userId, resource, action, tenantId)`
- `p` (policy) : `(role, resource, action, tenant)` → Permissions par rôle
- `g` (grouping) : `(userId, role, tenantId)` → Assignation user ↔ role
- `m` (matcher) : Vérifie user a le rôle ET le rôle a la permission

### Policies initiales

Fichier `casbin_policy.csv` (seed initial) :

```csv
# Format: p, role, resource, action, tenant

# ADMIN - Accès complet
p, admin, sites, create, *
p, admin, sites, read, *
p, admin, sites, update, *
p, admin, sites, delete, *
p, admin, assets, create, *
p, admin, assets, read, *
p, admin, assets, update, *
p, admin, assets, delete, *
p, admin, racks, create, *
p, admin, racks, read, *
p, admin, racks, update, *
p, admin, racks, delete, *
p, admin, racks, manage_equipment, *
p, admin, plans, upload, *
p, admin, plans, view, *
p, admin, plans, edit_pins, *
p, admin, plans, delete, *
p, admin, tasks, create, *
p, admin, tasks, read, *
p, admin, tasks, update, *
p, admin, tasks, delete, *
p, admin, tasks, assign, *
p, admin, users, create, *
p, admin, users, read, *
p, admin, users, update, *
p, admin, users, delete, *
p, admin, users, change_role, *
p, admin, integrations, configure, *
p, admin, audit, read, *

# MANAGER - Lecture complète + gestion tâches
p, manager, sites, read, *
p, manager, assets, read, *
p, manager, racks, read, *
p, manager, plans, view, *
p, manager, tasks, create, *
p, manager, tasks, read, *
p, manager, tasks, update, *
p, manager, tasks, assign, *
p, manager, users, read, *
p, manager, audit, read, *

# TECHNICIEN - CRUD opérationnel
p, technicien, sites, create, *
p, technicien, sites, read, *
p, technicien, sites, update, *
p, technicien, assets, create, *
p, technicien, assets, read, *
p, technicien, assets, update, *
p, technicien, assets, delete, *
p, technicien, racks, create, *
p, technicien, racks, read, *
p, technicien, racks, update, *
p, technicien, racks, manage_equipment, *
p, technicien, plans, upload, *
p, technicien, plans, view, *
p, technicien, plans, edit_pins, *
p, technicien, tasks, create, *
p, technicien, tasks, read, *
p, technicien, tasks, update, *

# VIEWER - Lecture seule
p, viewer, sites, read, *
p, viewer, assets, read, *
p, viewer, racks, read, *
p, viewer, plans, view, *
p, viewer, tasks, read, *
```

### NestJS Guard

```typescript
// casbin.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Enforcer } from 'casbin';

@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private enforcer: Enforcer,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // From JwtAuthGuard

    // Extract resource & action from decorators
    const resource = this.reflector.get<string>('resource', context.getHandler());
    const action = this.reflector.get<string>('action', context.getHandler());

    if (!resource || !action) {
      return true; // No policy defined, allow (or deny by default)
    }

    // Enforce policy
    const allowed = await this.enforcer.enforce(
      user.id,
      resource,
      action,
      user.tenantId,
    );

    return allowed;
  }
}
```

### Decorators

```typescript
// permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const Resource = (resource: string) => SetMetadata('resource', resource);
export const Action = (action: string) => SetMetadata('action', action);
```

### Usage dans controllers

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CasbinGuard } from './guards/casbin.guard';
import { Resource, Action } from './decorators/permissions.decorator';

@Controller('sites')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class SitesController {

  @Post()
  @Resource('sites') @Action('create')
  async create(@Body() dto: CreateSiteDto) {
    // Accessible seulement si user a permission sites:create
    return this.sitesService.create(dto);
  }

  @Get()
  @Resource('sites') @Action('read')
  async findAll() {
    // Accessible si user a permission sites:read
    return this.sitesService.findAll();
  }

  @Patch(':id')
  @Resource('sites') @Action('update')
  async update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    // Accessible si user a permission sites:update
    return this.sitesService.update(id, dto);
  }

  @Delete(':id')
  @Resource('sites') @Action('delete')
  async remove(@Param('id') id: string) {
    // Accessible si user a permission sites:delete
    return this.sitesService.remove(id);
  }
}
```

### Assignation rôles users

```typescript
// Au moment création user ou changement rôle
await this.enforcer.addGroupingPolicy(userId, role, tenantId);

// Exemple:
await this.enforcer.addGroupingPolicy('user_123', 'admin', 'tenant_abc');
await this.enforcer.addGroupingPolicy('user_456', 'technicien', 'tenant_abc');
```

### UI Gestion permissions (Admin)

Page "Paramètres > Permissions" :

**Matrice rôles × ressources** :
```
                sites           assets          racks           tasks           users
              C R U D         C R U D         C R U D M       C R U D A       C R U D R
admin         ✓ ✓ ✓ ✓         ✓ ✓ ✓ ✓         ✓ ✓ ✓ ✓ ✓       ✓ ✓ ✓ ✓ ✓       ✓ ✓ ✓ ✓ ✓
manager       - ✓ - -         - ✓ - -         - ✓ - - -       ✓ ✓ ✓ - ✓       - ✓ - - -
technicien    ✓ ✓ ✓ -         ✓ ✓ ✓ ✓         ✓ ✓ ✓ - ✓       ✓ ✓ ✓ - -       - - - - -
viewer        - ✓ - -         - ✓ - -         - ✓ - - -       - ✓ - - -       - - - - -
```

Légende : C=Create, R=Read, U=Update, D=Delete, M=Manage equipment, A=Assign, R=Change role

**Édition policies** :
- Toggle checkboxes pour modifier permissions
- Bouton "Sauvegarder" → `enforcer.addPolicy()` / `enforcer.removePolicy()`
- Validation : Admin ne peut pas se retirer ses propres permissions

**Gestion utilisateurs** :
- Liste users avec rôle actuel
- Dropdown changement rôle
- Confirmation si promotion/dégradation

## Conséquences

### Positives

- **Séparation of Concerns** : Logique permissions isolée du code métier
- **Déclaratif** : Policies lisibles, auditables
- **Performance** : Casbin cache policies en mémoire, évaluation rapide (<1ms)
- **Persistance** : Policies stockées DB, synchronisées entre instances
- **Audit** : Changements policies tracés (via triggers DB ou app-level)
- **Extensibilité ABAC** : Évolution facile vers permissions contextuelles

### Négatives

- **Courbe apprentissage** : Syntaxe Casbin (model, policies) à maîtriser
- **Debugging** : Erreurs permissions parfois opaques (quel matcher échoue ?)
- **Dépendance** : Librairie externe à maintenir

## Alternatives considérées

### Hard-coded permissions (if/else)
- **Rejetée** : Code spaghetti, non maintenable
- Changements permissions = déploiement code
- Pas d'audit trail

### CASL (isomorphic authorization)
- **Rejetée** : Moins mature que Casbin pour backend
- Excellente option si logique permissions frontend aussi
- Casbin plus performant côté serveur

### Authorization-as-a-Service (Ory Keto, AuthZed)
- **Rejetée** : Over-engineering pour MVP
- Dépendance service externe
- Coûts supplémentaires

## Extensions futures (ABAC)

Exemple : User peut modifier seulement ses propres tâches

**Modèle étendu** :
```conf
[matchers]
m = g(r.sub, p.sub, r.tenant) && r.obj == p.obj && r.act == p.act && r.tenant == p.tenant && (p.act != 'update' || r.ownerId == r.sub)
```

**Request étendu** :
```typescript
await this.enforcer.enforce(
  user.id,
  'tasks',
  'update',
  user.tenantId,
  task.assignedTo // ownerId
);
```

## Persistence

Casbin policies stockées dans table PostgreSQL :

```sql
CREATE TABLE casbin_rule (
  id SERIAL PRIMARY KEY,
  ptype VARCHAR(100),  -- 'p' ou 'g'
  v0 VARCHAR(100),     -- subject (role ou userId)
  v1 VARCHAR(100),     -- object (resource)
  v2 VARCHAR(100),     -- action
  v3 VARCHAR(100),     -- tenant
  v4 VARCHAR(100),
  v5 VARCHAR(100)
);

CREATE INDEX idx_casbin_rule ON casbin_rule (ptype, v0, v1, v2, v3);
```

Synchronisation automatique via TypeORM adapter.

## Monitoring

Logs enforcement :
```typescript
const allowed = await this.enforcer.enforce(...);
this.logger.debug(`Casbin: ${user.email} ${allowed ? 'ALLOW' : 'DENY'} ${action} on ${resource}`);
```

Métriques (Prometheus) :
- Temps évaluation policies
- Taux allow/deny par endpoint
- Cache hit rate

## Notes

Décision validée. Casbin recommandé pour RBAC complexe multi-tenant avec évolutivité ABAC.
Architecture prête pour permissions granulaires (ex: "technicien peut modifier équipements de son chantier seulement").
