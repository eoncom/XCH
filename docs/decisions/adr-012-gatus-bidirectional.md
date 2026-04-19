# ADR-012 : Intégration bidirectionnelle Gatus (auto-register + positionnement notifications)

**Date :** 2026-04-20
**Statut :** **Proposé** — sous-décisions à valider avant implémentation
**Auteurs :** Lead technique, demande utilisateur 2026-04-20

---

## Contexte

Aujourd'hui, l'intégration Gatus dans XCH est **unidirectionnelle (READ-only)** :

- **Pull** : `GatusProviderService` ([backend/src/modules/integrations/providers/gatus.provider.ts](../../backend/src/modules/integrations/providers/gatus.provider.ts)) interroge périodiquement `GET /api/v1/endpoints/statuses` pour récupérer l'état des endpoints monitorés.
- **Push (alertes)** : `MonitoringWebhookController` accepte les webhooks Gatus à `POST /api/integrations/monitoring/webhook?provider=gatus` et synchronise les changements d'état dans XCH.

**Ce qui manque (demande utilisateur) :**

1. **Auto-register** — quand un site, un asset (firewall, switch, NRO, etc.) ou une ConnectivityLink est créé(e) dans XCH, l'inscrire automatiquement comme endpoint à surveiller dans Gatus, sans avoir à éditer manuellement le YAML de config Gatus.
2. **Réflexion sur Gatus comme producer de notifications** — l'utilisateur a évoqué la possibilité d'utiliser Gatus pour envoyer les notifications mail/Teams à la place du module XCH.

---

## Contraintes Gatus (à connaître avant de décider)

Gatus est un health-checker **config-driven**, pas API-driven :

- La liste des endpoints à monitorer **vit dans son fichier YAML** (`config.yaml`), pas dans une API CRUD. Gatus n'expose **pas** d'endpoint REST pour créer/modifier/supprimer un endpoint dynamiquement.
- Gatus supporte le **rechargement de config** :
  - À chaque démarrage (le plus simple)
  - Via `--config-file` watch en mode `--watch-config-file` (recharge automatique sur changement de fichier)
  - Via `endpoints-from-file` (pointer vers un fichier YAML externe rechargé périodiquement)
- Les **alerting providers** (mail, Teams, Slack, etc.) sont configurés dans le même YAML — pas paramétrables dynamiquement par endpoint depuis l'extérieur.

**Conséquence directe** : pour pousser des endpoints depuis XCH, on doit **générer un fichier YAML** et trouver un mécanisme pour le faire consommer par Gatus.

---

## Décision (proposition)

### 1. Auto-register — **stratégie « XCH expose un endpoint, Gatus consomme via fichier monté + watch »**

XCH expose un endpoint authentifié `GET /api/integrations/gatus/endpoints.yaml` qui rend le YAML `endpoints:` à jour. Une **task cron locale au container Gatus** (ou un sidecar minimal `wget` + `restart` toutes les 5 min) récupère ce YAML et l'écrit dans `/config/endpoints-from-xch.yaml`. Gatus a `--watch-config-file` activé et recharge automatiquement.

**Pourquoi cette stratégie :**

- Pas de couplage filesystem direct entre XCH et Gatus (chacun reste dans son container).
- Pas de modification du code Gatus (il consomme juste un fichier YAML).
- Le sidecar `wget` est trivial à ajouter au `docker-compose.prod.yml`.
- XCH conserve l'**autorité** sur la liste des endpoints (source de vérité = la base XCH).

**Alternatives écartées :**

| Option | Pourquoi rejetée |
|---|---|
| **A — XCH écrit directement dans le volume Gatus** | Couplage filesystem fragile, partage de volume entre containers, risque de race conditions au reload Gatus, casse la sécurité (XCH n'a pas à pouvoir écrire dans le volume Gatus). |
| **B — XCH appelle une API Gatus de configuration** | N'existe pas. Gatus n'a pas d'API CRUD pour les endpoints. |
| **C — Gatus pull via `endpoints-from-url`** | Cette option n'existe pas en standard Gatus (il n'y a que `endpoints-from-file`). Implique un fork ou un patch Gatus. |
| **D — XCH génère un YAML statique au moment du déploiement** | Casse l'objectif (l'utilisateur veut que les nouveaux sites/assets soient inscrits sans redéploiement). |

### 2. Granularité — **toggle explicite par entité**

Tous les sites / assets / connectivity links **NE SONT PAS** automatiquement inscrits. L'utilisateur active le monitoring **explicitement** via un toggle UI :

