# ADR-016 : Monitoring natif comme provider unique + suppression Gatus/Kuma + utils SSRF mutualisés + UX produit

**Date :** 2026-04-26
**Statut :** **Accepté** (validation utilisateur 2026-04-26 après analyse des 4 axes)
**Remplace partiellement :** [ADR-014](adr-014-native-monitoring.md) — la posture de coexistence avec Gatus/Kuma READ-only est abandonnée
**Rend obsolète :** [ADR-012](adr-012-gatus-bidirectional.md) — déjà superseded par ADR-014, scellé ici
**Référence :** [ADR-009](adr-009-delegation-first-model.md), [ADR-013](adr-013-residual-json-debt.md), [ADR-014](adr-014-native-monitoring.md), [ADR-015](adr-015-s1-security-hardening.md)

---

## Contexte

L'ADR-014 a livré le module monitoring natif XCH (probes ICMP/HTTP/TCP via worker BullMQ) en posture de **coexistence** avec les providers Gatus + Uptime Kuma READ-only existants : la `MonitoringProvider` interface restait intentionnellement non-implémentée par le natif pour éviter de toucher au code legacy.

Le retour utilisateur après le pilote remet ce choix en cause :

1. **Le statut global du site (`Site.healthStatus`) ne reflète pas le natif** — il est calculé exclusivement à partir des providers Gatus/Kuma. Un opérateur qui crée des MonitorChecks natifs ne voit pas le site changer d'état.
2. **Deux pages /dashboard/monitoring distinctes** (legacy + native) = source double, source de confusion.
3. **Plus de raison fonctionnelle de garder Gatus/Kuma** — le natif couvre l'intégralité du besoin (probes + alertes + UI), avec en plus la maîtrise du schéma, l'API CRUD, et zéro dépendance externe à maintenir.
4. **Quatre angles UX/architecture** ressortent en plus du retrait legacy, traités groupés dans cette ADR (cohérence DI + 1 seule rebuild).

Cinq décisions structurantes (A → E) sont actées.

---

## Décision A — Le module natif implémente `MonitoringProvider`, Gatus + Uptime Kuma sont **supprimés nettement**

### Implémentation

`backend/src/modules/monitoring/native-monitor.provider.ts` implémente l'interface `MonitoringProvider` historique (`backend/src/modules/integrations/interfaces/integration-provider.interface.ts` — l'interface est conservée, propre et générique). Le service lit les `MonitorCheck` + dernière `MonitorResult` et les normalise en `NormalizedMonitor` / `NormalizedMonitorStatus` :

```ts
@Injectable()
export class NativeMonitorProvider implements MonitoringProvider {
  async fetchMonitors(): Promise<NormalizedMonitor[]> {
    const checks = await this.prisma.monitorCheck.findMany({
      where: { enabled: true },
      include: { /* relations + lastResult via SQL window function */ },
    });
    return checks.map(this.toNormalized);
  }
  async getMonitorStatus(checkId: string): Promise<NormalizedMonitorStatus | null> { /* ... */ }
  mapToHealthStatus(s) { return s; }
  isEnabled() { return true; }
  reconfigure() { /* no-op, pas de config externe */ }
  getName() { return 'XCH Native Monitoring'; }
  getStatus() { return 'connected'; }
  testConnection() { return { success: true, message: 'Native worker — always available' }; }
}
```

`HealthAggregationService` est **porté tel quel** depuis `modules/integrations/` vers `modules/monitoring/health-aggregation.service.ts`. La logique d'agrégation (CRITICAL si tous les liens DOWN, WARNING si un lien primary DOWN avec backup OK, etc. — voir §"Conséquences" ci-dessous) est saine et indépendante du provider source. La signature de `monitorStatusMap` passe de `Map<monitorName: string, status>` à `Map<{ targetType, targetId }, status>` pour s'aligner avec le natif.

`HealthSyncScheduler` (cron 5 min) reste actif comme refresh garanti, mais son rôle devient secondaire car **le worker pousse les transitions UP↔DOWN en temps réel** (ADR-014 §6 — déjà en place pour les notifications, étendu pour mettre à jour `Site.healthStatus` immédiatement, voir Décision B).

