# ADR-009 : Modele "Delegation d'abord"

Date : 2026-04-08
Statut : Accepte

## Contexte

XCH a ete concu comme une app mono-delegation (CDC Dec 2025). En v1.2 (Mars 2026), un systeme hierarchique 4 niveaux (Tenant > Division > Delegation > Site) avec scope polymorphique (`scopeType`/`scopeId`) a ete ajoute sans justification documentee. Le frontend ne l'exploite pas reellement, la complexite induite degrade la maintenabilite et ouvre des surfaces d'erreur dans le filtrage et les permissions.

## Decision

Recentrer XCH sur un modele **"delegation autonome"** avec couche globale legere de supervision :

```
Tenant (= instance XCH)
  +-- Config globale (SSO, SMTP, monitoring)
  +-- Super Admin (isSuperAdmin sur User)
  +-- Delegations (autonomes, isolees)
        +-- groupLabel? / groupColor? (tag UI)
        +-- Sites
        +-- Contacts (delegationId nullable = global)
        +-- BillingEntities (delegationId nullable = global)
        +-- Expenses (delegationId obligatoire)
        +-- NotificationConfig (delegationId nullable = global)
        +-- UserDelegation (userId + role local)
              +-- AccessGrant (additif, temporaire)
```

### Changements cles

1. **Suppression model Division** — remplace par `groupLabel`/`groupColor` sur Delegation (tag visuel sans impact fonctionnel)
2. **Suppression scope polymorphique** — `scopeType`/`scopeId` remplaces par `delegationId` FK + `siteId` FK optionnel
3. **UserDelegation remplace UserScope** — role local par delegation, source de verite pour permissions
4. **User.isSuperAdmin** — acces plateforme global, separe des roles locaux
5. **X-Delegation-Id header** — chaque requete operationnelle identifie la delegation active
6. **3 couches permissions** : JwtGuard > DelegationGuard > CasbinGuard (localRole) > AccessGrant

### Regles de coherence

- Si `siteId` renseigne, `site.delegationId` doit correspondre a `delegationId` (validation R1)
- Si `delegationId = null`, `siteId` doit etre `null` (objet global)
- Objets globaux (delegationId=null) crees/modifies uniquement par super admin
- Expense ne peut PAS etre global (delegationId obligatoire)

### Rattachement par entite

| Entite | delegationId | siteId | Global possible |
|--------|:---:|:---:|:---:|
| Site | FK obligatoire | -- | NON |
| Asset/Rack/Task/FloorPlan | via site | FK obligatoire | NON |
| Expense | FK obligatoire | FK optionnel | NON |
| BillingEntity | FK nullable | FK optionnel | OUI (super admin) |
| Contact | FK nullable | FK optionnel | OUI (super admin) |
| NotificationConfig | FK nullable | -- | OUI (super admin) |

## Consequences

Positives :
- Schema lisible (FK directes, plus de resolution polymorphique)
- Permissions simplifiees (role local = UserDelegation.role, plus de cascade Division)
- Frontend leger (DelegationContext + X-Delegation-Id, plus de hierarchy 4 niveaux)
- Seed et tests plus simples
- Moins de code mort (scope-resolution, scope-validation, UserScope, Division)

Negatives :
- Reset complet DB necessaire (donnees = demo, acceptable)
- Pas de groupement hierarchique fort (groupLabel est un tag, pas un container)
- Si besoin futur de hierarchy reelle, il faudra re-introduire un modele intermediaire

## Alternatives considerees

1. **Garder Division comme container fonctionnel** — Rejete car jamais utilise en pratique, ajoute de la complexite sans valeur
2. **Garder scopeType/scopeId polymorphique** — Rejete car source d'erreurs de filtrage, necessitait resolution complexe, mal supporte par les FK Prisma
3. **Migration incrementale** — Rejete car donnees = demo, un schema propre est plus fiable qu'une migration complexe