- **Site** : champ `Site.monitoringEnabled Boolean @default(false)` (existe déjà dans le schema, actuellement utilisé seulement pour la cron health côté XCH — sera étendu pour piloter l'inscription Gatus).
- **Asset** : nouveau champ `Asset.monitoringConfig Json?` qui stocke `{ enabled: boolean, type: 'icmp' | 'http' | 'tcp', target: string, intervalSec: number }`.
- **ConnectivityLink** : utilise déjà `publicIp` et `provider` — toggle `monitoringEnabled` (à ajouter, défaut `true` car c'est typiquement le cas d'usage : on veut surveiller la liaison FAI).

**Pourquoi explicite :**

- Tous les sites/assets ne se monitorent pas (un asset stocké en stockage de spare, un site en préparation, un firewall comme passive backup, etc.).
- Évite l'explosion du nombre d'endpoints Gatus → meilleure perf + meilleure pertinence des alertes.

### 3. Lifecycle — **mise à jour automatique au save / delete**

Quand un toggle change de valeur ou quand l'IP/hostname change :

- Le service `GatusEndpointsService` régénère le YAML (cache invalidé)
- Le sidecar récupère le nouveau YAML au prochain tick (≤ 5 min de latence)
- Gatus `--watch-config-file` recharge sans restart

Quand un site/asset est supprimé : on retire son endpoint du YAML automatiquement.

### 4. Permissions — **WRITE sur l'entité = monitoring activable**

Activer/désactiver le monitoring suit le même RBAC que l'edit de l'entité (`@RequireWrite()` sur le toggle endpoint, scope vérifié par site).

Lecture du YAML (`GET /api/integrations/gatus/endpoints.yaml`) protégée par un **token bearer dédié** (`GATUS_PUSH_SECRET` env var côté XCH, mêmes credentials côté sidecar). N'utilise PAS le JWT user — l'authentification est machine-to-machine.

### 5. Notifications — **Gatus reste un producer parmi d'autres, pas un hub**

**Recommandation : ne PAS migrer le routing notifications XCH vers Gatus.**

Raisons :

- Gatus est un health-checker, pas un router de notifs métier. Configurer ses alerting providers par endpoint depuis l'extérieur n'est pas conçu et nécessiterait des hacks YAML lourds.
- XCH a déjà un `NotificationConfigService` qui résout l'héritage par délégation (cf. CHANGELOG v1.3 Lot F2 + ADR-009). Le sacrifier serait perdre la granularité par délégation et la cohérence avec les autres canaux (TASK_ASSIGNED, warranty, etc.) qui n'ont rien à voir avec le monitoring.
- Le webhook Gatus → XCH **fonctionne déjà bien** : Gatus détecte un down, push à XCH, XCH applique son routing (NotificationConfig de la délégation propriétaire du site, hérite du global si non défini, dispatch via mail/Teams).

**Décision : conserver l'architecture actuelle.** Gatus reste un **producer d'évènements** (alertes monitoring) qui s'ajoute à NetBox, aux crons internes (warranty, due tasks) et aux hooks métier. Le routing reste dans XCH.

### 6. Sécurité

- L'endpoint `GET /api/integrations/gatus/endpoints.yaml` requiert un header `X-Gatus-Push-Secret: <token>` (défini dans `.env` côté backend).
- Le sidecar a ce secret en variable d'env Docker.
- Sans le secret → 401. Pas de cookie, pas de JWT → l'endpoint est `@Public()` mais protégé par secret partagé.
- Au cas où le secret fuite, rotation sans downtime via redéploiement docker-compose des deux services concernés.

---

## Schema impact (à valider)

| Entité | Champ ajouté | Type | Default | Utilité |
|---|---|---|---|---|
| `Site` | `monitoringEnabled` | `Boolean` | `false` | déjà présent ; étendre pour gating Gatus |
| `Asset` | `monitoringConfig` | `Json?` | `null` | `{ enabled, type, target, intervalSec }` — null = pas monitoré |
| `ConnectivityLink` | `monitoringEnabled` | `Boolean` | `true` | activé par défaut car c'est le cas d'usage typique |

Migration : `prisma db push --accept-data-loss` non destructif (ajout colonnes nullable / default).

---

## API impact (à valider)

| Endpoint | Méthode | Auth | Rôle |
|---|---|---|---|
| `GET /api/integrations/gatus/endpoints.yaml` | GET | `X-Gatus-Push-Secret` header | Génère le YAML Gatus pour le sidecar |
| `PATCH /api/sites/:id/monitoring` | PATCH | `@RequireWrite()` | Toggle `monitoringEnabled` sur Site |
| `PATCH /api/assets/:id/monitoring` | PATCH | `@RequireWrite()` | Set `monitoringConfig` sur Asset |
| `PATCH /api/connectivity/:id/monitoring` | PATCH | `@RequireWrite()` | Toggle `monitoringEnabled` sur Link |
| `POST /api/integrations/gatus/refresh` | POST | `@RequireManage() + @SkipDelegation` super-admin | Force une régénération du YAML cache + log audit |

---

## Conséquences

### Positives

- **Source de vérité unique** : la liste des endpoints monitorés vit dans XCH (= la base métier).
- **Zero-config Gatus runtime** : on n'édite plus le YAML manuellement.
- **Découpage clair** : XCH gère le quoi-monitorer, Gatus gère le comment-checker, le routage notifs reste dans XCH.
- **Extensible** : si on remplace Gatus par autre chose demain (Uptime Kuma déjà prévu en READ, Prometheus Blackbox Exporter), on garde l'API XCH stable et on adapte juste le générateur de config.

### Négatives

- **Dépendance opérationnelle au sidecar** : si le wget/cron lâche, Gatus reste sur l'ancienne version du YAML. Mitigation : monitoring du sidecar lui-même + alertes si dernier pull > N minutes.
- **Latence de propagation** : 5 min entre toggle XCH → endpoint actif côté Gatus. Acceptable pour du monitoring infra, pas adapté à du temps réel critique.
- **Complexité docker-compose** : ajoute un container léger.
- **Authentification machine-to-machine** : un secret partagé de plus à gérer (rotation, rotation, etc.).

---

## Sous-décisions à valider avant implémentation

1. **Stratégie d'auto-register : sidecar pull (recommandée) ou variante ?** Si tu préfères « XCH écrit directement dans un volume partagé Gatus », on peut, mais c'est moins propre.

2. **Granularité Asset** — est-ce que la config monitoring tient en JSON (`{ enabled, type, target, intervalSec }`) ou tu veux des champs Prisma scalaires (4 colonnes plates) ? JSON = flexible, scalaire = queryable. Recommandation : JSON pour itérer vite, migrer en scalaires si on a besoin d'indexer.

3. **Connectivity monitoring par défaut activé ?** — j'ai proposé `true` par défaut sur ConnectivityLink (« l'utilisateur configure une box internet → on veut le monitoring »). Tu valides ?