### Suppression nette

| Backend | Frontend | Infra |
|---|---|---|
| `providers/gatus.provider.ts` | `dashboard/monitoring/config/page.tsx` (route entière) | `gatus/config.yaml` |
| `providers/uptime-kuma.provider.ts` | `dashboard/monitoring/mapping/page.tsx` (route entière) | service `gatus` dans `docker-compose.yml` + `.prod.yml` |
| `providers/monitoring-provider.factory.ts` (devient resolver trivial) | bloc Monitoring config dans `settings/page.tsx` | volume `gatus_data` |
| `controllers/monitoring-webhook.controller.ts` | `lib/api/integrations.ts` champs `uptimeKuma` + `monitoring.{type,url,...}` | ENV `GATUS_*`, `UPTIME_KUMA_*`, `MONITORING_WEBHOOK_SECRET` |
| `services/monitoring-webhook.service.ts` (+ spec) | `hooks/useLiveMonitors.ts` | |
| `IntegrationsService.loadGatusConfig()` / `loadKumaConfig()` / `reconfigureMonitoringProvider()` | `dashboard/monitoring/page.tsx` section legacy + 2e onglet layout | |

**Pas de migration de données** — base de dev, reset + reseed à la fin de la session. `prisma db push --accept-data-loss` couvre tout.

---

## Décision B — `Site.healthStatus` mis à jour en temps réel par le worker

`MonitorProcessor` (déjà en place pour les notifications MONITOR_DOWN/UP) gagne une étape supplémentaire après chaque transition de statut :

```ts
// dans persistResult, après le dispatch notification
const effectiveSiteId = check.siteId ?? check.asset?.siteId ?? check.link?.siteId;
if (effectiveSiteId) {
  await this.healthAggregation.recomputeSite(effectiveSiteId);
}
```

`HealthAggregationService.recomputeSite(siteId)` lit l'ensemble des MonitorCheck du site (direct + via assets + via links), réutilise sa logique existante d'agrégation, écrit `Site.healthStatus`. **Latence : ~1s entre le probe DOWN et le badge site rouge dans l'UI.** Le cron 5 min reste un filet de sécurité (rattrape un trigger raté).

---

## Décision C — Drop des champs résiduels `ConnectivityLink.{status, monitorName}` et de l'event `MONITORING_ALERT`

Deux résidus de l'archi legacy, identifiés par [ADR-013](adr-013-residual-json-debt.md) §"phase 6.5", finissent maintenant :

- `ConnectivityLink.monitorName: String?` — résidu du JSON `Site.connectivity.links[i].monitorName` qui mappait le nom Kuma au lien. Plus utilisé : le natif a le FK direct `MonitorCheck.linkId`. **Drop**.
- `ConnectivityLink.status: String?` — dénormalisation alimentée par les webhooks Kuma. La source de vérité devient `MonitorCheck.lastStatus` lu via la relation `link.monitorChecks[]`. **Drop**.
- `NotificationEventType.MONITORING_ALERT` — utilisé par les webhooks Gatus/Kuma. Plus de webhook = event mort. **Drop**. Les events natifs `MONITOR_DOWN` / `MONITOR_UP` couvrent 100% du besoin.
- `NotificationEmitter.monitoringAlert()` — méthode qui dispatchait MONITORING_ALERT. **Drop** (dead code).

Les NotificationConfig utilisateurs qui référencent encore MONITORING_ALERT seront automatiquement reset au reseed (acceptable en dev).

---

## Décision D — Utils SSRF extraits en `common/security/network/`, brancher TeamsChannel

Les fonctions `isPrivateOrLoopback`, `validateTarget`, `safe-lookup` quittent `modules/monitoring/probes/` pour `backend/src/common/security/network/`, scindées en primitives génériques :

