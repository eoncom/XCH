# Prompt de Reprise de Session XCH

**Usage :** Copier-coller ce prompt au début d'une nouvelle conversation Claude Code.
**Maintenance :** Ce fichier est mis à jour automatiquement par Claude en fin de chaque session.

---

## MODE D'EMPLOI

**Reprise générale :** Copier le **Bloc A** seul
**Sujet(s) précis :** Copier le **Bloc A** + le(s) **sujet(s)** souhaité(s) du **Bloc B**
**Nouveau bug :** Copier le **Bloc A** + le **Template Bug** du Bloc B

---

## BLOC A — PROMPT DE REPRISE (copier tel quel)

```
Tu reprends le développement du projet XCH.

## Quoi
XCH = Application de gestion IT pour chantiers temporaires (gestion sites, assets, racks, plans d'étage, tâches, contacts, intégrations).

## Stack
- Backend : NestJS 10, Prisma ORM, PostgreSQL 15 + PostGIS, Redis 7, MinIO (S3)
- Frontend : Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS, shadcn/ui, Zustand, TanStack Query, Leaflet (cartes), Konva.js (canvas)
- Auth : JWT access + refresh tokens, cookies HTTP-only, domain .eoncom.io
- RBAC : Casbin (4 rôles : ADMIN, MANAGER, TECHNICIEN, VIEWER)
- Deploy : Docker Compose sur Ubuntu 24.04

## Accès
- Frontend : https://xch.eoncom.io
- API : https://xchapi.eoncom.io
- SSH : ssh xch-deploy
- Projet serveur : /opt/xch-dev/XCH/
- Docker : cd /opt/xch-dev/XCH && docker compose up -d
- Login démo : admin@xch.demo / admin123

## Conventions CRITIQUES
- DB = "xch_dev" (JAMAIS "xch_db")
- Ports host : Backend=3002, Frontend=3001, PG=5433, Redis=6380, MinIO=9000-9001
- Déploiement : TOUJOURS via "docker compose" (JAMAIS "docker run")
- Docker network : xch_xch-network
- Git : commits conventionnels (feat:, fix:, docs:, refactor:)
- Tenant : id="default-tenant"

## Contexte obligatoire à lire
Avant de commencer, lis ces 3 fichiers dans cet ordre :
1. CLAUDE.md — Ton rôle, règles, conventions
2. docs/status/PROJECT_STATUS.md — État d'avancement (SOURCE DE VÉRITÉ)
3. DEVELOPMENT_LOG.md (les 2 dernières sessions) — Ce qui a été fait récemment

## Procédure de déploiement standard
git add [fichiers] && git commit -m "type: description" && git push
ssh xch-deploy "cd /opt/xch-dev/XCH && git pull && docker compose up -d --build backend frontend"
ssh xch-deploy "docker logs xch-backend --tail 20"

## Commandes debug utiles
- Logs : ssh xch-deploy "docker logs xch-backend --tail 50"
- DB : ssh xch-deploy "docker exec xch-postgres psql -U xch_user -d xch_dev -c 'SELECT ...'"
- API : curl -s https://xchapi.eoncom.io/api/[endpoint]
- Disque : ssh xch-deploy "df -h /"
- Conteneurs : ssh xch-deploy "docker ps --filter name=xch"
```

---

## BLOC B — SUJETS SPÉCIFIQUES (copier en plus du Bloc A si besoin)

### Déboguer un problème (Template)
```
## Bug à résoudre

Description : [DÉCRIRE LE PROBLÈME]
Étapes de reproduction : [COMMENT REPRODUIRE]
Message d'erreur : [COPIER L'ERREUR ICI]
Page/URL concernée : [URL OU NOM DE PAGE]
```

### Corriger les tests E2E
```
## Sujet : Fix tests E2E — Problème cookies SSR/CSR

57 tests Playwright écrits, seuls 2 passent. Les 55 autres timeout sur redirect /login.
Cause : Le middleware Next.js (SSR) vérifie le cookie accessToken, mais le Zustand store (CSR) stocke dans localStorage.
Solution : Cookies HTTP-only complets côté backend + lecture par middleware SSR.

Fichiers : middleware.ts, auth-store.ts, login/page.tsx, auth.controller.ts, e2e/fixtures/auth.fixture.ts
Objectif : 57/57 tests passent.
```

### Corriger les bugs Rack Viewer
```
## Sujet : Fix bugs Rack Viewer (Bugs #1 et #5)

Bug #1 : Rack Viewer Konva crash → field manufacturer manquant dans select Prisma (racks.service.ts)
Bug #5 : Occupation rack mal calculée → findAll() ne calcule pas l'occupation comme findOne()
Contrainte : Code écrit mais erreurs TypeScript build à corriger.
```

### Cron nettoyage Docker
```
## Sujet : Script cron nettoyage Docker

Le disque serveur a atteint 100% (Docker build cache 41 Go).
Créer un script /opt/xch-dev/scripts/docker-cleanup.sh avec cron weekly.
Contenu : docker image prune -f && docker builder prune -f --filter until=48h
Bonus : alerte si disque > 80%.
```

### CI/CD déploiement automatique
```
## Sujet : CI/CD déploiement auto

Workflow GitHub Actions existe (.github/workflows/tests-e2e.yml) mais pas de deploy auto.
Objectif : Après succès tests → build images → push registry → SSH pull + compose up → health check.
Secrets GitHub nécessaires : SSH_KEY, SSH_HOST, SSH_USER.
```

### Responsive mobile
```
## Sujet : Amélioration responsive mobile

Problèmes : sidebar sur petits écrans, tableaux qui débordent, Konva viewers pas adaptés mobile.
Fichiers : layout.tsx, composants ui/, pages liste (sites, assets, tasks, contacts).
Objectif : Tester sur 375px et corriger les problèmes UX majeurs.
```

### Nouvelle fonctionnalité
```
## Sujet : Implémenter [NOM DE LA FEATURE]

Description : [CE QUE ÇA DOIT FAIRE]
Priorité : [HAUTE / MOYENNE / BASSE]

Fonctionnalités post-MVP déjà identifiées :
- Dark mode (shadcn/ui le supporte déjà)
- Export Excel/CSV (listes assets, sites, tasks)
- Notifications push PWA
- i18n FR/EN (next-intl)
- Mode offline (Service Worker)
- Audit trail UI (backend existe déjà)
```

---

## EXEMPLES

### Exemple 1 : Reprise générale
```
[Coller Bloc A]

Continue le développement. Lis le PROJECT_STATUS et le DEVELOPMENT_LOG,
puis dis-moi ce qui devrait être traité en priorité.
```

### Exemple 2 : Un sujet précis
```
[Coller Bloc A]
[Coller sujet "Corriger les tests E2E"]

Corrige le problème des tests E2E pour que les 57 tests passent.
```

### Exemple 3 : Plusieurs sujets
```
[Coller Bloc A]
[Coller sujet "Corriger les bugs Rack Viewer"]
[Coller sujet "Cron nettoyage Docker"]

Traite ces 2 sujets dans l'ordre.
```

### Exemple 4 : Nouveau bug
```
[Coller Bloc A]
[Coller Template Bug, rempli avec les détails]
```

### Exemple 5 : Nouvelle feature
```
[Coller Bloc A]
[Coller sujet "Nouvelle fonctionnalité", rempli avec la feature voulue]
```