4. **Notifications via Gatus** — je recommande de garder l'archi actuelle (XCH route, Gatus produit). Tu valides ou tu veux qu'on creuse l'option « tout déléguer à Gatus » ?

5. **Quel intervalle de polling sidecar par défaut ?** — 5 min me paraît raisonnable. On peut descendre à 1 min si la latence te gêne.

6. **Sécurité du sidecar** — un seul `GATUS_PUSH_SECRET` partagé, ou tu veux un mécanisme plus robuste (token rotatable via API admin) ? Recommandation : v1 secret partagé, v2 rotation si besoin pilote.

---

## Plan d'implémentation (prévisionnel, post-validation)

### Lot 1 — Schema + migration (15 min)
- Ajouter `Asset.monitoringConfig Json?` et `ConnectivityLink.monthlyPrice` n'a rien à voir, oublie. Ajouter `ConnectivityLink.monitoringEnabled Boolean @default(true)`.
- `Site.monitoringEnabled` existe déjà — pas de change.

### Lot 2 — Backend `GatusEndpointsService` (1h)
- Service qui génère le YAML depuis les sites/assets/links où monitoring est activé.
- Cache mémoire 30 sec (évite la regénération par appel).
- Format Gatus standard : `endpoints: [- name, url, conditions: [...], interval, ...]`.

### Lot 3 — Backend endpoint expose YAML + toggles (1h)
- 4 endpoints de la table API plus haut.
- Audit log à chaque toggle.

### Lot 4 — Sidecar `gatus-sync` dans docker-compose (30 min)
- Image `alpine` + `wget` + `crond` + script `pull.sh` qui fait le `wget` toutes les 5 min vers `/etc/gatus/endpoints-from-xch.yaml`.
- Volume partagé entre `gatus-sync` et `gatus`.
- `gatus` lance avec `--watch-config-file`.

### Lot 5 — Frontend toggles (1h30)
- Sur `sites/[id]/edit` : toggle monitoring (existe déjà ? à check)
- Sur `assets/new + assets/[id]/edit` : section Monitoring (toggle + type + target + interval)
- Sur `ConnectivityLinksManager` : toggle monitoring par link

### Lot 6 — Frontend statut sync (30 min)
- Page `/dashboard/integrations` enrichie : badge « Dernière sync sidecar : il y a Xs » + bouton manuel « Refresh maintenant » (super admin)

### Lot 7 — Doc + Tests (45 min)
- Mise à jour `INSTALL_PROD.md` avec la section sidecar
- Tests fumée curl post-deploy (login → toggle monitoring sur un asset → check YAML retourné)

**Charge totale estimée : ~5h** une fois les sous-décisions validées.

---

## Références

- ADR-009 (delegation-first, R1 site/délégation)
- ADR-011 (inline expense — pattern de référence pour le toggle UI)
- Gatus docs : https://gatus.io/docs/
- `backend/src/modules/integrations/providers/gatus.provider.ts` (état actuel READ-only)
- CHANGELOG v1.0.0-rc1 (où Gatus a été ajouté en docker-compose)

---

**À valider** : les 6 sous-décisions ci-dessus avant de partir sur l'implémentation. Une fois validé, le plan en 7 lots peut s'exécuter dans la foulée (~5h).
