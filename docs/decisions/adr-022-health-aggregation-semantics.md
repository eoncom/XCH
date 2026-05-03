# ADR-022 : Sémantique d'agrégation de santé site (severity flag explicite)

Date : 2026-05-03
Statut : Accepté
Tag cible : v1.10.0 (mini-session aggregation refonte, plan v2 finalization)
Dépendances :
- ADR-014 (monitoring natif BullMQ + scheduler 30s)
- ADR-016 (recomputeSite real-time on UP↔DOWN transition)
- v1.9.0 PR #30 (fix SD-WAN tous firewalls DOWN → CRITICAL)
- v1.9.1 PR #31 (label `site-monitor` distinct)

## Contexte

`HealthAggregationService.computeOverall()` calcule `Site.healthStatus`
(HEALTHY / WARNING / CRITICAL / UNKNOWN) à partir des composants montés
sur le site (links, SD-WAN, assets, site-level monitors). Avant cette
ADR, la criticité de chaque composant était **dérivée par heuristique
implicite** au moment de l'agrégation :

```typescript
function linkImpact(role: string, status: Triplet, totalLinks: number) {
  if (status !== 'down') return 'none';
  if (totalLinks <= 1) return 'critical';  // single-link site
  return 'warning';                         // multi-link → degraded
}

function assetImpact(status: Triplet) {
  if (status !== 'down') return 'none';
  return 'warning';  // toujours warning, peu importe l'asset
}
```

Trois problèmes :

1. **Pas de distinction PRIMARY / BACKUP**. Un lien BACKUP DOWN sur un
   site multi-link tombait WARNING (correct). Un lien PRIMARY DOWN sur
   le même site tombait *aussi* WARNING (incorrect — le service nominal
   est cassé, c'est CRITICAL).
2. **Asset toujours WARNING**. Pas moyen de marquer un core switch ou
   un UPS comme « DOWN = service-down du site » sans toucher au code.
3. **SD-WAN et single-link traités par cas spéciaux dans le code**.
   v1.9.0 a déjà ajouté un fix SD-WAN (`upCount === 0 → 'critical'`),
   et `linkImpact` traite déjà le single-link à part. Chaque nouveau
   cas critique = touch dans `health-aggregation.service.ts`.

Le bon endroit pour exprimer la criticité est **la donnée**, pas
l'algorithme : un opérateur peut classer ses checks (PRIMARY=critical,
backup-monitoring=warning, soft-signals=info) sans patcher de code.

## Décision

Ajouter un champ `severity SeverityLevel @default(WARNING)` sur
`MonitorCheck` (enum CRITICAL / WARNING / INFO). L'agrégation devient
mécanique :

| Composant DOWN | severity | Effet sur Site.healthStatus |
|---|---|---|
| ≥ 1 check | CRITICAL | **CRITICAL** (PRIMARY link, asset critique, override admin) |
| ≥ 1 check | WARNING | **WARNING** (BACKUP link, asset générique, site-level) |
| ≥ 1 check | INFO | (aucun — soft signal, ne dégrade pas) |
| 0 monitoré | — | **UNKNOWN** |
| Tout UP | — | **HEALTHY** |

Plus de couverture implicite : si 1 site-level UP est le seul check
configuré, le site est HEALTHY. Si rien n'est monitoré, UNKNOWN. Pas
d'exigence cachée de couverture minimale.

### Backfill (migration `11_monitor_check_severity`)

- Liens role=PRIMARY → CRITICAL (perte service nominal = critical)
- Liens role=BACKUP → WARNING (default — dégradation, nominal couvre)
- Liens role=OTHER, assets, site-level, firewalls SD-WAN → WARNING (default)

Forward-only : pas de migration revert. Une régression sur la sémantique
se corrige via une nouvelle migration UPDATE.

### Cas spécial SD-WAN