```
common/security/network/
├ private-ip.ts        — isPrivateOrLoopback (IPv4/IPv6, allowInternal toggle)
├ url-validator.ts     — validateUrl(url, allowInternal, schemes?) → {ok,reason,host}
├ host-validator.ts    — validateHost(host, allowInternal) → {ok,reason}
├ safe-lookup.ts       — makeSafeLookup hook DNS-rebinding-proof
├ safe-http.ts         — makeSafeAxios + makeSafeAgents (http/https) avec lookup intégré
└ index.ts
```

`modules/monitoring/probes/target-validator.ts` devient un thin wrapper Prisma-typé qui dispatche `MonitorKind` → `validateUrl` ou `validateHost`.

**Brancher TeamsChannel** : `backend/src/modules/notifications/channels/teams.channel.ts` envoie aujourd'hui un POST vers une `webhookUrl` configurée par l'admin. Sans validation, un manager malveillant peut configurer `http://10.0.0.1/admin` et exfiltrer/scanner. Refacto en utilisant `makeSafeAxios(tenant.allowInternalNetworkTargets)` + `validateUrl` au moment de la sauvegarde de la config — **ferme un vrai trou SSRF identifié pendant l'analyse**.

**Renommage** : `Tenant.allowInternalMonitorTargets` → `Tenant.allowInternalNetworkTargets`. Le scope dépasse maintenant le monitoring.

---

## Décision E — Réactions automatiques aux changements de statut + cohérence IP

### E.1 — Auto-désactivation sur sortie d'`IN_SERVICE` / `ACTIVE`

| Trigger | Action |
|---|---|
| `Asset.status` → `IN_STOCK` / `DECOMMISSIONED` / `BROKEN` / `DISPOSED` | `monitorCheck.updateMany({ where: {assetId, enabled:true}, data:{enabled:false} })` + `AuditLog('MONITOR_AUTO_DISABLED', {assetId, count, reason: 'asset_status_change'})` |
| `Site.status` → `CLOSED` | Désactive tous les checks où `siteId == site.id` OR `asset.siteId == site.id` OR `link.siteId == site.id`. AuditLog. |
| `Asset.status` revient `IN_SERVICE` | **NE PAS** réactiver silencieusement. Renvoyer `{ disabledMonitorCount: N }` dans la réponse API. |
| `Site.status` quitte `CLOSED` | Idem. |
| `ConnectivityLink.endDate < now()` | **Pas d'auto-disable** — bannière info en UI seulement. |

### E.2 — Bannière persistante (pas un toast volatile)

