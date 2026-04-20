# ADR-013 : Dette JSON résiduelle post-phase 6.6

**Date :** 2026-04-20
**Statut :** Accepté — sessions dédiées planifiées
**Contexte :** Phase 6.6 (refacto SD-WAN + ConnectivityLink.assetId + EnumLabel.isConnectivityCapable + wizard sites 2-temps)

## Contexte

Le principe directeur XCH énoncé par l'utilisateur le 2026-04-20 — « Toujours faire propre, pas de dette technique. L'app doit être développée selon les règles de l'art d'aujourd'hui. Harmoniser, cohérence, effacer toute dette — sans négliger la sécurité. » — impose de remplacer les champs JSON « sac à tout » par des modèles Prisma structurés (FK, index, query) partout où la sémantique le permet.

La phase 6.6 a tenu ce cap pour SD-WAN (modèles `SdwanConfig` + `SdwanFirewall`) et pour la relation ConnectivityLink ↔ équipement terminal (FK `assetId` + flag `EnumLabel.isConnectivityCapable`). Il reste deux poches JSON que cette phase **n'a pas refactorées**, pour des raisons de risque et de portée.

## Décision

Les deux dettes suivantes sont **acceptées à court terme** et planifiées en sessions dédiées séparées.

### 1. `NotificationConfig.channels` + `NotificationConfig.events`

```prisma
// backend/prisma/schema.prisma:1281-1284 (actuel)
model NotificationConfig {
  ...
  channels Json @db.JsonB  // { email: {...}, teams: {...} }
  events   Json @db.JsonB  // { TASK_ASSIGNED: {...}, ... }
}
```

Structure imbriquée portant des flags d'héritage (inherit flags), listes de destinataires par canal, événements avec `channels[]`. La logique d'héritage global → délégation est déjà en prod sur le pilote.

**Refacto recommandé :** modèles `NotificationChannelConfig` (channel × enable × inherit × recipients FK) + `NotificationEventConfig` (event × channel × inherit × enable).

**Session dédiée :** à planifier après phase 6.6 déployée sur le pilote. Tests d'héritage exhaustifs requis (global → delegation) avant toute bascule.

### 2. `Asset.networkInfo` — attendre la session monitoring native

```prisma
// backend/prisma/schema.prisma:423 (actuel)
networkInfo Json? @db.JsonB // {ip, mac, hostname, vlan, port, adminLinks, monitorName, monitorStatus, lastHealthCheck}
```

Le champ mélange deux responsabilités distinctes :
- **Réseau pur** — `{ip, mac, hostname, vlan, port, adminLinks[{label, url}]}` — interfaces réseau + liens d'administration.
- **Monitoring** — `{monitorName, monitorStatus, lastHealthCheck}` — bindings Uptime Kuma / Gatus, consommés par `HealthAggregationService` et écrits par `monitoring-webhook.service`.

**Décision : le refacto d'`Asset.networkInfo` attend la session monitoring native** (`docs/prompts/next-session-monitoring-native.md`), *même pour la partie réseau pur*.

**Raison :** la session monitoring native va très probablement toucher d'autres facettes de l'asset (status de santé, relations de notifications, metadata liées aux monitors). Le user a explicitement rappelé le 2026-04-20 : « vu que je vais faire une session pour revoir le système de monitoring (native) sûrement il y a des choses qui vont changer pour les assets (les notifications, le status...) ». Refactorer `Asset.networkInfo` maintenant, puis devoir y retoucher quelques semaines plus tard quand la session monitoring tape dans l'asset, serait doubler le risque pour un gain de visibilité limité.

**Séquencement propre :**
1. Phase 6.6 déployée sur pilote + validée.
2. Session monitoring native : refacto `monitorName/monitorStatus/lastHealthCheck` → probablement modèle `AssetMonitorBinding` ou équivalent + tout le reste qui touche l'asset dans ce périmètre.
3. Session dédiée « Asset.networkInfo network-pure » post-monitoring : modèles `AssetNetworkInterface` (1:N) + `AssetAdminLink` (1:N). À ce stade le périmètre « asset » est stabilisé, un seul refacto propre suffit.

Le seul inconvénient d'attendre : pas de recherche indexée par IP avant cette séquence complète. Acceptable pour le pilote.

## Conséquences

**Positives :**
- Périmètre phase 6.6 resté maîtrisé (~7 lots, pas de régression silencieuse sur des chemins critiques en prod).
- Les deux dettes sont tracées et planifiées, pas oubliées.
- Séparation monitoring / structure de données respectée, cohérente avec la règle projet.

**Négatives (acceptées) :**
- `NotificationConfig` et `Asset.networkInfo` continuent de porter des JSON typés faiblement pendant 1 à 2 sprints.
- `networkInfo.ip` reste inaccessible aux requêtes indexées — pas de recherche par IP publique côté back efficace avant le split.
- Le flag TS `as any` sur `(a.networkInfo as any).monitorName` reste nécessaire dans `HealthAggregationService` jusqu'à la session monitoring.

## Alternatives considérées

1. **Tout refactorer en phase 6.6** — rejeté. Chaque dette représente ~3-6h + des risques de régression qui cumulés auraient rendu le déploiement du pilote trop bloquant.
2. **Laisser la dette indéfiniment** — rejeté. Viole le principe directeur XCH (« pas de dette technique »).
3. **Créer un champ `monitoring Json?` séparé du `networkInfo Json?`** — rejeté. Remplace une dette par une autre au lieu de la supprimer.

## Suivi — séquencement des sessions à venir

Ordre imposé par les dépendances :

1. **Phase 6.6 déployée + validée pilote** (cette session, en cours).
2. **Session monitoring native** (`docs/prompts/next-session-monitoring-native.md`) — traite `monitorName` / `monitorStatus` / `lastHealthCheck` + tout ce qui touche monitoring sur l'asset (notifications, status de santé, bindings monitor). Peut toucher `Asset.*` ; raison pour laquelle Asset.networkInfo attend.
3. **Session dédiée `NotificationConfig`** — indépendante des 2 autres, peut être planifiée en parallèle de la monitoring si nécessaire (mais attention : les notifications sont probablement impactées par le monitoring refactor — à réévaluer au moment venu).
4. **Session dédiée `Asset.networkInfo` (partie réseau pur)** — `AssetNetworkInterface` + `AssetAdminLink`. Post-monitoring uniquement, pour ne pas re-toucher l'asset deux fois.

## Références

- Principe directeur : mémoire `XCH_ENGINEERING_PRINCIPLES` (2026-04-20)
- Règle monitoring scope : mémoire `feedback_monitoring_session_scope.md`
- Phase 6.6 : `reports/phase6.6-cleanup.md` (rapport final)
- Prompt monitoring dédié : `docs/prompts/next-session-monitoring-native.md`