La règle « tous firewalls DOWN → site CRITICAL » reste pilotée par
**l'aggregator** (non par flag individuel). Chaque MonitorCheck attaché
à un firewall garde `severity=WARNING` par défaut ; la promotion
CRITICAL se fait au moment de l'agrégation quand la totalité du SD-WAN
est DOWN. Cela laisse l'admin libre de marker un firewall individuel en
CRITICAL via override sans casser la sémantique « all-down » globale.

### Override

Le flag `severity` est éditable par opérateur sur chaque MonitorCheck
via UI (sélecteur dans le formulaire d'édition). Trois cases :
- Élever : asset générique → CRITICAL (core switch)
- Abaisser : check sensible mais informatif → INFO
- Laisser le default : la majorité des cas

### Forme de l'API

`HealthComponent.impact` (déjà présent dans `componentsJson`) garde sa
forme `'critical' | 'warning' | 'info' | 'none'` mais devient une projection
directe de `MonitorCheck.severity` au lieu d'une heuristique. Frontend
inchangé sur la lecture (déjà branché sur `impact`).

## Conséquences

### Positives

- **Données autoritatives** : la criticité est dans la donnée, pas dans
  le code. Audit trivial (`SELECT severity, count(*) FROM monitor_checks
  GROUP BY 1`).
- **Plus de touch code pour nouveau cas critique** : marquer un check
  comme CRITICAL via UI suffit. Plus besoin de patcher `linkImpact`
  pour ajouter une heuristique.
- **Sémantique testable** : matrice severity × status → overall site
  status couverte par tests unitaires sans simulation topologique.
- **PRIMARY/BACKUP correct** : un lien PRIMARY DOWN sur un site
  multi-link est désormais CRITICAL, pas WARNING.

### Négatives

- **Une migration DB de plus** (forward-only, suit ADR-017). Backfill
  pas reversible — un retour arrière nécessite UPDATE manuel.
- **UI à toucher** : formulaire d'édition MonitorCheck doit exposer
  le sélecteur. Plus complexe pour l'opérateur (un champ de plus à
  comprendre), mais documenté en tooltip.
- **SD-WAN garde un cas spécial** : la règle « tous firewalls DOWN →
  CRITICAL » n'est pas exprimée par le flag (sinon partial-down serait
  aussi CRITICAL). Reste une logique d'aggregator. Documenté inline.

## Alternatives considérées

1. **Garder les heuristiques + ajouter des cas spéciaux par
   feature** — RETENU jusqu'en v1.9.1 (fix SD-WAN, fix label
   site-monitor). Inviable à terme : chaque cas client = touch code +
   redeploy. Rejeté.
2. **`severity` en metadata JSON sur Site/MonitorCheck** — non typé,
   pas de validation Prisma, pas d'enum DB. Cohérent ADR-018 (cleanup
   JSON). Rejeté.
3. **`severity` au niveau de l'entité parent (Link.severity,
   Asset.severity)** plutôt que sur chaque MonitorCheck — moins de
   granularité (un asset avec 3 checks ne peut pas distinguer
   l'importance entre les 3). Rejeté.
4. **`severity` calculé dynamiquement depuis le rôle (PRIMARY auto-
   CRITICAL)** sans champ explicite — déléguait toujours la sémantique
   au code. Pas d'override possible. Rejeté.

## Impact opérationnel

Pré-tag, post-deploy :
1. Migration appliquée au boot API container (`migrate deploy`
   ADR-017) — toutes les rows existantes héritent du backfill.
2. UI sélecteur disponible immédiatement pour ajustement par admin.
3. Recompute initial pour tous sites via la cron 5min existante (ou
   trigger manuel `enqueueRecompute(siteId)`).

Aucun breaking pour le frontend : `componentsJson.impact` reste la
clé lue. Notification dispatch inchangé (toujours sur transition
probe, pas sur recompute).

## Observabilité

Le pattern d'agrégation est désormais purement déclaratif. Une régression
sémantique (ex : un check passé par mégarde de CRITICAL à WARNING) est
visible directement par audit DB. Les tests Jest couvrent la matrice
severity × status × type composant.