Sur `dashboard/assets/[id]/page.tsx` et `dashboard/sites/[id]/page.tsx`, un composant `<MonitorsAutoDisabledBanner entity={asset|site} />` s'affiche **tant qu'il existe** des MonitorCheck avec `enabled=false` ET un AuditLog récent `MONITOR_AUTO_DISABLED` correspondant. La bannière propose **« Réactiver les N monitors »** (bulk PATCH `enabled:true`) ou **« Garder désactivés »** (marqueur "ack" dans l'AuditLog : la bannière disparaît).

Le toast au moment du retour en service (`{disabledMonitorCount: N}` retourné par l'API d'update statut) est complémentaire — feedback immédiat sur l'action — mais la bannière est la source persistante.

### E.3 — Auto-sync de `MonitorCheck.target` sur changement d'IP

Dans `assets.service.ts.update()`, après `prisma.asset.update`, si `dto.networkInfo?.ip` change :

```ts
if (oldIp && newIp && oldIp !== newIp) {
  // Re-validation SSRF AVANT sync — sinon backdoor sur le validateur.
  const valid = validateHost(newIp, tenant.allowInternalNetworkTargets);
  if (!valid.ok) {
    // Asset.update succeeds, monitor sync skipped + log warning
    return;
  }
  const synced = await this.prisma.monitorCheck.updateMany({
    where: { assetId: id, target: oldIp },
    data: { target: newIp },
  });
  if (synced.count > 0) {
    await this.audit.log('MONITOR_TARGET_AUTO_SYNCED', { assetId: id, oldIp, newIp, count: synced.count });
  }
}
```

Critère restrictif : `target == oldIp` strictement. Si l'utilisateur a typé une cible custom (publique, alias), `target != oldIp`, pas de sync — **respect de l'intent par construction**. Idem pour `link.publicIp` dans `connectivity.service.ts.update()`.

---

## Décision F — UX produit pour la liste de monitors

L'affichage actuel (table : icône + IP mono + badge UP/DOWN + parent + interval + lien Détail) est **orienté technique**. Refonte pour une lecture immédiate par un utilisateur métier.

### Display name calculé (pas de schéma)

```
Si check.asset présent  → "FortiGate Active" (asset.name)
Si check.link présent   → "Lien primaire Orange Business Services" (link.role + link.provider)
Si check.site seul      → "Surveillance site Tour Alto" (site.name)
```

L'IP / URL technique passe en sous-titre gris avec icône, plus en titre.

### Vocabulaire

| Avant (technique) | Après (métier) |
|---|---|
| Probe ICMP | Ping |
| Probe HTTP | Site web |
| Probe TCP | Port `:443` |
| UP | **Disponible** + pastille verte |
| DOWN | **Indisponible** + pastille rouge |
| UNKNOWN | En attente |
| Intervalle 300s | Vérifié toutes les 5 min |
| Lancer maintenant | Tester maintenant |
| Désactivé | Désactivé (état grisé, monospace en italique) |

### Hiérarchie visuelle (ligne / carte)

Chaque entrée de la liste :
```
●  FortiGate Active                     [Disponible]    Détail →
│  Ping · 10.1.0.1                      Site Tour Alto
│  Vérifié il y a 23s · toutes les 5 min
```
Pastille de couleur status à gauche (4-6px de largeur, hauteur entière de la ligne), nom en gras, statut en badge à droite, sous-titre context avec icône type/parent/temps.

### Groupement et filtres

- Sur `/dashboard/monitoring` : filtres `Site` (dropdown), `Type` (Ping/Web/Port), `Statut` (Disponible/Indisponible/Attente), recherche texte. Toggle **Vue : à plat | groupée par site** (état persisté en `localStorage`).
- En vue groupée : 1 `Card` par site avec en-tête « Site Tour Alto · 5 monitors · 4 disponibles · 1 indisponible » + sous-table compacte.

### Onglet site dashboard

Sur `dashboard/sites/[id]`, nouvel onglet **Monitoring** qui réutilise `<NativeMonitorsList siteId={id} groupBy="none" showSparkline />`. Sparkline mini par row (50 dernières probes en barres minces) en plus pour donner le sentiment "tendance".

### Backend supports

- Étoffer les includes Prisma sur `monitors.service.ts` : `asset: { include: { site: { select: {...} } } }` + `link: { include: { site: { select: {...} } } }` pour avoir le site même quand le check est rattaché à un asset/link. Coût SQL négligeable (1 JOIN supplémentaire).
- Endpoint `GET /api/monitors/:id/sparkline?limit=50` léger pour la mini-sparkline (status + checkedAt seulement, pas le détail). Optionnel — peut réutiliser `history?limit=50` existant.

---

## Plan d'implémentation (13 lots)

| Lot | Titre | Charge |
|---|---|---|
| A | Refacto SSRF en `common/security/network/` + brancher `TeamsChannel` | 1h |
| B | Port `HealthAggregationService` dans `modules/monitoring/`, signature monitorStatusMap | 1h |
| C | `NativeMonitorProvider` + suppression backend Gatus/Kuma + ENV cleanup | 1h |
| D | Suppression frontend (`/monitoring/{config,mapping}`, settings, `useLiveMonitors`) | 1h |
| E | Drop `ConnectivityLink.{status, monitorName}` + `MONITORING_ALERT` + reseed | 30 min |
| F | Real-time `Site.healthStatus` update depuis `MonitorProcessor` | 30 min |
| G | Auto-disable on status change + `<MonitorsAutoDisabledBanner />` persistante | 1h30 |
| H | Auto-sync IP avec re-validation SSRF + tests | 1h |
| I | UX refonte `<NativeMonitorsList>` + onglet site + group by + sparkline + vocabulaire | 2h |
| J | docker-compose cleanup gatus + README + docs (00-INDEX, tech-stack, agents) | 45 min |
| K | Adapter tests + smoke tests prod | 45 min |
| L | Deploy + reseed + verify | 30 min |
| M | S1 closing residue (Multer + magic-bytes images + retrait fallbacks compose + doc faux positifs) | 1h |

**Total : ~12h.** Une seule session.

---

## Conséquences

### Positives

- **Une seule source de vérité** monitoring : MonitorCheck + MonitorResult, lus partout (UI, healthAggregation, alertes).
- **Site.healthStatus reflète enfin le natif** — temps réel + cron 5 min de backup.
- **Zéro dépendance externe** : pas de Gatus YAML à maintenir, pas de Kuma, pas de webhook entrant à sécuriser.
- **Surface SSRF centralisée et auditée** : 1 seul endroit pour la logique de validation, branché systématiquement sur tout consommateur HTTP outbound (monitoring, Teams, futures intégrations).
- **UX produit cohérente** : vocabulaire métier, hiérarchie visuelle, groupement, sparklines.
- **~2000 lignes supprimées** côté backend + frontend (providers, controllers, services, hooks, pages).
- **3 ENV vars, 1 service Docker, 1 volume** retirés du compose : install plus simple.

### Négatives

- **Sites sans aucun MonitorCheck → `healthStatus = UNKNOWN`** par défaut (avant : pouvaient apparaître HEALTHY si un Kuma externe avait des données). Sémantiquement correct, mais à documenter dans le release note.
- **Pas de retour à coexistence trivial** : si demain un client veut absolument intégrer un Gatus existant, il devra re-développer un adaptateur. Risque jugé faible (le pilote XCH n'a jamais demandé).
- **NotificationConfig utilisateurs référençant `MONITORING_ALERT` perdent leur règle** au reseed dev. Acceptable, la base est éphémère.
- **Refacto SSRF touche plusieurs imports** (~15 fichiers) — moment idéal vu qu'on touche déjà au monitoring.
- **`<MonitorsAutoDisabledBanner />` introduit une notion d'AuditLog "ack"** (pour faire disparaître la bannière) — petit pattern à formaliser. Acceptable pour 1 cas d'usage.

---

## Alternatives considérées

| Option | Pourquoi rejetée |
|---|---|
| Garder Gatus/Kuma READ-only en parallèle (statu quo ADR-014) | Statut site doublement source, page monitoring divisée, dépendance externe inutile, complexité de maintenance |
| Native = nouveau provider sans toucher l'existant | Idem, et on porte la dette technique de l'archi à 2 voies |
| `MonitorCheck.name String` field plutôt que display name calculé | Surdimensionné v1, donne l'illusion d'un degré de liberté sans valeur métier (le calcul depuis asset/link/site suffit pour 99% des cas) |
| Hard-delete des MonitorChecks quand asset DECOMMISSIONED | Perd l'historique, irréversible si retour en service |
| `MonitorCheck.targetSource` enum (`asset_ip` / `manual`) pour l'auto-sync IP | Surdimensionné, le critère `target == oldIp` couvre 99% du besoin |
| `NetworkSecurityService` Nest-injectable pour SSRF | Boilerplate disproportionné pour 4 fonctions pures sans état |
| Auto-restart sur worker unhealthy | Risque boucle restart, masque la cause racine ([ADR-014](adr-014-native-monitoring.md) §6) |

---

## Références

- [ADR-009](adr-009-delegation-first-model.md) : modèle delegation-first (routing notifications)
- [ADR-013](adr-013-residual-json-debt.md) : nettoyage JSON résiduel (qui pré-flagait `ConnectivityLink.status` + `monitorName`)
- [ADR-014](adr-014-native-monitoring.md) : module monitoring natif (rev. § coexistence supprimée par cette ADR)
- [ADR-015](adr-015-s1-security-hardening.md) : sécurité S1 (clos en lot M de cette ADR)
