# ADR-010 : Apparence — défauts tenant + override utilisateur

Date : 2026-04-18
Statut : Accepté

## Contexte

Jusqu'à la v1.3 l'apparence de l'interface XCH était pilotée :
- côté utilisateur par `next-themes` (thème clair/sombre/système) stocké en `localStorage` ;
- côté tenant par une palette `Tenant.config.theme` (préset de couleur) et `Tenant.primaryColor` (hex unique).

Il n'y avait pas de règle explicite sur qui décide quoi ni de mécanisme pour **imposer** une identité visuelle tenant (scénario « marque unifiée sans dérive utilisateur »). Les utilisateurs ne voyaient pas non plus d'information sur la source de la valeur courante (inherit vs custom), ce qui compliquait la diagnose UX.

## Décision

1. **Deux niveaux hiérarchiques** :
   - **Tenant (défaut)** : `Tenant.config.appearance = { theme, primaryColor, density, allowUserOverride }`.
   - **Utilisateur (override)** : `User.appearancePreference` (JSON nullable) + `User.appearanceSource ∈ { 'inherit', 'custom' }`.
2. **Résolution effective** côté backend (`UsersService.getEffectiveAppearance`) :
   - `tenant` merged with `user.preference` champ par champ, **uniquement si** `appearanceSource === 'custom'` **et** `tenant.allowUserOverride === true`.
   - Sinon l'utilisateur suit strictement les valeurs tenant.
3. **Verrou administrateur** : `allowUserOverride=false` ⇒ toute tentative de PATCH `/users/me/appearance` avec un champ ou `source=custom` renvoie **403** avec un message FR explicite. Côté UI la section « Mes préférences » se marque « Verrouillé par l'administrateur ».
4. **Endpoints** :
   - `GET /tenants/appearance` — auth authentifié (permet au provider client de résoudre).
   - `PATCH /tenants/appearance` — `@SkipDelegation + @RequireManage` ⇒ super admin uniquement (crée aussi un `AuditLog` tenant-scoped car le changement impacte tous les utilisateurs qui héritent).
   - `GET /users/me/appearance` — source + préférence brute.
   - `PATCH /users/me/appearance` — applique override si autorisé, sinon refuse.
   - `GET /users/me/effective-appearance` — valeur résolue prête à l'emploi + `tenant` + `user` + `source`.
5. **Provider client** : `AppearanceProvider` appelle `GET /me/effective-appearance` au mount et lors des changements, applique `data-density` sur `<html>` et expose `--primary-rgb`/`--xch-primary-color` en CSS variables. Bridge vers `next-themes` pour le thème clair/sombre/système.
6. **Seed** : `Tenant.config.appearance` par défaut = `{ theme:'system', primaryColor: tenant.primaryColor, density:'comfortable', allowUserOverride:true }`. `technicien@demo.fr` reçoit `{ theme:'dark', density:'compact', source:'custom' }` pour exercer visuellement l'héritage dès la première connexion.

## Conséquences

Positives :
- Super admin peut imposer une identité visuelle cohérente en un clic (`allowUserOverride=false`).
- Les utilisateurs voient explicitement la source (Hérité vs Personnalisé vs Verrouillé).
- Le provider client est unique : plus de divergence entre le toggle de la topbar et les préférences stockées.
- Traçabilité : changement de défaut tenant = entrée d'audit CRITIQUE visible uniquement par le super admin.
- Défense en profondeur : le backend refuse un override même si l'UI frontale est contournée.

Négatives :
- Ajout de 2 colonnes à `User` (pas migratoire versionné — `prisma db push --accept-data-loss` comme reste du projet).
- Le flag `allowUserOverride=false` laisse les préférences custom en DB mais inactives ; elles se réactivent automatiquement si le super admin rebascule à `true`. Ce comportement est intentionnel (on ne détruit pas le choix de l'utilisateur, on le neutralise).

## Alternatives considérées

1. **Tout côté frontend via `next-themes`** — rejeté : impossible d'imposer un thème tenant-wide sans passer par le backend, pas de serveur de vérité pour l'audit.
2. **Un seul niveau utilisateur avec héritage implicite** — rejeté : ne permet pas de distinguer « je n'ai jamais choisi » de « j'ai explicitement voulu le défaut tenant », et empêche la réinitialisation propre à la valeur tenant.
3. **Étendre `next-themes` avec un paramètre ssr-default** — rejeté : nécessite un refactor profond du provider, pas de bridge propre pour `density` et `primaryColor`.
4. **AccessOverride par user-site pour l'apparence** — rejeté : hors-scope, l'apparence n'est pas une ressource site-scopée.

## Impact

- Délai : environ 0.5 j (implem backend + provider + 2 cards UI + seed).
- Complexité : faible — réutilise les patterns existants (@SkipDelegation + super admin, AuditLogService, SeedService).
- Risque : nul côté produit (la valeur par défaut `allowUserOverride=true` maintient le comportement pré-v1.4).

## Références

- `backend/src/modules/tenants/dto/appearance.dto.ts`
- `backend/src/modules/tenants/tenants.service.ts` §APPEARANCE
- `backend/src/modules/users/users.service.ts` §APPEARANCE
- `backend/src/modules/users/users.controller.ts` §APPEARANCE
- `frontend/src/components/AppearanceProvider.tsx`
- `frontend/src/lib/api/appearance.ts`
- `frontend/src/app/dashboard/settings/page.tsx` → `AppearancePreferencesCard`, `TenantAppearanceCard`
- `docs/architecture/AUTH_MODEL.md` §7 — mapping onglets
